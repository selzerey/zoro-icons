#!/usr/bin/env node
// zoro-icons command line: lint, fix, render, build icon sets, generate favicons and app icons, and install the skill
// for Claude Code and Codex. `npx zoro-icons help` lists everything.
import { isMain } from "../scripts/lib/args.mjs";
import { doctor, install, SKILL, uninstall, VERSION } from "../scripts/lib/install.mjs";

const HELP = `zoro-icons ${VERSION} — consistent, verified SVG icons, favicons and app icons

Icon sets
  zoro-icons init <folder>                 Save the set's grid rules (zoro-icons.json); empty folder = 24 grid defaults
  zoro-icons new <folder> <name>           Add an icon with the set's root attributes
  zoro-icons lint <folder|file.svg>        Check consistency, geometry, colours, safety, animation (exit 1 on errors)
  zoro-icons fix <folder|file.svg>         Optimize safely (pixel-checked), currentColor, strip editor junk (--write)
  zoro-icons render <folder|file.svg>      Contact sheet PNG at 16/24/48 on light and dark, or one PNG (--size)
  zoro-icons build <folder>                React, Vue, web component, sprite, JSON, preview page (--out dist)

Favicons and app icons (from one square SVG)
  zoro-icons favicon <master.svg>          favicon.ico/.svg/96 png, apple-touch-icon, PWA + maskable, manifest, <head> tags
  zoro-icons app <master.svg>              iOS 1024 (+dark, tinted, layers) and Android adaptive + Play Store icons

Skill
  zoro-icons install [--claude] [--codex] [--project] [--force]
  zoro-icons uninstall [--claude] [--codex] [--project]
  zoro-icons doctor

Each command prints its options with --help, e.g. zoro-icons favicon --help

Examples
  npx zoro-icons lint ./icons
  npx zoro-icons fix ./icons --write && npx zoro-icons build ./icons --out ./dist
  npx zoro-icons favicon logo.svg --out public --dark-color "#f5f5f5"
`;

const TOOLS = {
  init: ["../scripts/init.mjs"],
  lint: ["../scripts/lint.mjs"],
  fix: ["../scripts/fix.mjs"],
  render: ["../scripts/render.mjs"],
  build: ["../scripts/build.mjs"],
  favicon: ["../scripts/appicons.mjs", "favicon"],
  app: ["../scripts/appicons.mjs", "app"],
};

export async function run(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;
  const flags = Object.fromEntries(rest.filter((a) => a.startsWith("--")).map((a) => [a.slice(2), true]));
  if (!cmd || ["help", "--help", "-h"].includes(cmd)) return console.log(HELP);
  if (["--version", "-v", "version"].includes(cmd)) return console.log(VERSION);
  if (cmd === "install") return void install(flags);
  if (cmd === "uninstall") return uninstall(flags);
  if (cmd === "doctor") return doctor();
  if (cmd === "new") {
    const [dir, name] = rest.filter((a) => !a.startsWith("--"));
    if (!dir || !name) throw new Error("usage: zoro-icons new <folder> <name>");
    return (await import("../scripts/init.mjs")).newIcon(dir, name);
  }
  if (TOOLS[cmd]) {
    const [file, sub] = TOOLS[cmd];
    return (await import(file)).main(sub ? [sub, ...rest] : rest);
  }
  console.error(`unknown command "${cmd}"\n`);
  console.log(HELP);
  process.exitCode = 2;
}

if (isMain(import.meta.url))
  run().catch((e) => {
    console.error(e.message);
    process.exit(2);
  });

export { SKILL };
