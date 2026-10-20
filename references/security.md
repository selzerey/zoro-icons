# SVG security

SVG is XML that can run script. An icon used inline (`<svg>` in the HTML, or `dangerouslySetInnerHTML`) runs with
the page's privileges.

## Rejected by `unsafe-content` (error, blocks the build)
- Elements: `script`, `foreignObject`, `iframe`, `embed`, `object`, `audio`, `video`, `canvas`.
- Any `on*` attribute (`onload`, `onclick`, …).
- `javascript:` anywhere.
- `href` / `xlink:href` that is not a local `#fragment` (external `<use>`, `<image>` from a URL, `<a href>`).
- `<style>` with `@import` or `url()` pointing outside the file.

`embedded-raster` additionally rejects `<image>` with data URIs (not a security issue, but not an icon).

## Inline vs `<img>`
- `<img src="icon.svg">` disables scripts and blocks external resources — the safest way to show an untrusted SVG
  (https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image).
- Inline SVG and components need content you trust. Lint user uploads, or sanitize them (DOMPurify with the svg
  profile) before inlining.
- Never trust the uploaded file's Content-Type; re-encode or sanitize
  (https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## Ids
Inlined icons share one document: two icons with `id="a"` break each other's gradients and clip paths. `build`
prefixes every id with the icon name.
