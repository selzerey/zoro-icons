#!/usr/bin/env node
// Start or adopt an icon set.
//   node scripts/init.mjs <folder> [--size 24] [--stroke 2] [--padding 1] [--style stroke|fill] [--color mono|multi]
//     Writes zoro-icons.json: the grid rules the set already follows (majority of its icons), or the defaults
//     (24 grid, 1 unit padding, 2 stroke, round caps and joins, currentColor) for an empty folder.
//   node scripts/init.mjs <folder> --new <name>
//     Adds <name>.svg with the set's root attributes, ready for the artwork.
import fs from "node:fs";
import path from "node:path";
import { isMain, parseArgs, usageOf } from "./lib/args.mjs";
import { CONFIG_FILE, DEFAULTS, inferConfig, readConfig, svgFiles } from "./lib/set.mjs";
import { readSvg } from "./lib/svg.mjs";

export function initSet(dir, overrides = {}, { log = console.log } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const files = svgFiles(dir);
  const inferred = files.length ? inferConfig(files.map((f) => readSvg(fs.readFileSync(f, "utf8")))) : {};
  const config = { ...DEFAULTS, ...inferred, ...overrides };
  if (config.style !== "stroke") for (const k of ["stroke", "linecap", "linejoin"]) delete config[k];
  const file = path.join(dir, CONFIG_FILE);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  log(`${file}: ${JSON.stringify(config)}${files.length ? ` (from ${files.length} icons)` : " (defaults)"}`);
  return config;
}

/** Root <svg> for a new icon following the set config. */
export function template(config) {
  const s = config.size;
  const paint = config.style === "stroke" ? ` fill="none" stroke="currentColor" stroke-width="${config.stroke}" stroke-linecap="${config.linecap}" stroke-linejoin="${config.linejoin}"` : ` fill="currentColor"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"${paint}>\n  \n</svg>\n`;
}

export function newIcon(dir, name, { log = console.log } = {}) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) throw new Error(`"${name}": use kebab-case (a-z, 0-9, hyphens)`);
  const file = path.join(dir, `${name}.svg`);
  if (fs.existsSync(file)) throw new Error(`${file} already exists`);
  const config = readConfig(dir).config ?? initSet(dir, {}, { log });
  fs.writeFileSync(file, template(config));
  const p = config.padding;
  log(`${file}: draw inside ${p}…${config.size - p}${config.style === "stroke" ? ` (stroke ${config.stroke}, ${config.linecap} caps)` : ""}`);
  return file;
}

export async function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv);
  const dir = a._[0];
  if (!dir || a.help) return console.log(usageOf(import.meta.url));
  if (a.new) return newIcon(dir, String(a.new));
  const o = {};
  for (const k of ["size", "stroke", "padding"]) if (a[k] !== undefined) o[k] = Number(a[k]);
  for (const k of ["style", "color", "linecap", "linejoin"]) if (a[k] !== undefined) o[k] = a[k];
  return initSet(dir, o);
}

if (isMain(import.meta.url))
  main().catch((e) => {
    console.error(e.message);
    process.exit(2);
  });
