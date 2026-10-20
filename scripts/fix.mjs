#!/usr/bin/env node
// Safe automatic fixes: optimize (SVGO, 3 decimals, no visual change), remove editor leftovers, and for single-colour
// sets turn fixed colours into currentColor. Shows what it would change; --write saves the files.
// Usage: node scripts/fix.mjs <folder|file.svg> [--write] [--remove-dimensions] [--no-current-color]
// Every changed icon is rendered before and after; an icon whose pixels change is skipped and reported.
import fs from "node:fs";
import { isMain, parseArgs, usageOf } from "./lib/args.mjs";
import { render } from "./lib/render.mjs";
import { loadSet, optimizeSvg } from "./lib/set.mjs";
import { literalColors } from "./lib/svg.mjs";

/** Fraction of pixels whose alpha differs by more than 24/255 between two renders of the same size. */
function pixelDiff(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let diff = 0;
  for (let i = 3; i < a.pixels.length; i += 4) if (Math.abs(a.pixels[i] - b.pixels[i]) > 24) diff++;
  return diff / (a.width * a.height);
}

export async function fixSet(target, { write = false, removeDimensions = false, currentColor = true, log = console.log } = {}) {
  const set = await loadSet(target);
  const out = [];
  for (const icon of set.icons) {
    if (!icon.svg.ok) {
      out.push({ name: icon.name, status: "skipped", why: "not valid SVG" });
      continue;
    }
    const mono = set.config.color === "mono" && literalColors(icon.svg).length <= 1;
    let next;
    try {
      next = optimizeSvg(icon.text, { currentColor: currentColor && mono, removeDimensions });
    } catch (e) {
      out.push({ name: icon.name, status: "skipped", why: e.message });
      continue;
    }
    if (next === icon.text.trim()) {
      out.push({ name: icon.name, status: "unchanged" });
      continue;
    }
    // Safety net: the optimized icon must look the same (colour aside).
    const size = Math.max(48, (icon.svg.viewBox?.w ?? 24) * 4);
    const [before, after] = await Promise.all([render(icon.text, { size }), render(next, { size })]);
    const d = pixelDiff(before, after);
    if (d > 0.002) {
      out.push({ name: icon.name, status: "skipped", why: `optimizing would change ${(d * 100).toFixed(1)}% of pixels` });
      continue;
    }
    const saved = icon.bytes - Buffer.byteLength(next);
    if (write) fs.writeFileSync(icon.file, next + "\n");
    out.push({ name: icon.name, status: write ? "fixed" : "would fix", saved });
  }
  const n = (s) => out.filter((x) => x.status === s).length;
  for (const x of out.filter((x) => x.status === "skipped")) log(`skipped ${x.name}: ${x.why}`);
  const bytes = out.reduce((s, x) => s + (x.saved ?? 0), 0);
  log(`${write ? "fixed" : "would fix"} ${n(write ? "fixed" : "would fix")}, unchanged ${n("unchanged")}, skipped ${n("skipped")} · ${bytes} bytes smaller${write ? "" : " — run with --write to save"}`);
  return out;
}

export async function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv, ["write", "remove-dimensions", "no-current-color", "help"]);
  if (!a._[0] || a.help) return console.log(usageOf(import.meta.url));
  return fixSet(a._[0], { write: !!a.write, removeDimensions: !!a["remove-dimensions"], currentColor: !a["no-current-color"] });
}

if (isMain(import.meta.url))
  main().catch((e) => {
    console.error(e.message);
    process.exit(2);
  });
