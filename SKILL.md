---
name: zoro-icons
description: Designs, checks and ships SVG icons - draws consistent icon sets on a grid, lints any SVG set for consistency (grid, padding, stroke, caps, colours, pixel alignment, balance), unsafe content and animation accessibility, optimizes them safely (pixel-checked), renders contact sheets to look at, builds React/Vue/web-component/sprite packages, and generates favicons (ICO/SVG/PNG, dark mode, maskable, manifest) and iOS/Android app icons from one master SVG. Use when the user wants new icons or an icon set, to clean up, audit or unify existing SVG icons, to turn icons into components, or needs a favicon, PWA icon or app icon. Not for photos, illustrations or logos of other companies.
license: MIT
compatibility: Requires Node.js 20+. No network access or npm install needed.
metadata:
  version: "1.0.0"
  author: selzerey
  homepage: https://github.com/selzerey/zoro-icons
---

# Zoro Icons

Make icons that look like one family, prove it with checks instead of opinion, and ship them in the formats the
project uses. All commands run from this skill's folder (the folder that contains this file); no `npm install`.

## Golden rule: look before you claim
After drawing or changing icons, **always** render a contact sheet and open the PNG:
`node scripts/render.mjs <folder> --out <folder>/icon-sheet.png` (the legend `.md` maps cells to names).
Lint passing is not enough — a lint-clean icon can still be the wrong metaphor or ugly. Fix what you see, then re-render.

## Workflow: a new icon set or new icons
1. **Grid** — `node scripts/init.mjs <folder>` writes `zoro-icons.json` (existing icons: their majority rules; empty
   folder: 24×24, padding 1, stroke 2, round caps/joins, `currentColor`). Match an existing set; never mix grids.
2. **Draw** — `node scripts/init.mjs <folder> --new <kebab-name>` creates the file with the right root attributes.
   Write the paths by hand, following `references/design-rules.md`:
   - keep artwork inside the padding (1…23 on the 24 grid); strokes and round caps count;
   - whole-number coordinates for even strokes, `.5` for odd strokes on straight horizontal/vertical lines;
   - exact 0°/45°/90° angles; 1–3 shapes for UI icons; no text, no bitmaps, no fixed colours;
   - optical balance: a circle or diamond needs to be drawn slightly larger than a square to look the same size.
3. **Check** — `node scripts/lint.mjs <folder>`; fix every `error` and `warn`; judge `info` against
   `references/false-positives.md`.
4. **Look** — render the sheet (golden rule). Compare against neighbours at 16 px and on the dark row.
5. **Clean** — `node scripts/fix.mjs <folder> --write` (SVGO, 3 decimals, editor junk, single colour → currentColor;
   any icon whose pixels would change is skipped and reported).
6. **Ship** — `node scripts/build.mjs <folder> --out <dist>` → React, Vue, `<zoro-icon>` web component, SVG sprite,
   `icons.json`, `preview.html`. Lint errors block the build (`--force` only if the user insists). Use only the
   formats the project needs (`--formats react,sprite`).

## Workflow: auditing an existing set
`node scripts/lint.mjs <folder> --format json` → report counts by rule; render the sheet; propose `fix --write` for
safe automatic fixes and list manual ones (geometry, consistency) with file names. Do not redraw icons without asking.

## Workflow: favicon and app icons
- Master: one square SVG, simple shape, no thin details (it must read at 16 px). Ask for brand colours.
- `node scripts/appicons.mjs favicon <master.svg> --out public --color "#111" --dark-color "#f5f5f5"`
  (add `--background "#2563eb"` for a coloured tile, `--theme-color`, `--name`). Writes favicon.ico (16/32/48),
  favicon.svg (dark-mode aware), favicon-96x96.png, apple-touch-icon.png (opaque), PWA 192/512 + maskable 512,
  site.webmanifest and head.html. Paste head.html into the site's `<head>`.
- `node scripts/appicons.mjs app <master.svg> --background "#2563eb" --color "#fff"` → iOS 1024 (default, dark,
  tinted, Icon Composer layers) and Android adaptive (foreground/background/monochrome, XML, Play Store 512).
- Read every warning: `favicon-low-contrast` means the icon disappears on light or dark tabs (Safari ignores the
  SVG dark-mode rule), so add a background or pick other colours. Render and look at the PNGs.
- Platform rules and sources: `references/platform-specs.md`.

## Rules (scripts/lib/rules.mjs)
| Severity | Rules |
|---|---|
| error | parse-error, unsafe-content, embedded-raster, viewbox-missing, viewbox-mismatch, empty-icon, out-of-bounds |
| warn | padding, hardcoded-color, stroke-mismatch, text-element, animation-reduced-motion, name-format, duplicate-icon |
| info | style-mismatch, pixel-misaligned, off-center, near-miss-angle, precision, editor-junk, large-file, animation-costly, weight-outlier, size-outlier |

Geometry is measured from rendered pixels (strokes, caps and joins included), not from path coordinates.

## References
- `references/design-rules.md` — grid, padding, strokes, corners, optical size, metaphors, naming, common set conventions
- `references/false-positives.md` — when a finding is fine; benchmark on 2,167 Lucide icons
- `references/platform-specs.md` — Google favicon, browsers, PWA/maskable, Apple (Icon Composer), Android adaptive, with sources
- `references/accessibility.md` — decorative vs informative icons, labels, forced colours
- `references/animation.md` — animated icons: reduced motion, durations, what to animate
- `references/security.md` — what makes an SVG unsafe and how inline vs `<img>` differ

## Guardrails
- Never redraw, copy or trace other companies' logos or trademarks, or icons from sets whose license does not allow
  it. When adapting an open-source icon, keep its license and note the source.
- Never inline an SVG that fails `unsafe-content`; uploads from users must be linted (or sanitized) first.
- Ask before rewriting many files; `fix` without `--write` shows what would change.
- Report in the user's language: what was checked, what was fixed, what still needs a human decision.
