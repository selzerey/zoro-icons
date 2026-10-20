// Copy this skill into the folders Claude Code (~/.claude/skills) and Codex (~/.agents/skills) read. Links
// (symlinks/junctions) and git clones are never deleted through: they are left alone or, with --force, unlinked.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const SKILL = "zoro-icons";
export const SKILL_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..", "..");
const FILES = ["SKILL.md", "LICENSE", "THIRD_PARTY_NOTICES.md", "package.json", "agents", "cli", "references", "scripts"];
const SKIP = new Set(["tests", "node_modules", ".env"]);

export const VERSION = JSON.parse(fs.readFileSync(path.join(SKILL_ROOT, "package.json"), "utf8")).version;

export function targets(flags, home = os.homedir(), cwd = process.cwd()) {
  const root = flags.project ? cwd : home;
  const all = { claude: path.join(root, ".claude", "skills", SKILL), codex: path.join(root, ".agents", "skills", SKILL) };
  let pick = ["claude", "codex"].filter((k) => flags[k]);
  if (!pick.length) {
    pick = flags.project ? ["claude", "codex"] : ["claude", "codex"].filter((k) => (k === "claude" ? [".claude"] : [".codex", ".agents"]).some((d) => fs.existsSync(path.join(home, d))));
    if (!pick.length) pick = ["claude", "codex"];
  }
  return pick.map((k) => [k, all[k]]);
}

const isLink = (p) => {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};
const real = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};
const same = (a, b) => real(a).toLowerCase() === real(b).toLowerCase();

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

export function install(flags = {}, { home, cwd, from = SKILL_ROOT, log = console.log } = {}) {
  const done = [];
  for (const [agent, dir] of targets(flags, home, cwd)) {
    if (isLink(dir)) {
      if (!flags.force || same(dir, from)) {
        log(`${agent}: ${dir} is a link to ${real(dir)} — ${same(dir, from) ? "already this copy" : "update that folder, or pass --force to replace the link"}`);
        continue;
      }
      fs.unlinkSync(dir);
    }
    if (fs.existsSync(dir) && same(dir, from)) {
      log(`${agent}: already running from ${dir}`);
      continue;
    }
    if (fs.existsSync(path.join(dir, ".git")) && !flags.force) {
      log(`${agent}: ${dir} is a git clone — update it with "git pull" (or pass --force to replace it)`);
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    for (const f of FILES) {
      const s = path.join(from, f);
      if (!fs.existsSync(s)) continue;
      if (fs.statSync(s).isDirectory()) copyDir(s, path.join(dir, f));
      else {
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(s, path.join(dir, f));
      }
    }
    log(`${agent}: installed ${VERSION} → ${dir}`);
    done.push([agent, dir]);
  }
  return done;
}

export function uninstall(flags = {}, { home, cwd, log = console.log } = {}) {
  const which = flags.claude || flags.codex ? flags : { ...flags, claude: true, codex: true };
  for (const [agent, dir] of targets(which, home, cwd)) {
    if (isLink(dir)) {
      fs.unlinkSync(dir);
      log(`${agent}: removed link ${dir}`);
      continue;
    }
    if (!fs.existsSync(path.join(dir, "SKILL.md"))) continue;
    if (fs.existsSync(path.join(dir, ".git")) && !flags.force) {
      log(`${agent}: ${dir} is a git clone — remove it yourself (or pass --force)`);
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    log(`${agent}: removed ${dir}`);
  }
}

export function doctor({ log = console.log } = {}) {
  log(`${SKILL} ${VERSION} · Node ${process.versions.node}${Number(process.versions.node.split(".")[0]) < 20 ? "  ✖ Node 20 or newer is required" : ""}`);
  log(`running from ${SKILL_ROOT}\n\nInstalled skill`);
  let any = false;
  for (const [agent, dir] of [...targets({ claude: true, codex: true }), ...targets({ claude: true, codex: true, project: true })]) {
    const f = path.join(dir, "SKILL.md");
    if (!fs.existsSync(f)) continue;
    any = true;
    const v = (fs.readFileSync(f, "utf8").match(/version:\s*"?([\d.]+)/) ?? [])[1] ?? "?";
    log(`  ✔ ${agent.padEnd(6)} ${v.padEnd(8)} ${dir}`);
  }
  if (!any) log(`  none — run "npx ${SKILL} install"`);
}
