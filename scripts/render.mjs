#!/usr/bin/env node
// Render icons to PNG so you (or an AI agent, which can read images) can look at them.
//   node scripts/render.mjs <folder|file.svg> [--out sheet.png] [--sizes 16,24,48] [--columns 8] [--dark]
//   node scripts/render.mjs <file.svg> --out icon.png --size 512 [--color #111] [--background #fff]
// A folder gives a contact sheet: every icon at each size, light and dark rows, a grid overlay of the padding,
// and a legend (sheet.md) mapping each cell to an icon name.
import fs from "node:fs";
import path from "node:path";
import { isMain, parseArgs, usageOf } from "./lib/args.mjs";
import { render } from "./lib/render.mjs";
import { loadSet } from "./lib/set.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Inner markup and viewBox of an SVG, to nest it inside the sheet. */
function inner(text) {
  const open = text.match(/<svg\b[^>]*>/i);
  const vb = open?.[0].match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1] ?? "0 0 24 24";
  const body = text.slice((open?.index ?? 0) + (open?.[0].length ?? 0)).replace(/<\/svg>\s*$/i, "");
  const attrs = (open?.[0] ?? "").replace(/^<svg\b|>$/gi, "").replace(/\s(xmlns(:\w+)?|width|height|viewBox|x|y|class|style)\s*=\s*("[^"]*"|'[^']*')/gi, "");
  return { vb, body, attrs };
}

/** One SVG document holding the contact sheet. */
export function sheetSvg(icons, { sizes = [16, 24, 48], columns = 8, padding = 1, gridSize = 24 } = {}) {
  const cell = Math.max(...sizes) + 24;
  const rows = Math.ceil(icons.length / columns);
  const themes = [
    { bg: "#ffffff", fg: "#111111", line: "#e5e7eb" },
    { bg: "#16181d", fg: "#f3f4f6", line: "#2f333b" },
  ];
  const blockW = columns * sizes.reduce((s, z) => s + z + 16, 8);
  const blockH = rows * cell;
  const parts = [];
  themes.forEach((t, ti) => {
    const oy = ti * (blockH + 16);
    parts.push(`<rect x="0" y="${oy}" width="${blockW}" height="${blockH}" fill="${t.bg}"/>`);
    icons.forEach((icon, i) => {
      const { vb, body, attrs } = inner(icon.text);
      const r = Math.floor(i / columns), c = i % columns;
      let x = c * sizes.reduce((s, z) => s + z + 16, 8) + 8;
      const y = oy + r * cell + 12;
      for (const z of sizes) {
        // Padding guide: the live area of the grid, drawn faintly behind the largest size only.
        if (z === Math.max(...sizes) && padding) {
          const p = (padding / gridSize) * z;
          parts.push(`<rect x="${x + p}" y="${y + p}" width="${z - 2 * p}" height="${z - 2 * p}" fill="none" stroke="${t.line}" stroke-width="1" stroke-dasharray="2 2"/>`);
        }
        parts.push(`<svg x="${x}" y="${y}" width="${z}" height="${z}" viewBox="${vb}" ${attrs.replace(/currentColor/gi, t.fg)}>${body.replace(/currentColor/gi, t.fg)}</svg>`);
        x += z + 16;
      }
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${blockW}" height="${blockH * 2 + 16}" viewBox="0 0 ${blockW} ${blockH * 2 + 16}">${parts.join("")}</svg>`;
}

export function legend(icons, { columns = 8 } = {}) {
  const lines = ["| row | " + Array.from({ length: columns }, (_, i) => `col ${i + 1}`).join(" | ") + " |", "|---|" + "---|".repeat(columns)];
  for (let r = 0; r * columns < icons.length; r++) lines.push(`| ${r + 1} | ` + icons.slice(r * columns, (r + 1) * columns).map((i) => esc(i.name)).join(" | ") + " |");
  return `Top half: light background · bottom half: dark background. Each cell shows the icon at the listed sizes; the dashed square is the padding (live area).\n\n${lines.join("\n")}\n`;
}

export async function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv);
  const target = a._[0];
  if (!target || a.help) return console.log(usageOf(import.meta.url));
  const single = fs.statSync(target).isFile() && a.size;
  if (single) {
    const r = await render(fs.readFileSync(target, "utf8"), { size: Number(a.size), color: a.color ?? "#111111", background: a.background ?? null });
    const out = a.out ?? target.replace(/\.svg$/i, `-${a.size}.png`);
    fs.writeFileSync(out, r.png());
    return console.log(`png: ${out} (${r.width}×${r.height})`);
  }
  const set = await loadSet(target);
  const icons = set.icons.filter((i) => i.svg.ok && i.svg.viewBox);
  if (!icons.length) throw new Error(`no renderable icons in ${target}`);
  const sizes = String(a.sizes ?? "16,24,48").split(",").map(Number);
  const columns = Number(a.columns ?? (icons.length > 40 ? 10 : 8));
  const svg = sheetSvg(icons, { sizes, columns, padding: set.config.padding, gridSize: set.config.size });
  const r = await render(svg, { size: Number(svg.match(/width="(\d+)"/)[1]) * Number(a.scale ?? 2), background: "#ffffff" });
  const out = a.out ?? path.join(fs.statSync(target).isFile() ? path.dirname(target) : target, "icon-sheet.png");
  fs.writeFileSync(out, r.png());
  fs.writeFileSync(out.replace(/\.png$/i, ".md"), legend(icons, { columns }));
  console.log(`sheet: ${out} (${icons.length} icons, ${r.width}×${r.height}) · legend: ${out.replace(/\.png$/i, ".md")}`);
}

if (isMain(import.meta.url))
  main().catch((e) => {
    console.error(e.message);
    process.exit(2);
  });
