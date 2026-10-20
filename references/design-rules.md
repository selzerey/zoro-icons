# Icon design rules

Rules the linter checks are marked with their rule id. Everything else needs your eyes on the contact sheet.

## Grid and live area
- One canvas for the whole set. 24×24 is the common UI size (Lucide, Material Symbols, Heroicons, Tabler); 20 and 16
  are used for dense UIs and are best drawn separately, not scaled down. `viewbox-mismatch`
- Keep a padding (live area) on every side: 1 unit on a 24 grid (Lucide) or 2 (Material, 20 dp live area). The
  rendered artwork — strokes and round caps included — must stay inside it. `padding`, `out-of-bounds`
- Only a few icons may break the padding on purpose (wide arrows, full-bleed frames); keep them rare.

## Strokes
- One stroke width per set (2 on 24 is the most common; Heroicons outline uses 1.5). `stroke-mismatch`
- One line cap and one line join per set (round/round is friendliest at small sizes). `stroke-mismatch`
- Put stroke attributes on the root `<svg>` (or one `<g>`), not on every path, so components can override them.
- Pixel alignment at 1×: a 2-unit stroke is crisp on whole-number coordinates, a 1- or 3-unit stroke on `.5`.
  This matters for straight horizontal/vertical lines; curves are always anti-aliased. `pixel-misaligned`
- Leave at least 2 units of space between parallel strokes (Lucide), or they merge at 16 px.

## Shapes and geometry
- Use exact angles: 0°, 45°, 90°. A line 1–2° off looks like a mistake at 16 px. `near-miss-angle`
- Corner radius: one or two values per set (Lucide: 2 for shapes ≥ 8 units, 1 for smaller).
- Optical size: circles, diamonds and triangles must be drawn larger than squares to look the same size; a 20-unit
  square next to an 18-unit circle reads as "circle too small" (the opposite is true). `size-outlier` hints at this.
- Visual weight: a filled icon inside an outline set, or a very dense icon, stands out. `weight-outlier`,
  `style-mismatch`. Small filled dots inside an outline icon are fine.
- Centre the artwork box unless the metaphor is deliberately asymmetric (an arrow out of a box). `off-center`
- 1–3 shapes for system icons, a few more for product icons. Merge paths that share the same paint.
- Coordinates: at most 3 decimals; most should be whole or .5. `precision`

## Colour
- Single-colour sets use `currentColor` only, so icons follow the text colour, hover states and dark mode, and
  survive forced-colours mode. `hardcoded-color`
- A shape with no `fill` gets black by default — set `fill="none"` on outline icons. `hardcoded-color`
- Multi-colour sets: set `"color": "multi"` in zoro-icons.json and check contrast on both sheet rows.

## Content
- No `<text>` (fonts differ per device; convert to paths). `text-element`
- No embedded bitmaps. `embedded-raster`
- No scripts, event handlers or external references. `unsafe-content`

## Metaphors
- Prefer the established symbol (gear = settings, magnifier = search, trash can = delete). Novel metaphors need a
  label.
- One concept per icon; avoid detail that disappears at 16 px.
- Directional icons (arrows, back/forward) may need mirrored versions for right-to-left languages.

## Naming
- kebab-case file names (`arrow-left.svg`), noun first then modifier (`file-plus`, `user-check`). `name-format`
- Components become PascalCase (`ArrowLeft`); names must stay unique after conversion.
- One file per icon; aliases instead of duplicate files. `duplicate-icon`

## Conventions of popular open-source sets (for matching an existing style)
| Set | Canvas | Stroke | Caps / joins | Notes | License |
|---|---|---|---|---|---|
| Lucide | 24 | 2 | round / round | ≥ 1 unit padding, radius 2 or 1, ≥ 2 units between strokes | ISC (Feather-derived icons MIT) |
| Material Symbols | 24 (opsz 20–48) | variable weight 100–700 | — | variable font axes: fill, weight, grade, optical size | Apache-2.0 |
| Heroicons | 24 outline; 24/20/16 solid | 1.5 | round / round | separate solid sizes | MIT |
| Tabler | 24 | 2 | round / round | | MIT |
| Phosphor | 256 viewBox | strokes expanded | — | six weights | MIT |

Sources: lucide.dev/contribute/icon-design-guide, developers.google.com/fonts/docs/material_symbols,
github.com/tailwindlabs/heroicons, github.com/tabler/tabler-icons, github.com/phosphor-icons/core (checked 2026-10).
