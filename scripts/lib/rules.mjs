// Lint rules. Icon rules: check(icon, ctx) → [detail]; set rules: check(icons, ctx) → [{ name, detail }].
// ctx = { config, stats } where stats holds set medians. Every rule has a test with a planted problem and a trap.
import { maxDecimals, shapeLines } from "./path.mjs";
import { defaultFilled, drawStyle, literalColors, visibleShapes } from "./svg.mjs";

const UNSAFE_ELEMENTS = new Set(["script", "foreignObject", "iframe", "embed", "object", "audio", "video", "canvas", "html", "body"]);
const SMIL = new Set(["animate", "animateTransform", "animateMotion", "animateColor", "set"]);
const JUNK_ATTR = /^(sodipodi:|inkscape:|sketch:|figma:|serif:|xmlns:(sodipodi|inkscape|sketch|serif|figma|dc|cc|rdf)|data-name$|enable-background$|xml:space$|version$|baseProfile$)/;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const hrefOf = (e) => e.attrs.href ?? e.attrs["xlink:href"];
const num = (v) => (v === undefined ? NaN : Number(String(v).replace(/px$/, "")));
const fmt = (n) => String(Math.round(n * 1000) / 1000);
const animated = (icon) => icon.svg.elements.some((e) => SMIL.has(e.name)) || /@keyframes|animation\s*:|transition\s*:/i.test(styleText(icon));
const styleText = (icon) => icon.svg.elements.filter((e) => e.name === "style").map((e) => e.text).join("\n") + icon.svg.elements.map((e) => e.attrs.style ?? "").join(";");

export const ICON_RULES = [
  {
    id: "parse-error",
    severity: "error",
    en: "Not a valid SVG file",
    check: (icon) => (icon.svg.ok ? [] : [icon.svg.error]),
  },
  {
    id: "unsafe-content",
    severity: "error",
    en: "Active or external content (script, foreignObject, event handlers, external references, javascript: URLs): unsafe to inline or upload",
    check: (icon) => {
      const out = [];
      for (const e of icon.svg.elements) {
        if (UNSAFE_ELEMENTS.has(e.name)) out.push(`<${e.name}>`);
        for (const [k, v] of Object.entries(e.attrs)) {
          if (/^on/i.test(k)) out.push(`${k}= on <${e.name}>`);
          if (/javascript:/i.test(String(v))) out.push(`javascript: in ${k}`);
        }
        const h = hrefOf(e);
        if (h && !h.startsWith("#") && !(e.name === "image" && /^data:image\//i.test(h))) out.push(`external ${e.name} href "${String(h).slice(0, 40)}"`);
        if (e.name === "style" && /@import|url\(\s*['"]?(?!#)/i.test(e.text)) out.push("<style> loads an external resource");
      }
      return out.length ? [[...new Set(out)].join(", ")] : [];
    },
  },
  {
    id: "embedded-raster",
    severity: "error",
    en: "Embedded bitmap (<image>): blurry at other sizes, cannot take the text colour; redraw it as vector shapes",
    check: (icon) => icon.svg.elements.filter((e) => e.name === "image").map((e) => String(hrefOf(e) ?? "").slice(0, 30)),
  },
  {
    id: "viewbox-missing",
    severity: "error",
    en: "No valid viewBox: the icon cannot scale; add viewBox=\"0 0 W H\"",
    check: (icon) => (icon.svg.ok && !icon.svg.viewBox ? [String(icon.svg.root.attrs.viewBox ?? "missing")] : []),
  },
  {
    id: "viewbox-mismatch",
    severity: "error",
    en: "viewBox differs from the set grid: icons render at different scales next to each other",
    check: (icon, { config }) => {
      const v = icon.svg.viewBox;
      if (!v) return [];
      return v.w !== config.size || v.h !== config.size || v.x !== 0 || v.y !== 0 ? [`${v.x} ${v.y} ${v.w} ${v.h}, set uses 0 0 ${config.size} ${config.size}`] : [];
    },
  },
  {
    id: "empty-icon",
    severity: "error",
    en: "Nothing visible is drawn",
    check: (icon) => (icon.svg.ok && icon.svg.viewBox && icon.raster && (!icon.raster.inner || icon.raster.stats.painted === 0) ? ["no painted pixels"] : []),
  },
  {
    id: "out-of-bounds",
    severity: "error",
    en: "Artwork extends past the viewBox and is clipped",
    check: (icon) => {
      const v = icon.svg.viewBox, b = icon.raster?.inner;
      if (!v || !b) return [];
      const s = icon.raster.scale;
      const over = Math.max(v.x - b.x / s, v.y - b.y / s, (b.x + b.width) / s - (v.x + v.w), (b.y + b.height) / s - (v.y + v.h));
      return over > 0.05 ? [`${fmt(over)} unit${fmt(over) === "1" ? "" : "s"} outside`] : [];
    },
  },
  {
    id: "padding",
    severity: "warn",
    en: "Artwork touches the edge: keep the set's padding (live area) so icons look the same size and are not cut by rounding",
    check: (icon, { config }) => {
      const v = icon.svg.viewBox, b = icon.raster?.inner;
      if (!v || !b || !config.padding) return [];
      const s = icon.raster.scale;
      const edge = Math.min(b.x / s - v.x, b.y / s - v.y, v.x + v.w - (b.x + b.width) / s, v.y + v.h - (b.y + b.height) / s);
      return edge < config.padding - 0.2 * (v.w / 24) && edge > -0.05 ? [`${fmt(Math.max(0, edge))} from the edge, set padding ${config.padding}`] : [];
    },
  },
  {
    id: "hardcoded-color",
    severity: "warn",
    en: "Fixed colours in a single-colour set: the icon will not follow the text colour or dark mode; use currentColor",
    check: (icon, { config }) => {
      if (config.color !== "mono" || !icon.svg.ok) return [];
      const out = literalColors(icon.svg);
      if (defaultFilled(icon.svg).length) out.push("default black fill (no fill set)");
      return out.length ? [out.join(", ")] : [];
    },
  },
  {
    id: "stroke-mismatch",
    severity: "warn",
    en: "Stroke width, line cap or line join differs from the set: lines look thicker/thinner or corners differ",
    check: (icon, { config }) => {
      if (!icon.svg.ok || config.style !== "stroke") return [];
      const shapes = visibleShapes(icon.svg).filter((s) => s.paint.stroke !== "none");
      const out = new Set();
      for (const s of shapes) {
        const w = num(s.paint["stroke-width"]);
        if (config.stroke && Math.abs(w - config.stroke) > 0.001) out.add(`stroke-width ${fmt(w)} (set ${config.stroke})`);
        if (config.linecap && s.paint["stroke-linecap"] !== config.linecap) out.add(`linecap ${s.paint["stroke-linecap"]} (set ${config.linecap})`);
        if (config.linejoin && s.paint["stroke-linejoin"] !== config.linejoin) out.add(`linejoin ${s.paint["stroke-linejoin"]} (set ${config.linejoin})`);
      }
      return out.size ? [[...out].join(", ")] : [];
    },
  },
  {
    id: "style-mismatch",
    severity: "info",
    en: "Drawn differently from the set (outline vs solid): fine for a deliberate solid variant, odd inside an outline set",
    check: (icon, { config }) => {
      if (!icon.svg.ok || !config.style || config.style === "mixed") return [];
      const s = drawStyle(icon.svg);
      // Small filled dots inside an outline set (mixed) are a normal design choice.
      return s !== "empty" && s !== "mixed" && s !== config.style ? [`${s}, set is ${config.style}`] : [];
    },
  },
  {
    id: "pixel-misaligned",
    severity: "info",
    en: "Straight horizontal/vertical lines sit between pixels at 1x and look blurry: odd stroke widths need .5 coordinates, even widths whole numbers",
    check: (icon, { config }) => {
      const v = icon.svg.viewBox;
      if (!v || !icon.svg.ok) return [];
      const scale = config.size / v.w; // pixels per unit at the set's nominal size
      let bad = 0, total = 0;
      for (const s of visibleShapes(icon.svg)) {
        if (s.paint.stroke === "none") continue;
        const w = num(s.paint["stroke-width"]) * scale;
        if (!Number.isFinite(w) || Math.abs(w - Math.round(w)) > 0.01) continue; // fractional strokes cannot align
        const want = Math.round(w) % 2 ? 0.5 : 0;
        let segs;
        try {
          segs = shapeLines(s);
        } catch {
          continue;
        }
        for (const g of segs) {
          const horiz = Math.abs(g.y1 - g.y2) < 1e-6 && Math.abs(g.x1 - g.x2) > 1e-6;
          const vert = Math.abs(g.x1 - g.x2) < 1e-6 && Math.abs(g.y1 - g.y2) > 1e-6;
          if (!horiz && !vert) continue;
          total++;
          const c = (horiz ? g.y1 : g.x1) * scale;
          const frac = ((c % 1) + 1) % 1;
          if (Math.abs(frac - want) > 0.01 && Math.abs(frac - want) < 0.99) bad++;
        }
      }
      return bad ? [`${bad}/${total} straight lines off the pixel grid`] : [];
    },
  },
  {
    id: "off-center",
    severity: "info",
    en: "Artwork box is noticeably off the centre of the canvas: fine for deliberately asymmetric shapes, otherwise centre it",
    check: (icon, { config }) => {
      const v = icon.svg.viewBox, b = icon.raster?.inner;
      if (!v || !b) return [];
      const dx = b.x + b.width / 2 - (v.x + v.w / 2), dy = b.y + b.height / 2 - (v.y + v.h / 2);
      const limit = 1.25 * (v.w / 24);
      return Math.hypot(dx, dy) > limit ? [`centre off by ${fmt(dx)}, ${fmt(dy)} units`] : [];
    },
  },
  {
    id: "near-miss-angle",
    severity: "info",
    en: "A line is almost, but not exactly, horizontal, vertical or 45°: usually a drawing slip that looks crooked at small sizes",
    check: (icon) => {
      const v = icon.svg.viewBox;
      if (!icon.svg.ok || !v) return [];
      let n = 0;
      for (const s of visibleShapes(icon.svg)) {
        let segs;
        try {
          segs = shapeLines(s);
        } catch {
          continue;
        }
        for (const g of segs) {
          const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
          if (len < v.w / 6) continue; // short strokes (ticks, legs on a circle) are often angled on purpose
          const a = ((Math.atan2(g.y2 - g.y1, g.x2 - g.x1) * 180) / Math.PI + 360) % 45;
          const off = Math.min(a, 45 - a);
          if (off > 0.3 && off < 3) n++;
        }
      }
      return n ? [`${n} line(s) 0.3–3° off a straight or 45° angle`] : [];
    },
  },
  {
    id: "text-element",
    severity: "warn",
    en: "<text> depends on fonts installed on the viewer's device; convert text to paths",
    check: (icon) => (icon.svg.elements.some((e) => e.name === "text" || e.name === "tspan") ? ["<text>"] : []),
  },
  {
    id: "precision",
    severity: "info",
    en: "Coordinates with more than 3 decimals: bigger files, no visible gain (zoro-icons fix rounds them)",
    check: (icon) => {
      let max = 0;
      for (const e of icon.svg.elements) for (const k of ["d", "points", "x", "y", "cx", "cy", "r", "rx", "ry", "x1", "x2", "y1", "y2", "width", "height"]) if (e.attrs[k] !== undefined) max = Math.max(max, maxDecimals(e.attrs[k]));
      return max > 3 ? [`${max} decimals`] : [];
    },
  },
  {
    id: "editor-junk",
    severity: "info",
    en: "Editor leftovers (comments, metadata, Inkscape/Sketch/Figma attributes): zoro-icons fix removes them",
    check: (icon) => {
      const out = new Set();
      if (icon.svg.comments?.length) out.add("comments");
      for (const e of [{ name: "svg", attrs: icon.svg.root?.attrs ?? {} }, ...icon.svg.elements]) {
        if (e.name === "metadata") out.add("<metadata>");
        if (/^(sodipodi|inkscape):/.test(e.name)) out.add(`<${e.name}>`);
        for (const k of Object.keys(e.attrs)) if (JUNK_ATTR.test(k)) out.add(k.replace(/:.*/, ":*"));
      }
      return out.size ? [[...out].join(", ")] : [];
    },
  },
  {
    id: "large-file",
    severity: "info",
    en: "Large for an icon after optimisation (> 2 KB): usually traced or over-detailed artwork",
    check: (icon) => (icon.optimizedBytes > 2048 ? [`${(icon.optimizedBytes / 1024).toFixed(1)} KB`] : []),
  },
  {
    id: "animation-reduced-motion",
    severity: "warn",
    en: "Animated icon without a reduced-motion fallback: add @media (prefers-reduced-motion: reduce) to stop it; SMIL (<animate>) cannot be paused that way, use CSS",
    check: (icon) => {
      if (!animated(icon)) return [];
      const out = [];
      const smil = icon.svg.elements.filter((e) => SMIL.has(e.name)).map((e) => `<${e.name}>`);
      if (smil.length) out.push(`SMIL ${[...new Set(smil)].join(", ")}`);
      else if (!/prefers-reduced-motion/i.test(styleText(icon))) out.push("no prefers-reduced-motion rule");
      return out;
    },
  },
  {
    id: "animation-costly",
    severity: "info",
    en: "Animation changes layout-heavy properties (d, width, x, r …): animate transform and opacity (or stroke-dashoffset) for smooth 60 fps",
    check: (icon) => {
      const css = styleText(icon);
      const props = new Set();
      for (const kf of css.matchAll(/@keyframes[^{]+\{([\s\S]*?\})\s*\}/g)) for (const m of kf[1].matchAll(/([a-z-]+)\s*:/g)) props.add(m[1]);
      for (const e of icon.svg.elements) if (e.name === "animate" && e.attrs.attributeName) props.add(e.attrs.attributeName);
      const ok = /^(transform|opacity|stroke-dashoffset|stroke-dasharray|fill|stroke|color|fill-opacity|stroke-opacity|offset|transform-origin|animation-timing-function)$/;
      const bad = [...props].filter((p) => !ok.test(p));
      return bad.length ? [bad.join(", ")] : [];
    },
  },
];

export const SET_RULES = [
  {
    id: "name-format",
    severity: "warn",
    en: "File name is not kebab-case (a-z, 0-9, hyphens): component and sprite names become inconsistent",
    check: (icons) => icons.filter((i) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(i.name)).map((i) => ({ name: i.name, detail: `${i.name}.svg` })),
  },
  {
    id: "duplicate-icon",
    severity: "warn",
    en: "Same artwork under different names: keep one and alias it",
    check: (icons) => {
      const by = new Map();
      for (const i of icons) if (i.optimized) by.set(i.optimized, [...(by.get(i.optimized) ?? []), i.name]);
      return [...by.values()].filter((n) => n.length > 1).flatMap((n) => n.map((name) => ({ name, detail: `same as ${n.filter((x) => x !== name).join(", ")}` })));
    },
  },
  {
    id: "weight-outlier",
    severity: "info",
    en: "Much heavier or lighter than the rest of the set (ink coverage): it will stand out next to the others",
    check: (icons, { stats }) => {
      if (stats.count < 8 || !stats.coverage) return [];
      return icons.filter((i) => i.raster?.stats.coverage).map((i) => [i, i.raster.stats.coverage / stats.coverage]).filter(([, r]) => r > 2.2 || r < 0.25).map(([i, r]) => ({ name: i.name, detail: `${r.toFixed(1)}× the set median ink` }));
    },
  },
  {
    id: "size-outlier",
    severity: "info",
    en: "Optically much smaller than the rest (artwork box): small icons look like a different size next to the others",
    check: (icons, { stats }) => {
      if (stats.count < 8 || !stats.extent) return [];
      return icons.filter((i) => i.raster?.inner).map((i) => [i, Math.max(i.raster.inner.width, i.raster.inner.height) / i.raster.scale / stats.extent]).filter(([, r]) => r < 0.5).map(([i, r]) => ({ name: i.name, detail: `${Math.round(r * 100)}% of the set's typical size` }));
    },
  },
];

/** Set medians used by the set rules. */
export function setStats(icons) {
  const ok = icons.filter((i) => i.raster?.inner && i.raster.stats.painted);
  return {
    count: ok.length,
    coverage: median(ok.map((i) => i.raster.stats.coverage)),
    extent: median(ok.map((i) => Math.max(i.raster.inner.width, i.raster.inner.height) / i.raster.scale)),
  };
}

export const ALL_RULES = [...ICON_RULES, ...SET_RULES];
