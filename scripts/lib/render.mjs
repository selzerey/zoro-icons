// Rasterizing with resvg (WebAssembly, bundled): PNG output, the visible bounding box, and pixel statistics.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "./vendor/resvg.mjs";

const VENDOR = path.join(path.dirname(fileURLToPath(import.meta.url)), "vendor");
let ready = null;

export async function initRenderer() {
  ready ??= initWasm(fs.readFileSync(path.join(VENDOR, "resvg.wasm")));
  return ready;
}

/** Replace currentColor so the icon renders in a known colour (resvg would use black). */
export const withColor = (svg, color) => svg.replace(/currentColor/gi, color);

/**
 * Render SVG text to RGBA pixels at `size` px wide. `background` is a CSS colour or null (transparent).
 * Returns { width, height, pixels: Uint8Array, png: () => Buffer, bbox, inner }.
 */
export async function render(svg, { size = 24, color = "#000", background = null } = {}) {
  await initRenderer();
  const r = new Resvg(withColor(svg, color), { fitTo: { mode: "width", value: Math.round(size) }, background: background ?? "rgba(0,0,0,0)", font: { loadSystemFonts: false } });
  const box = (b) => (b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null);
  const bbox = box(r.getBBox());
  const inner = box(r.innerBBox());
  const img = r.render();
  const out = { width: img.width, height: img.height, pixels: img.pixels, bbox, inner, png: () => Buffer.from(img.asPng()) };
  r.free?.();
  return out;
}

/** Box of pixels with alpha > `min` in a render: { x, y, width, height } in pixels, or null when nothing is painted. */
export function pixelBounds({ pixels, width, height }, min = 16) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (pixels[(y * width + x) * 4 + 3] > min) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Alpha statistics of a transparent render: painted pixels, how many are partly covered (blurry edges). */
export function alphaStats({ pixels, width, height }) {
  let painted = 0, partial = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    const a = pixels[i];
    if (a > 8) painted++;
    if (a > 8 && a < 247) partial++;
  }
  return { painted, partial, coverage: painted / (width * height), blur: painted ? partial / painted : 0 };
}

const lum = (r, g, b) => {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a, b) => {
  const [x, y] = [lum(...a), lum(...b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/**
 * How visible a render (made on `bg`) is: the share of pixels that differ clearly from the background, and the best
 * contrast ratio found among them. A favicon that vanishes on a dark results page scores low here.
 */
export function visibility({ pixels }, bg) {
  let differing = 0, best = 1;
  const n = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    const px = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const c = contrast(px, bg);
    if (c >= 1.5) differing++;
    if (c > best) best = c;
  }
  return { share: differing / n, contrast: best };
}

/** Parse "#rgb", "#rrggbb" or "rgb(r,g,b)" into [r,g,b]. */
export function rgb(color) {
  const s = String(color).trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16));
  m = s.match(/^#([0-9a-f]{6})$/);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  if (s === "white") return [255, 255, 255];
  if (s === "black") return [0, 0, 0];
  throw new Error(`unsupported colour "${color}" (use #rrggbb)`);
}
