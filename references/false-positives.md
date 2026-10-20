# When a finding is fine

Benchmark: the 2,167 icons of Lucide 1.60 (a carefully drawn set) give 0 errors and 1 warning (`padding` on `ham`,
which really is 0.6 units from the edge). The info findings below are where judgement is needed.

## Geometry
- `off-center` — deliberately asymmetric icons (an arrow leaving a box, a badge in a corner) are off-centre by
  design. Fix only when the shape itself should be symmetric.
- `pixel-misaligned` — a trade-off: moving a line to the pixel grid can break the icon's proportions. Lucide has
  ~40 such icons. Fix it when the icon is used at exactly 1× (16/24 px UI); ignore it for icons always shown on
  high-density screens or larger.
- `near-miss-angle` — only lines longer than 1/6 of the canvas are checked; short ticks and legs that touch a circle
  are often angled on purpose. A long line 1–2° off is almost always a slip.
- `padding` — measured from rendered pixels with a 0.2-unit tolerance; anything reported is visible at large sizes.
  Some icons (wide arrows, frames) break the padding on purpose; keep them rare.

## Set balance
- `weight-outlier` — dots, ellipses and single chevrons are naturally light; very solid icons are heavy. It matters
  when two icons with the same role (toolbar, navigation) differ.
- `size-outlier` — signal bars, dots and diagonal arrows are small on purpose.
- `style-mismatch` — a solid variant inside an outline set (e.g. a filled "star" for "favourited") is intentional;
  only `fill` vs `stroke` is reported, small filled dots inside outline icons are ignored.

## Colour
- `hardcoded-color` on a brand or flag icon is expected: put such icons in a separate set with `"color": "multi"`.

## fix
- `fix` skips an icon when rounding to 3 decimals changes more than 0.2% of its pixels (a few very detailed icons).
  The original stays untouched; this is the safety net working, not an error.
