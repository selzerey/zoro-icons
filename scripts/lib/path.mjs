// Minimal SVG path reader: absolute segment endpoints, enough to find straight horizontal/vertical lines and their
// coordinates (pixel alignment). Curves are followed only to keep the current point right.

const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const NUM = /^[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/;

/**
 * Tokens of a path: [command, [numbers]] with implicit repeats expanded (extra M pairs become L). Arc flags may be
 * written without separators ("a1 1 0 01.5.5"). Throws on malformed data.
 */
export function tokens(d) {
  const s = String(d ?? "");
  const out = [];
  let i = 0;
  let cmd = null;
  let first = true;
  const skip = () => {
    while (i < s.length && /[\s,]/.test(s[i])) i++;
  };
  while (true) {
    skip();
    if (i >= s.length) break;
    if (/[A-Za-z]/.test(s[i])) {
      cmd = s[i++];
      if (!(cmd.toLowerCase() in ARGS)) throw new Error(`unknown path command "${cmd}"`);
      first = true;
      if (cmd.toLowerCase() === "z") {
        out.push([cmd, []]);
        cmd = null;
      }
      continue;
    }
    if (!cmd) throw new Error("path data must start with a command");
    const n = ARGS[cmd.toLowerCase()];
    const nums = [];
    for (let k = 0; k < n; k++) {
      skip();
      if (cmd.toLowerCase() === "a" && (k === 3 || k === 4)) {
        if (s[i] !== "0" && s[i] !== "1") throw new Error("bad arc flag");
        nums.push(Number(s[i++]));
        continue;
      }
      const m = s.slice(i).match(NUM);
      if (!m) throw new Error(`bad argument count for ${cmd}`);
      nums.push(Number(m[0]));
      i += m[0].length;
    }
    const c = !first && (cmd === "M" || cmd === "m") ? (cmd === "M" ? "L" : "l") : cmd;
    out.push([c, nums]);
    first = false;
  }
  return out;
}

/**
 * Straight segments of a path in absolute coordinates: [{ x1, y1, x2, y2 }] for L/H/V and the closing segment of Z.
 * Curves update the current point but are not returned.
 */
export function lines(d) {
  const segs = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  for (const [c, a] of tokens(d)) {
    const rel = c === c.toLowerCase();
    const C = c.toUpperCase();
    const px = x, py = y;
    if (C === "M") {
      x = rel ? x + a[0] : a[0];
      y = rel ? y + a[1] : a[1];
      sx = x;
      sy = y;
    } else if (C === "Z") {
      if (x !== sx || y !== sy) segs.push({ x1: x, y1: y, x2: sx, y2: sy });
      x = sx;
      y = sy;
    } else if (C === "L") {
      x = rel ? x + a[0] : a[0];
      y = rel ? y + a[1] : a[1];
      segs.push({ x1: px, y1: py, x2: x, y2: y });
    } else if (C === "H") {
      x = rel ? x + a[0] : a[0];
      segs.push({ x1: px, y1: py, x2: x, y2: y });
    } else if (C === "V") {
      y = rel ? y + a[0] : a[0];
      segs.push({ x1: px, y1: py, x2: x, y2: y });
    } else {
      const n = a.length;
      x = rel ? x + a[n - 2] : a[n - 2];
      y = rel ? y + a[n - 1] : a[n - 1];
    }
  }
  return segs;
}

/** Straight lines of basic shapes, in the same form as lines(). */
export function shapeLines(el) {
  const n = (k) => Number(el.attrs[k] ?? 0);
  if (el.name === "line") return [{ x1: n("x1"), y1: n("y1"), x2: n("x2"), y2: n("y2") }];
  if (el.name === "rect" && !Number(el.attrs.rx ?? 0) && !Number(el.attrs.ry ?? 0)) {
    const [x, y, w, h] = [n("x"), n("y"), n("width"), n("height")];
    return [{ x1: x, y1: y, x2: x + w, y2: y }, { x1: x + w, y1: y, x2: x + w, y2: y + h }, { x1: x + w, y1: y + h, x2: x, y2: y + h }, { x1: x, y1: y + h, x2: x, y2: y }];
  }
  if (el.name === "polyline" || el.name === "polygon") {
    const p = String(el.attrs.points ?? "").trim().split(/[\s,]+/).map(Number);
    const out = [];
    for (let i = 2; i + 1 < p.length; i += 2) out.push({ x1: p[i - 2], y1: p[i - 1], x2: p[i], y2: p[i + 1] });
    if (el.name === "polygon" && p.length >= 4) out.push({ x1: p.at(-2), y1: p.at(-1), x2: p[0], y2: p[1] });
    return out;
  }
  if (el.name === "path") return lines(el.attrs.d);
  return [];
}

/** Most decimals used by any number in a string of coordinates. */
export function maxDecimals(d) {
  let max = 0;
  for (const m of String(d ?? "").matchAll(/\d*\.(\d+)/g)) max = Math.max(max, m[1].length);
  return max;
}
