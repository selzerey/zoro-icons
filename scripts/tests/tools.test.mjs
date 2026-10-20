// fix, build (React / Vue / sprite / element / JSON / preview), render, favicon, app icons, init, CLI install.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { appIcons, favicon } from "../appicons.mjs";
import { buildSet, pascal } from "../build.mjs";
import { fixSet } from "../fix.mjs";
import { initSet, newIcon } from "../init.mjs";
import { readIco } from "../lib/compose.mjs";
import { install, SKILL_ROOT, uninstall } from "../lib/install.mjs";
import { render } from "../lib/render.mjs";
import { loadSet } from "../lib/set.mjs";
import { main as renderMain } from "../render.mjs";

const quiet = { log: () => {} };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "zi-"));
const H = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

function setDir(files) {
  const dir = tmp();
  for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(dir, `${n}.svg`), t);
  return dir;
}

test("fix: optimizes, keeps the look, turns a single fixed colour into currentColor; dry run writes nothing", async () => {
  const dir = setDir({ a: `<!-- Generator: Sketch --><svg xmlns="http://www.w3.org/2000/svg" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="#000000" stroke-width="2"><path d="M5.000001 12.0000001 L19 12"/></g></svg>` });
  const before = fs.readFileSync(path.join(dir, "a.svg"), "utf8");
  await fixSet(dir, quiet);
  assert.equal(fs.readFileSync(path.join(dir, "a.svg"), "utf8"), before);
  const r = await fixSet(dir, { ...quiet, write: true });
  assert.equal(r[0].status, "fixed");
  const after = fs.readFileSync(path.join(dir, "a.svg"), "utf8");
  assert.match(after, /currentColor/);
  assert.doesNotMatch(after, /sketch|Generator|<!--/);
  assert.ok(after.length < before.length);
});

test("build: every format; ids prefixed per icon; refuses unsafe icons", async () => {
  const dir = setDir({
    "arrow-left": H('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
    grad: H('<defs><linearGradient id="g"><stop offset="0" stop-color="currentColor"/></linearGradient></defs><circle cx="12" cy="12" r="8" stroke="url(#g)"/>'),
    evil: H('<script>alert(1)</script><path d="M5 12h14"/>'),
  });
  const out = path.join(dir, "dist");
  const r = buildSet(await loadSet(dir), { out, name: "Test", ...quiet });
  assert.deepEqual(r.built.sort(), ["arrow-left", "grad"]);
  assert.deepEqual(r.refused, ["evil"]);
  for (const f of ["svg/arrow-left.svg", "sprite.svg", "react/index.js", "react/index.d.ts", "vue/index.js", "element/zoro-icon.js", "icons.json", "preview.html"]) assert.ok(fs.existsSync(path.join(out, f)), f);
  const sprite = fs.readFileSync(path.join(out, "sprite.svg"), "utf8");
  assert.match(sprite, /<symbol id="icon-arrow-left"/);
  assert.match(sprite, /id="grad-[a-z]+"/);
  assert.doesNotMatch(sprite, /script/);
  assert.equal(pascal("arrow-left"), "ArrowLeft");
  assert.equal(pascal("3d-box"), "Icon3dBox");
});

test("build: React component renders accessibly (decorative by default, labelled with title)", async () => {
  const dir = setDir({ check: H('<path d="M20 6 9 17l-5-5"/>') });
  // Inside the project, so the generated modules can import react/vue from node_modules.
  const out = fs.mkdtempSync(path.join(SKILL_ROOT, "scripts", "tests", ".out-"));
  buildSet(await loadSet(dir), { out, formats: ["react", "vue"], ...quiet });
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { Check } = await import(pathToFileURL(path.join(out, "react", "index.js")).href);
  const plain = renderToStaticMarkup(React.createElement(Check, { size: 20, className: "x" }));
  assert.match(plain, /aria-hidden="true"/);
  assert.match(plain, /width="20"/);
  assert.match(plain, /stroke-linecap="round"/);
  assert.match(plain, /class="x"/);
  const labelled = renderToStaticMarkup(React.createElement(Check, { title: "Done <ok>" }));
  assert.match(labelled, /role="img"/);
  assert.match(labelled, /<title>Done &lt;ok><\/title>/);
  const { createSSRApp, h } = await import("vue");
  const { renderToString } = await import("@vue/server-renderer");
  const vue = await import(pathToFileURL(path.join(out, "vue", "index.js")).href);
  const html = await renderToString(createSSRApp({ render: () => h(vue.Check, { title: "Done" }) }));
  assert.match(html, /role="img"/);
  assert.match(html, /<title>Done<\/title>/);
  fs.rmSync(out, { recursive: true, force: true });
});

test("render: contact sheet PNG and legend; single icon PNG at a size", async () => {
  const dir = setDir({ a: H('<path d="M5 12h14"/>'), b: H('<circle cx="12" cy="12" r="8"/>') });
  await renderMain([dir, "--out", path.join(dir, "sheet.png")]);
  assert.ok(fs.statSync(path.join(dir, "sheet.png")).size > 500);
  assert.match(fs.readFileSync(path.join(dir, "sheet.md"), "utf8"), /\| 1 \| a \| b \|/);
  await renderMain([path.join(dir, "a.svg"), "--size", "64", "--out", path.join(dir, "a.png")]);
  assert.deepEqual(pngSize(fs.readFileSync(path.join(dir, "a.png"))), [64, 64]);
});

test("favicon: every file, ICO with 16/32/48 PNG frames, dark-mode SVG, manifest; warns when invisible on dark tabs", async () => {
  const dir = tmp();
  const master = path.join(dir, "logo.svg");
  fs.writeFileSync(master, H('<path d="M5 5h14L5 19h14"/>'));
  const out = path.join(dir, "public");
  const report = await favicon(master, { out, color: "#111111", darkColor: "#f5f5f5", name: "Test", ...quiet });
  assert.deepEqual(report, []);
  assert.deepEqual(readIco(fs.readFileSync(path.join(out, "favicon.ico"))), [16, 32, 48].map((size) => ({ size, png: true })));
  assert.match(fs.readFileSync(path.join(out, "favicon.svg"), "utf8"), /prefers-color-scheme:dark/);
  for (const [f, s] of [["apple-touch-icon.png", 180], ["favicon-96x96.png", 96], ["web-app-manifest-192x192.png", 192], ["web-app-manifest-512x512.png", 512], ["maskable-icon-512x512.png", 512]]) assert.deepEqual(pngSize(fs.readFileSync(path.join(out, f))), [s, s], f);
  const m = JSON.parse(fs.readFileSync(path.join(out, "site.webmanifest"), "utf8"));
  assert.deepEqual(m.icons.map((i) => i.purpose), ["any", "any", "maskable"]);
  assert.match(fs.readFileSync(path.join(out, "head.html"), "utf8"), /rel="apple-touch-icon"/);
  // Apple touch icon must be opaque: corner pixel alpha 255.
  const apple = await render(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="180" height="180"><image width="180" height="180" href="data:image/png;base64,${fs.readFileSync(path.join(out, "apple-touch-icon.png")).toString("base64")}"/></svg>`, { size: 180 });
  assert.equal(apple.pixels[3], 255);
  const dark = await favicon(master, { out: path.join(dir, "p2"), color: "#111111", ...quiet });
  assert.ok(dark.some((r) => r.id === "favicon-low-contrast" && /dark/.test(r.detail)));
});

test("app icons: iOS 1024 set and Android adaptive layers", async () => {
  const dir = tmp();
  const master = path.join(dir, "logo.svg");
  fs.writeFileSync(master, H('<path d="M5 5h14L5 19h14"/>'));
  const out = path.join(dir, "app");
  await appIcons(master, { out, background: "#2563eb", color: "#ffffff", ...quiet });
  assert.deepEqual(pngSize(fs.readFileSync(path.join(out, "ios", "AppIcon-1024.png"))), [1024, 1024]);
  assert.deepEqual(pngSize(fs.readFileSync(path.join(out, "android", "mipmap-xxxhdpi", "ic_launcher_foreground.png"))), [432, 432]);
  assert.match(fs.readFileSync(path.join(out, "android", "mipmap-anydpi-v26", "ic_launcher.xml"), "utf8"), /<monochrome/);
});

test("init and new: config from the majority, template follows it", async () => {
  const dir = setDir({ a: H('<path d="M5 12h14"/>'), b: H('<path d="M12 5v14"/>') });
  const c = initSet(dir, {}, quiet);
  assert.equal(c.stroke, 2);
  assert.equal(c.linecap, "round");
  const f = newIcon(dir, "new-one", quiet);
  assert.match(fs.readFileSync(f, "utf8"), /stroke-width="2"/);
  assert.throws(() => newIcon(dir, "Bad Name", quiet), /kebab/);
});

test("install: Claude Code and Codex folders, never through a link", () => {
  const home = tmp();
  fs.mkdirSync(path.join(home, ".claude"));
  fs.mkdirSync(path.join(home, ".codex"));
  const done = install({}, { home, ...quiet });
  assert.deepEqual(done.map(([a]) => a), ["claude", "codex"]);
  assert.ok(fs.existsSync(path.join(done[1][1], "scripts", "lib", "vendor", "resvg.wasm")));
  assert.ok(!fs.existsSync(path.join(done[0][1], "scripts", "tests")));
  uninstall({}, { home, ...quiet });
  const clone = tmp();
  fs.writeFileSync(path.join(clone, "SKILL.md"), "mine");
  const link = path.join(home, ".claude", "skills", "zoro-icons");
  fs.symlinkSync(clone, link, "junction");
  install({ claude: true }, { home, ...quiet });
  uninstall({ claude: true }, { home, ...quiet });
  assert.equal(fs.readFileSync(path.join(clone, "SKILL.md"), "utf8"), "mine");
});

test("cli: version, help, lint exit code", () => {
  const cli = path.join(SKILL_ROOT, "cli", "zoro-icons.mjs");
  assert.match(execFileSync(process.execPath, [cli, "--version"], { encoding: "utf8" }), /^\d+\.\d+\.\d+/);
  assert.match(execFileSync(process.execPath, [cli, "help"], { encoding: "utf8" }), /zoro-icons lint/);
  const dir = setDir({ bad: H('<path d="M0 12h24"/>'), a: H('<path d="M5 12h14"/>') });
  assert.throws(() => execFileSync(process.execPath, [cli, "lint", dir], { stdio: "pipe" }), (e) => e.status === 1);
});
