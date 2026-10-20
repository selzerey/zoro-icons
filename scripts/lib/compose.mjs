// Place an icon on a new canvas (background, scale, offset) and encode ICO files. Used by the favicon and app-icon
// generators.
import { render } from "./render.mjs";

/** viewBox, root presentation attributes and inner markup of an SVG (no optimisation). */
export function split(text) {
  const open = text.match(/<svg\b[^>]*>/i);
  if (!open) throw new Error("no <svg> element");
  const vb = open[0].match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  const w = open[0].match(/\swidth\s*=\s*["']([\d.]+)/i)?.[1];
  const h = open[0].match(/\sheight\s*=\s*["']([\d.]+)/i)?.[1];
  const viewBox = vb ?? (w && h ? `0 0 ${w} ${h}` : "0 0 24 24");
  const attrs = open[0].replace(/^<svg\b|\/?>$/gi, "").replace(/\s(xmlns(:\w+)?|width|height|viewBox|x|y|class|style|preserveAspectRatio)\s*=\s*("[^"]*"|'[^']*')/gi, "").trim();
  const body = text.slice(open.index + open[0].length).replace(/<\/svg>\s*$/i, "");
  return { viewBox, attrs, body };
}

/**
 * A square canvas of `size` px: optional background (solid colour, optional corner radius) and the icon scaled so its
 * viewBox fills `scale` of the canvas, centred. `color` replaces currentColor.
 */
export function compose(text, { size, scale = 1, background = null, radius = 0, color = "#000000" }) {
  const { viewBox, attrs, body } = split(text);
  const box = size * scale;
  const off = (size - box) / 2;
  const bg = background ? `<rect width="${size}" height="${size}" rx="${radius * size}" fill="${background}"/>` : "";
  const art = `<svg x="${off}" y="${off}" width="${box}" height="${box}" viewBox="${viewBox}" ${attrs}>${body}</svg>`.replace(/currentColor/gi, color);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}${art}</svg>`;
}

export async function png(text, opts) {
  return (await render(compose(text, opts), { size: opts.size })).png();
}

/** ICO file with PNG-compressed frames (supported by every current browser and by Google). */
export function ico(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  const dir = Buffer.alloc(16 * frames.length);
  let offset = 6 + dir.length;
  frames.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...frames.map((f) => f.data)]);
}

/** Read the frame table of an ICO file (for tests and doctor). */
export function readIco(buf) {
  const n = buf.readUInt16LE(4);
  return Array.from({ length: n }, (_, i) => {
    const o = 6 + i * 16;
    const size = buf.readUInt8(o) || 256;
    const len = buf.readUInt32LE(o + 8), at = buf.readUInt32LE(o + 12);
    return { size, png: buf.subarray(at, at + 8).toString("latin1") === "\x89PNG\r\n\x1a\n" };
  });
}
