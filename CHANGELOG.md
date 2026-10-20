# Changelog

## 1.0.0 — 2026-10-20

First release.

- `lint`: 24 rules — safety, viewBox/grid, empty and clipped artwork, padding (measured from rendered pixels),
  fixed colours, stroke width/cap/join, pixel alignment, near-miss angles, centring, set balance (ink and size
  outliers), duplicates, names, text, bitmaps, precision, editor junk, file size, animation (reduced motion, SMIL,
  costly properties). Markdown or JSON, exit code 1 on errors.
- `fix`: SVGO with icon-safe settings, currentColor for single-colour icons, pixel-diff safety net, dry run by default.
- `render`: contact sheet PNG (16/24/48, light and dark, padding guide) with a legend; single-icon PNG.
- `build`: React and Vue components (accessible by default, TypeScript types), `<zoro-icon>` web component, SVG
  sprite, `icons.json`, optimized SVGs and a searchable `preview.html`; ids prefixed per icon; refuses unsafe icons.
- `favicon`: favicon.ico (16/32/48), dark-mode favicon.svg, 96 px PNG, opaque apple-touch-icon, PWA 192/512,
  maskable 512 in the safe circle, site.webmanifest, head.html; contrast check on light and dark tabs.
- `app`: iOS 1024 default/dark/tinted plus Icon Composer layers; Android adaptive layers, XML and Play Store icon.
- `init` / `new`: grid rules from the set's majority; templates that follow them.
- Claude Code plugin, Codex metadata, `install` / `uninstall` / `doctor`; runs without `npm install`.
- Benchmarked on Lucide 1.60 (2,167 icons): 0 errors, 1 real warning.
