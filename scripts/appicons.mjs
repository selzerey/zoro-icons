#!/usr/bin/env node
// Favicons and app icons from one square master SVG, plus checks that they stay visible.
//   node scripts/appicons.mjs favicon <master.svg> [--out public] [--color #111] [--dark-color #fff]
//        [--background #fff] [--theme-color #2563eb] [--name "My App"] [--short-name App]
//   node scripts/appicons.mjs app <master.svg> [--out app-icons] [--targets ios,android] [--background #2563eb]
//        [--color #fff] [--scale 0.8]
// favicon writes favicon.ico (16/32/48), favicon.svg (follows dark mode when --dark-color is given),
// favicon-96x96.png, apple-touch-icon.png (180, opaque), web-app-manifest-192x192.png / -512x512.png, a maskable
// 512 icon inside the 80% safe circle, site.webmanifest and head.html (the <link> tags to paste).
// app writes iOS (1024 opaque, dark and tinted variants, layer SVGs for Icon Composer) and Android (adaptive
// foreground/background/monochrome at 432 px, mipmap-anydpi-v26 XML, Play Store 512).
import fs from "node:fs";
import path from "node:path";
import { isMain, parseArgs, usageOf } from "./lib/args.mjs";
import { compose, ico, png } from "./lib/compose.mjs";
import { render, rgb, visibility } from "./lib/render.mjs";
import { measure, optimizeSvg } from "./lib/set.mjs";
import { readSvg } from "./lib/svg.mjs";

const DARK_TAB = "#202124"; // Chrome dark tab strip / dark results page
const LIGHT_TAB = "#ffffff";

async function loadMaster(file) {
  const text = fs.readFileSync(file, "utf8");
  const svg = readSvg(text);
  if (!svg.ok) throw new Error(`${file}: ${svg.error}`);
  const v = svg.viewBox;
  if (!v) throw new Error(`${file}: needs a viewBox`);
  if (Math.abs(v.w - v.h) > 1e-6) throw new Error(`${file}: viewBox must be square (${v.w}×${v.h})`);
  const m = await measure(text, v);
  if (!m.inner) throw new Error(`${file}: nothing visible`);
  // Farthest artwork corner from the centre, in viewBox units (for safe-circle scaling).
  const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
  const corners = [[m.inner.x, m.inner.y], [m.inner.x + m.inner.width, m.inner.y], [m.inner.x, m.inner.y + m.inner.height], [m.inner.x + m.inner.width, m.inner.y + m.inner.height]];
  const reach = Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return { text, svg, v, m, reach, themeable: /currentColor/i.test(text) };
}

/** Largest scale (≤ max) that keeps every artwork corner inside a centred circle of `radius` × canvas. */
const fitCircle = (master, radius, max = 1) => Math.min(max, (radius * master.v.w) / master.reach);

/** Visibility checks of a transparent favicon on light and dark tab colours, at 16 and 32 px. */
export async function faviconChecks(text, { color, darkColor }) {
  const out = [];
  for (const [bg, fg, where] of [[LIGHT_TAB, color, "light"], [DARK_TAB, darkColor ?? color, "dark"]]) {
    for (const size of [16, 32]) {
      const r = await render(compose(text, { size, color: fg, background: bg }), { size });
      const vis = visibility(r, rgb(bg));
      if (vis.contrast < 3 || vis.share < 0.03) out.push({ severity: "warn", id: "favicon-low-contrast", detail: `${size}px on a ${where} tab: contrast ${vis.contrast.toFixed(1)}:1, ${Math.round(vis.share * 100)}% of pixels visible` });
    }
  }
  return out;
}

export async function favicon(master, { out, color = "#111111", darkColor = null, background = null, themeColor = null, name = "App", shortName = null, log = console.log }) {
  const m = await loadMaster(master);
  fs.mkdirSync(out, { recursive: true });
  const w = (f, data) => fs.writeFileSync(path.join(out, f), data);
  const report = [];
  if (!m.themeable && darkColor) report.push({ severity: "info", id: "dark-variant-skipped", detail: "the master uses fixed colours, so --dark-color has no effect; draw it with currentColor" });

  // Transparent icons: favicon.ico, 96 px PNG, manifest "any" icons. On a background when --background is given.
  const opts = (size) => ({ size, color, background, radius: background ? 0.18 : 0 });
  w("favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(m.text, opts(size)) })))));
  w("favicon-96x96.png", await png(m.text, opts(96)));
  w("web-app-manifest-192x192.png", await png(m.text, opts(192)));
  w("web-app-manifest-512x512.png", await png(m.text, opts(512)));

  // SVG favicon: currentColor resolved by a <style>, switching in dark mode (Chrome, Firefox; Safari shows light).
  let svg = optimizeSvg(m.text);
  if (m.themeable) {
    const css = `:root{color:${color}}${darkColor ? `@media (prefers-color-scheme:dark){:root{color:${darkColor}}}` : ""}`;
    svg = svg.replace(/<svg\b([^>]*)>/i, `<svg$1><style>${css}</style>`);
  }
  if (background) svg = svg.replace(/<svg\b([^>]*)>/i, `<svg$1><rect x="${m.v.x}" y="${m.v.y}" width="${m.v.w}" height="${m.v.h}" rx="${m.v.w * 0.18}" fill="${background}"/>`);
  w("favicon.svg", svg + "\n");

  // Apple touch icon: opaque (iOS fills transparency with black), artwork at 80%.
  const appleBg = background ?? "#ffffff";
  w("apple-touch-icon.png", await png(m.text, { size: 180, scale: Math.min(0.8, fitCircle(m, 0.45)), color: background ? color : color, background: appleBg }));

  // Maskable: opaque, artwork inside the centred circle of radius 40% (W3C safe zone).
  const maskScale = fitCircle(m, 0.4);
  w("maskable-icon-512x512.png", await png(m.text, { size: 512, scale: maskScale, color, background: appleBg }));

  const manifest = {
    name,
    short_name: shortName ?? name,
    icons: [
      { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    ...(themeColor ? { theme_color: themeColor } : {}),
    background_color: appleBg,
    display: "standalone",
    start_url: "/",
  };
  w("site.webmanifest", JSON.stringify(manifest, null, 2) + "\n");
  w(
    "head.html",
    [
      `<link rel="icon" href="/favicon.ico" sizes="48x48">`,
      `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
      `<link rel="icon" href="/favicon-96x96.png" type="image/png" sizes="96x96">`,
      `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
      `<link rel="manifest" href="/site.webmanifest">`,
      ...(themeColor ? [`<meta name="theme-color" content="${themeColor}">`] : []),
      "",
    ].join("\n"),
  );

  report.push(...(await faviconChecks(m.text, { color: background ? color : color, darkColor: background ? color : darkColor }).then((r) => (background ? [] : r))));
  if (background) {
    // On a solid plate only the plate vs tab contrast and the art vs plate contrast matter.
    const r = await render(compose(m.text, { size: 32, color, background }), { size: 32 });
    const vis = visibility(r, rgb(background));
    if (vis.contrast < 3) report.push({ severity: "warn", id: "favicon-low-contrast", detail: `artwork vs background ${vis.contrast.toFixed(1)}:1 at 32px` });
  }
  if (maskScale < 0.5) report.push({ severity: "info", id: "maskable-small", detail: `artwork reaches the corners, so the maskable icon uses ${Math.round(maskScale * 100)}% of the canvas; a rounder or tighter master fills it better` });
  log(`favicon set → ${out}\n  favicon.ico (16, 32, 48) · favicon.svg${m.themeable && darkColor ? " (dark mode)" : ""} · favicon-96x96.png · apple-touch-icon.png · web-app-manifest-192x192.png · web-app-manifest-512x512.png · maskable-icon-512x512.png · site.webmanifest · head.html`);
  for (const r of report) log(`  ${r.severity}: ${r.id} — ${r.detail}`);
  log(`  Paste head.html into <head>, put the files at the site root, then check with: npx zoro-seo-audit https://your-site/ --only favicon-missing`);
  return report;
}

export async function appIcons(master, { out, targets = ["ios", "android"], background = "#ffffff", color = "#111111", scale = 0.8, log = console.log }) {
  const m = await loadMaster(master);
  const w = (f, data) => {
    const p = path.join(out, f);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
  };
  const files = [];
  if (targets.includes("ios")) {
    // Flattened 1024 for asset catalogs; layers for Icon Composer (square, unmasked, no effects baked in).
    w("ios/AppIcon-1024.png", await png(m.text, { size: 1024, scale, color, background }));
    w("ios/AppIcon-1024-dark.png", await png(m.text, { size: 1024, scale, color: "#ffffff", background: null }));
    w("ios/AppIcon-1024-tinted.png", await png(m.text, { size: 1024, scale, color: "#d9d9d9", background: "#000000" }));
    w("ios/layers/background.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${background}"/></svg>\n`);
    w("ios/layers/foreground.svg", compose(m.text, { size: 1024, scale, color }) + "\n");
    files.push("ios/AppIcon-1024.png", "ios/AppIcon-1024-dark.png", "ios/AppIcon-1024-tinted.png", "ios/layers/*.svg");
  }
  if (targets.includes("android")) {
    // Adaptive icon: 108dp layers (432 px at xxxhdpi); artwork inside the 66dp safe circle.
    const fg = fitCircle(m, 33 / 108, 66 / 108);
    w("android/mipmap-xxxhdpi/ic_launcher_foreground.png", await png(m.text, { size: 432, scale: fg, color }));
    w("android/mipmap-xxxhdpi/ic_launcher_monochrome.png", await png(m.text, { size: 432, scale: fg, color: "#ffffff" }));
    w("android/mipmap-xxxhdpi/ic_launcher_background.png", await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>`, { size: 432, background }));
    w(
      "android/mipmap-anydpi-v26/ic_launcher.xml",
      `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@mipmap/ic_launcher_background" />\n  <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n  <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />\n</adaptive-icon>\n`,
    );
    w("android/play-store-512.png", await png(m.text, { size: 512, scale: Math.min(scale, fitCircle(m, 0.42)), color, background }));
    files.push("android/mipmap-xxxhdpi/ic_launcher_{foreground,background,monochrome}.png", "android/mipmap-anydpi-v26/ic_launcher.xml", "android/play-store-512.png");
  }
  const report = [];
  const r = await render(compose(m.text, { size: 64, scale, color, background }), { size: 64 });
  const vis = visibility(r, rgb(background));
  if (vis.contrast < 3) report.push({ severity: "warn", id: "appicon-low-contrast", detail: `artwork vs background ${vis.contrast.toFixed(1)}:1` });
  log(`app icons → ${out}\n  ${files.join("\n  ")}`);
  for (const x of report) log(`  ${x.severity}: ${x.id} — ${x.detail}`);
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv);
  const [cmd, master] = a._;
  if (!cmd || !master || a.help) return console.log(usageOf(import.meta.url));
  if (cmd === "favicon")
    return favicon(master, { out: a.out ?? "public", color: a.color ?? "#111111", darkColor: a["dark-color"] ?? null, background: a.background ?? null, themeColor: a["theme-color"] ?? null, name: a.name ?? "App", shortName: a["short-name"] ?? null });
  if (cmd === "app") return appIcons(master, { out: a.out ?? "app-icons", targets: String(a.targets ?? "ios,android").split(","), background: a.background ?? "#ffffff", color: a.color ?? "#111111", scale: Number(a.scale ?? 0.8) });
  throw new Error(`unknown command "${cmd}" — use favicon or app`);
}

if (isMain(import.meta.url))
  main().catch((e) => {
    console.error(e.message);
    process.exit(2);
  });
