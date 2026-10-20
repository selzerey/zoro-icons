// Bundles SVGO (optimizer + XML parser) and copies the resvg renderer (WebAssembly) into scripts/lib/vendor/,
// so the skill runs from a plain clone without `npm install`. Run after changing a version: npm run vendor
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "scripts/lib/vendor");
const nm = (...p) => path.join(root, "node_modules", ...p);
const pkg = (name) => JSON.parse(fs.readFileSync(nm(name, "package.json"), "utf8"));
const license = (name) => {
  const dir = nm(name);
  const f = fs.readdirSync(dir).find((x) => /^licen[cs]e/i.test(x));
  return f ? fs.readFileSync(path.join(dir, f), "utf8").trim() : "";
};

const svgoDeps = ["svgo", "css-select", "css-tree", "css-what", "csso", "sax", "boolbase", "domelementtype", "domhandler", "domutils", "dom-serializer", "entities", "nth-check", "mdn-data", "source-map-js"].filter((n) => fs.existsSync(nm(n)));
await build({
  stdin: {
    contents: [
      `export { optimize } from ${JSON.stringify(nm("svgo/lib/svgo.js"))};`,
      `export { parseSvg } from ${JSON.stringify(nm("svgo/lib/parser.js"))};`,
      `export { stringifySvg } from ${JSON.stringify(nm("svgo/lib/stringifier.js"))};`,
    ].join("\n"),
    resolveDir: root,
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "node20",
  minify: true,
  legalComments: "none",
  banner: { js: `// Bundled with esbuild from ${svgoDeps.map((n) => `${n}@${pkg(n).version}`).join(", ")}. Licenses: LICENSES.md` },
  outfile: path.join(out, "svgo.mjs"),
});

const rv = "@resvg/resvg-wasm";
fs.copyFileSync(nm(rv, "index.mjs"), path.join(out, "resvg.mjs"));
fs.copyFileSync(nm(rv, "index_bg.wasm"), path.join(out, "resvg.wasm"));

const all = [...svgoDeps, rv];
fs.writeFileSync(
  path.join(out, "LICENSES.md"),
  `# Bundled third-party code\n\n- \`svgo.mjs\`: ${svgoDeps.join(", ")}\n- \`resvg.mjs\`, \`resvg.wasm\`: ${rv} ${pkg(rv).version} (MPL-2.0, unmodified; source: https://github.com/thx/resvg-js)\n\n${all
    .map((n) => `## ${n} ${pkg(n).version} — ${pkg(n).license}\n\n\`\`\`\n${license(n) || `${pkg(n).license} License`}\n\`\`\``)
    .join("\n\n")}\n`,
);
console.log(`vendor: svgo + ${svgoDeps.length - 1} deps, resvg ${pkg(rv).version}`);
