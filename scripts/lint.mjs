#!/usr/bin/env node
// Check an icon set (or one file) against the set's grid rules and for unsafe content.
// Usage: node scripts/lint.mjs <folder|file.svg> [--format md|json] [--out file] [--only id,id] [--skip id,id]
//        [--size 24] [--stroke 2] [--padding 1] [--color mono|multi] [--style stroke|fill|mixed]
// Rules come from zoro-icons.json next to the icons (zoro-icons init writes it) or are inferred from the majority.
// Exit code 1 when an error-level finding exists (use in CI).
import fs from "node:fs";
import { isMain, parseArgs, usageOf } from "./lib/args.mjs";
import { ICON_RULES, SET_RULES, setStats } from "./lib/rules.mjs";
import { loadSet } from "./lib/set.mjs";

const ORDER = { error: 0, warn: 1, info: 2 };

/** Run every rule; returns [{ id, severity, en, findings: [{ name, file, detail }] }], worst first. */
export function lint(set, { only, skip = [] } = {}) {
  const ctx = { config: set.config, stats: setStats(set.icons) };
  const want = (r) => (!only || only.includes(r.id)) && !skip.includes(r.id);
  const results = [];
  for (const r of ICON_RULES.filter(want)) {
    const findings = [];
    for (const icon of set.icons) {
      if (r.id !== "parse-error" && !icon.svg.ok) continue;
      let ds;
      try {
        ds = r.check(icon, ctx);
      } catch (e) {
        ds = [`RULE CRASHED: ${e.message}`];
      }
      for (const d of ds) findings.push({ name: icon.name, file: icon.file, detail: d });
    }
    if (findings.length) results.push({ id: r.id, severity: r.severity, en: r.en, findings });
  }
  for (const r of SET_RULES.filter(want)) {
    const findings = r.check(set.icons, ctx).map((f) => ({ ...f, file: set.icons.find((i) => i.name === f.name)?.file }));
    if (findings.length) results.push({ id: r.id, severity: r.severity, en: r.en, findings });
  }
  return results.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || b.findings.length - a.findings.length);
}

export function toMarkdown(set, results, { examples = 8 } = {}) {
  const n = (s) => results.filter((r) => r.severity === s).reduce((a, r) => a + r.findings.length, 0);
  const c = set.config;
  const grid = `${c.size}×${c.size}, padding ${c.padding}, ${c.style}${c.style === "stroke" ? ` ${c.stroke} ${c.linecap}/${c.linejoin}` : ""}, ${c.color}`;
  const lines = [
    `# Icon lint: ${set.dir}`,
    "",
    `${set.icons.length} icons · grid ${grid}${set.inferred ? " (inferred — run zoro-icons init to save it)" : ""} · Error ${n("error")} · Warning ${n("warn")} · Info ${n("info")}`,
    "",
  ];
  if (!results.length) lines.push("No issues found.");
  for (const sev of ["error", "warn", "info"]) {
    const group = results.filter((r) => r.severity === sev);
    if (!group.length) continue;
    lines.push(`## ${{ error: "Error", warn: "Warning", info: "Info" }[sev]}`, "");
    for (const r of group) {
      lines.push(`### ${r.en} \`${r.id}\` (${r.findings.length})`);
      for (const f of r.findings.slice(0, examples)) lines.push(`- ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
      if (r.findings.length > examples) lines.push(`- … +${r.findings.length - examples} more`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv);
  const target = a._[0];
  if (!target || a.help) return console.log(usageOf(import.meta.url));
  if (!fs.existsSync(target)) throw new Error(`not found: ${target}`);
  const set = await loadSet(target);
  for (const k of ["size", "stroke", "padding"]) if (a[k] !== undefined) set.config[k] = Number(a[k]);
  for (const k of ["color", "style", "linecap", "linejoin"]) if (a[k] !== undefined) set.config[k] = a[k];
  if (!set.icons.length) throw new Error(`no .svg files in ${target}`);
  const results = lint(set, { only: a.only?.split(","), skip: a.skip?.split(",") ?? [] });
  const out = a.format === "json"
    ? JSON.stringify({ dir: set.dir, icons: set.icons.length, config: set.config, inferred: set.inferred, summary: Object.fromEntries(["error", "warn", "info"].map((s) => [s, results.filter((r) => r.severity === s).length])), issues: results }, null, 2)
    : toMarkdown(set, results);
  if (a.out) {
    fs.writeFileSync(a.out, out);
    console.error(`report: ${a.out}`);
  } else console.log(out);
  if (results.some((r) => r.severity === "error")) process.exitCode = 1;
  return results;
}

if (isMain(import.meta.url))
  main().catch((e) => {
    console.error(e.message);
    process.exit(2);
  });
