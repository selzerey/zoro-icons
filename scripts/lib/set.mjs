// An icon set = a folder of .svg files plus an optional zoro-icons.json with the grid rules. Loads, optimizes and
// measures every icon once; lint, fix, build and render all start from here.
import fs from "node:fs";
import path from "node:path";
import { alphaStats, pixelBounds, render } from "./render.mjs";
import { drawStyle, literalColors, readSvg, visibleShapes } from "./svg.mjs";
import { optimize, parseSvg, stringifySvg } from "./vendor/svgo.mjs";

const PX = 8; // pixels per unit when measuring

/** The same SVG on a canvas `pad` units larger on every side, so artwork past the viewBox is visible. */
export function padCanvas(text, v, pad) {
  const ast = parseSvg(text);
  const root = ast.children.find((c) => c.type === "element" && c.name === "svg");
  root.attributes.viewBox = `${v.x - pad} ${v.y - pad} ${v.w + 2 * pad} ${v.h + 2 * pad}`;
  delete root.attributes.width;
  delete root.attributes.height;
  root.attributes.overflow = "visible";
  return stringifySvg(ast);
}

/**
 * Measure an icon: artwork box in viewBox units (from real pixels, strokes and caps included, also outside the
 * viewBox) and ink statistics inside the viewBox. inner = { x, y, width, height } in units.
 */
export async function measure(text, v) {
  const pad = v.w / 4;
  const wide = await render(padCanvas(text, v, pad), { size: (v.w + 2 * pad) * PX * (24 / v.w) });
  const scale = wide.width / (v.w + 2 * pad);
  const b = pixelBounds(wide, 127); // half coverage = the true edge
  const inner = b ? { x: b.x / scale - pad + v.x, y: b.y / scale - pad + v.y, width: b.width / scale, height: b.height / scale } : null;
  const own = await render(text, { size: Math.round(v.w * scale) });
  return { scale: 1, unitPx: scale, inner, stats: alphaStats(own) };
}

export const CONFIG_FILE = "zoro-icons.json";
export const DEFAULTS = { size: 24, padding: 1, stroke: 2, linecap: "round", linejoin: "round", style: "stroke", color: "mono" };

/** SVGO settings that never change how an icon looks: keep viewBox and shapes' meaning, round to 3 decimals. */
export function svgoConfig({ currentColor = false, removeDimensions = false } = {}) {
  return {
    multipass: true,
    floatPrecision: 3,
    plugins: [
      { name: "preset-default", params: { overrides: { convertColors: currentColor ? { currentColor: true } : {}, removeUnknownsAndDefaults: { keepRoleAttr: true } } } },
      ...(removeDimensions ? ["removeDimensions"] : []),
      "sortAttrs",
    ],
  };
}

export function optimizeSvg(text, opts) {
  return optimize(text, svgoConfig(opts)).data;
}

/** .svg files of a folder (not recursive into node_modules or dist), sorted by name. */
export function svgFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || ["node_modules", "dist"].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.toLowerCase().endsWith(".svg")) out.push(p);
    }
  };
  if (fs.statSync(dir).isFile()) return [dir];
  walk(dir);
  return out.sort();
}

const mode = (xs) => {
  const m = new Map();
  for (const x of xs) if (x !== undefined && x !== null && x !== "") m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
};

/** Grid rules the set already follows (majority vote), for `zoro-icons init`. */
export function inferConfig(svgs) {
  const ok = svgs.filter((s) => s.ok && s.viewBox);
  const size = mode(ok.map((s) => s.viewBox.w)) ?? DEFAULTS.size;
  const styles = ok.map(drawStyle).filter((s) => s !== "empty");
  const style = mode(styles) ?? DEFAULTS.style;
  const strokes = ok.flatMap((s) => visibleShapes(s).filter((x) => x.paint.stroke !== "none"));
  const multi = ok.filter((s) => literalColors(s).length > 1).length > ok.length / 2;
  return {
    size,
    padding: Math.round((size / 24) * 100) / 100,
    ...(style === "stroke"
      ? { stroke: Number(mode(strokes.map((x) => x.paint["stroke-width"])) ?? DEFAULTS.stroke), linecap: mode(strokes.map((x) => x.paint["stroke-linecap"])) ?? "round", linejoin: mode(strokes.map((x) => x.paint["stroke-linejoin"])) ?? "round" }
      : {}),
    style,
    color: multi ? "multi" : "mono",
  };
}

export function readConfig(dir) {
  const base = fs.statSync(dir).isFile() ? path.dirname(dir) : dir;
  const f = path.join(base, CONFIG_FILE);
  return fs.existsSync(f) ? { file: f, config: { ...DEFAULTS, ...JSON.parse(fs.readFileSync(f, "utf8")) } } : { file: null, config: null };
}

/** Load a set: every icon read, optimized and rendered. `config` from zoro-icons.json, else inferred. */
export async function loadSet(dir, { config: given } = {}) {
  const files = svgFiles(dir);
  const icons = files.map((file) => {
    const text = fs.readFileSync(file, "utf8");
    return { file, name: path.basename(file, path.extname(file)), text, svg: readSvg(text), bytes: Buffer.byteLength(text) };
  });
  const found = readConfig(dir);
  const config = given ?? found.config ?? { ...DEFAULTS, ...inferConfig(icons.map((i) => i.svg)) };
  for (const icon of icons) {
    if (!icon.svg.ok) continue;
    try {
      icon.optimized = optimizeSvg(icon.text);
      icon.optimizedBytes = Buffer.byteLength(icon.optimized);
    } catch {
      /* parse-error reports it */
    }
    if (!icon.svg.viewBox) continue;
    try {
      icon.raster = await measure(icon.text, icon.svg.viewBox);
    } catch (e) {
      icon.renderError = String(e.message ?? e);
    }
  }
  return { dir, files, icons, config, configFile: found.file, inferred: !found.config && !given };
}
