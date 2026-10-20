// Every rule: a planted problem it must find and, where relevant, a realistic trap it must ignore.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { lint } from "../lint.mjs";
import { lines, tokens } from "../lib/path.mjs";
import { loadSet } from "../lib/set.mjs";

const H = (body, attrs = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"', vb = "0 0 24 24") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="${vb}" ${attrs}>${body}</svg>`;

/** Lint a set written from { name: svgText }; returns { id: [names] }. */
async function run(files, config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zi-"));
  for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(dir, `${n}.svg`), t);
  if (config) fs.writeFileSync(path.join(dir, "zoro-icons.json"), JSON.stringify(config));
  const set = await loadSet(dir);
  const out = {};
  for (const r of lint(set)) out[r.id] = r.findings.map((f) => f.name);
  return out;
}
const GOOD = {
  plus: H('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  circle: H('<circle cx="12" cy="12" r="9"/>'),
  minus: H('<path d="M5 12h14"/>'),
};

test("a clean set has no findings (Lucide-style 24 grid)", async () => {
  assert.deepEqual(await run(GOOD), {});
});

test("path reader: implicit L after M, arc flags without separators, relative commands", () => {
  assert.deepEqual(tokens("M1 2 3 4").map((t) => t[0]), ["M", "L"]);
  assert.deepEqual(tokens("a1 1 0 01.5.5")[0][1], [1, 1, 0, 0, 1, 0.5, 0.5]);
  assert.deepEqual(lines("m2 2h4v4z"), [{ x1: 2, y1: 2, x2: 6, y2: 2 }, { x1: 6, y1: 2, x2: 6, y2: 6 }, { x1: 6, y1: 6, x2: 2, y2: 2 }]);
  assert.throws(() => tokens("L1"), /bad argument|start/);
});

test("unsafe-content: script, event handler, javascript: URL, external <use>; local #refs and data images are not unsafe", async () => {
  const r = await run({
    ...GOOD,
    s: H('<script>alert(1)</script><path d="M5 12h14"/>'),
    e: H('<path onclick="x()" d="M5 12h14"/>'),
    j: H('<a href="javascript:alert(1)"><path d="M5 12h14"/></a>'),
    u: H('<use href="https://evil.test/a.svg#x"/><path d="M5 12h14"/>'),
    ok: H('<defs><path id="p" d="M5 12h14"/></defs><use href="#p"/>'),
  });
  assert.deepEqual(r["unsafe-content"].sort(), ["e", "j", "s", "u"]);
});

test("geometry: out-of-bounds and padding from real pixels (round caps count, exact 1-unit padding passes)", async () => {
  const r = await run({
    ...GOOD,
    edge: H('<path d="M0 12h24"/>'),
    tight: H('<path d="M1.5 12h21"/>'), // cap reaches 0.5
    exact: H('<path d="M2 12h20"/>'), // cap reaches exactly 1
    ring: H('<circle cx="12" cy="12" r="10"/>'), // stroke reaches exactly 1
  });
  assert.deepEqual(r["out-of-bounds"], ["edge"]);
  assert.deepEqual(r.padding, ["tight"]);
});

test("empty-icon and viewbox rules", async () => {
  const r = await run({ ...GOOD, empty: H(""), novb: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1h4"/></svg>', big: H('<path d="M10 24h28"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"', "0 0 48 48") });
  assert.deepEqual(r["empty-icon"], ["empty"]);
  assert.deepEqual(r["viewbox-missing"], ["novb"]);
  assert.deepEqual(r["viewbox-mismatch"], ["big"]);
});

test("hardcoded-color: literal colours and the implicit black fill; currentColor and none pass; multi-colour sets are exempt", async () => {
  const files = { ...GOOD, red: H('<path stroke="#e11d48" d="M5 12h14"/>'), black: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 5h14v14H5z"/></svg>' };
  const r = await run(files, { size: 24, padding: 1, stroke: 2, linecap: "round", linejoin: "round", style: "stroke", color: "mono" });
  assert.deepEqual(r["hardcoded-color"].sort(), ["black", "red"]);
  const m = await run(files, { size: 24, padding: 1, style: "stroke", stroke: 2, linecap: "round", linejoin: "round", color: "multi" });
  assert.ok(!m["hardcoded-color"]);
});

test("stroke-mismatch: width, cap and join against the set; inherited from <g> counts", async () => {
  const r = await run({
    ...GOOD,
    thin: H('<path d="M5 12h14"/>', 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'),
    square: H('<g stroke-linecap="square"><path d="M5 12h14"/></g>'),
  });
  assert.deepEqual(r["stroke-mismatch"].sort(), ["square", "thin"]);
});

test("pixel-misaligned: 2-unit strokes on .5 coordinates blur at 1x; whole numbers pass; 1-unit strokes need .5", async () => {
  const r = await run({
    ...GOOD,
    blurry: H('<path d="M5 11.5h14"/>'),
    one: H('<path d="M5 12h14"/>', 'fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"'),
    oneok: H('<path d="M5 12.5h14"/>', 'fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"'),
  });
  assert.deepEqual(r["pixel-misaligned"].sort(), ["blurry", "one"]);
});

test("near-miss-angle: a long line 1° off horizontal; exact 45° and short angled ticks pass", async () => {
  const r = await run({ ...GOOD, crooked: H('<path d="M4 12 20 12.28"/>'), diag: H('<path d="m5 5 14 14"/>'), tick: H('<path d="M6 18.7 4 21"/><path d="M5 12h14"/>') });
  assert.deepEqual(r["near-miss-angle"], ["crooked"]);
});

test("text, raster, precision, editor junk, duplicates, names", async () => {
  const r = await run({
    ...GOOD,
    txt: H('<text x="4" y="16">A</text>'),
    img: H('<image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/>'),
    prec: H('<path d="M5.123456 12h14"/>'),
    junk: H('<!-- exported --><path d="M5 12h14" data-name="Line 1"/>'),
    "plus-two": GOOD.plus,
    Bad_Name: GOOD.circle.replace("r=\"9\"", "r=\"8\""),
  });
  assert.deepEqual(r["text-element"], ["txt"]);
  assert.deepEqual(r["embedded-raster"], ["img"]);
  assert.deepEqual(r.precision, ["prec"]);
  assert.deepEqual(r["editor-junk"], ["junk"]);
  assert.deepEqual(r["duplicate-icon"].sort(), ["plus", "plus-two"]);
  assert.deepEqual(r["name-format"], ["Bad_Name"]);
});

test("animation: no reduced-motion fallback and SMIL are flagged; a guarded CSS animation passes", async () => {
  const anim = (extra) => H(`<style>@keyframes s{to{transform:rotate(360deg)}}.a{animation:s 1s linear infinite}${extra}</style><path class="a" d="M5 12h14"/>`);
  const r = await run({
    ...GOOD,
    spin: anim(""),
    safe: anim("@media (prefers-reduced-motion:reduce){.a{animation:none}}"),
    smil: H('<path d="M5 12h14"><animate attributeName="opacity" from="1" to="0" dur="1s" repeatCount="indefinite"/></path>'),
    heavy: H('<style>@keyframes g{to{width:10px}}@media (prefers-reduced-motion:reduce){*{animation:none}}</style><path d="M5 12h14" style="animation:g 1s"/>'),
  });
  assert.deepEqual(r["animation-reduced-motion"].sort(), ["smil", "spin"]);
  assert.deepEqual(r["animation-costly"], ["heavy"]);
});

test("set balance: a much heavier icon and a tiny one stand out in a set of 8+", async () => {
  const set = {};
  for (let i = 0; i < 8; i++) set[`c${i}`] = H(`<circle cx="12" cy="12" r="${8 + (i % 2)}"/>`);
  set.heavy = H('<rect x="2" y="2" width="20" height="20" fill="currentColor"/>', 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"');
  set.tiny = H('<circle cx="12" cy="12" r="1.5"/>');
  const r = await run(set);
  assert.ok(r["weight-outlier"].includes("heavy"));
  assert.ok(r["size-outlier"].includes("tiny"));
  assert.ok(!r["weight-outlier"].some((n) => n.startsWith("c")));
});

test("parse-error on broken XML", async () => {
  const r = await run({ ...GOOD, broken: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M1 1'" });
  assert.deepEqual(r["parse-error"], ["broken"]);
});
