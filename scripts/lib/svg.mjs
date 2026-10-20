// Reads one SVG file into plain facts the rules use: root attributes, viewBox, every element with its effective
// (inherited) paint, and the raw text. No rule logic here.
import { parseSvg } from "./vendor/svgo.mjs";

// Presentation attributes that inherit from <svg>/<g> to the shapes.
const INHERIT = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule", "opacity", "color"];
export const SHAPES = new Set(["path", "circle", "ellipse", "line", "polyline", "polygon", "rect"]);

/** Inline style="a:b; c:d" as an object. */
export function styleOf(attrs) {
  const out = {};
  for (const part of String(attrs.style ?? "").split(";")) {
    const i = part.indexOf(":");
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

export function parseViewBox(v) {
  const n = String(v ?? "").trim().split(/[\s,]+/).map(Number);
  return n.length === 4 && n.every(Number.isFinite) && n[2] > 0 && n[3] > 0 ? { x: n[0], y: n[1], w: n[2], h: n[3] } : null;
}

/** Parse SVG text. Returns { ok, error, root, viewBox, elements: [{ name, attrs, paint, depth }], text }. */
export function readSvg(text) {
  let ast;
  try {
    ast = parseSvg(text);
  } catch (e) {
    return { ok: false, error: String(e.message ?? e).split("\n")[0], text, elements: [] };
  }
  const root = ast.children.find((c) => c.type === "element" && c.name === "svg");
  if (!root) return { ok: false, error: "no <svg> root element", text, elements: [] };
  const elements = [];
  const comments = [];
  const walk = (node, inherited, depth, inDefs) => {
    for (const c of node.children ?? []) {
      if (c.type === "comment") comments.push(c.value);
      if (c.type !== "element") continue;
      const style = styleOf(c.attributes);
      const paint = { ...inherited };
      for (const k of INHERIT) {
        const v = style[k] ?? c.attributes[k];
        if (v !== undefined) paint[k] = String(v).trim();
      }
      const defs = inDefs || ["defs", "symbol", "clipPath", "mask", "pattern", "marker", "linearGradient", "radialGradient", "filter"].includes(c.name);
      elements.push({ name: c.name, attrs: c.attributes, style, paint, depth, inDefs: defs, text: textOf(c) });
      walk(c, paint, depth + 1, defs);
    }
  };
  const rootStyle = styleOf(root.attributes);
  const rootPaint = { fill: "black", stroke: "none", "stroke-width": "1", "stroke-linecap": "butt", "stroke-linejoin": "miter" };
  for (const k of INHERIT) {
    const v = rootStyle[k] ?? root.attributes[k];
    if (v !== undefined) rootPaint[k] = String(v).trim();
  }
  walk(root, rootPaint, 1, false);
  return { ok: true, root: { attrs: root.attributes, style: rootStyle, paint: rootPaint }, viewBox: parseViewBox(root.attributes.viewBox), elements, comments, text };
}

function textOf(node) {
  return (node.children ?? []).filter((c) => c.type === "text" || c.type === "cdata").map((c) => c.value).join("");
}

/** Shapes that paint something (outside <defs>), with their effective paint. */
export const visibleShapes = (svg) => svg.elements.filter((e) => SHAPES.has(e.name) && !e.inDefs && !(e.paint.fill === "none" && e.paint.stroke === "none"));

/** "stroke" | "fill" | "mixed" | "empty": how an icon draws. */
export function drawStyle(svg) {
  const shapes = visibleShapes(svg);
  if (!shapes.length) return "empty";
  const stroked = shapes.filter((s) => s.paint.stroke !== "none" && s.paint.fill === "none").length;
  const filled = shapes.filter((s) => s.paint.fill !== "none" && s.paint.stroke === "none").length;
  if (stroked === shapes.length) return "stroke";
  if (filled === shapes.length) return "fill";
  return "mixed";
}

const NO_COLOR = /^(none|currentcolor|inherit|transparent|context-fill|context-stroke)$/i;
/** Literal colours used for fill/stroke (not none/currentColor, not url(#gradient)). */
export function literalColors(svg) {
  const out = new Set();
  for (const e of svg.elements) {
    if (e.inDefs && !["stop"].includes(e.name)) continue;
    for (const k of ["fill", "stroke"]) {
      const v = e.style[k] ?? e.attrs[k];
      if (v && !NO_COLOR.test(v) && !/^url\(/i.test(v)) out.add(v.toLowerCase());
    }
    const stop = e.style["stop-color"] ?? e.attrs["stop-color"];
    if (e.name === "stop" && stop) out.add(stop.toLowerCase());
  }
  // The root's own fill/stroke, when set to a colour (the default black fill counts only if a shape relies on it).
  for (const k of ["fill", "stroke"]) {
    const v = svg.root.style[k] ?? svg.root.attrs[k];
    if (v && !NO_COLOR.test(v) && !/^url\(/i.test(v)) out.add(v.toLowerCase());
  }
  return [...out];
}

/** Shapes that fall back to the default black fill (no fill set anywhere up the tree). */
export function defaultFilled(svg) {
  if (svg.root.attrs.fill !== undefined || svg.root.style.fill !== undefined) return [];
  return visibleShapes(svg).filter((s) => s.paint.fill === "black" && !hasOwnOrGroup(svg, s, "fill"));
}
function hasOwnOrGroup(svg, shape, key) {
  if (shape.attrs[key] !== undefined || shape.style[key] !== undefined) return true;
  // A <g fill=…> above it: the paint would differ from the root default.
  return shape.paint[key] !== "black";
}
