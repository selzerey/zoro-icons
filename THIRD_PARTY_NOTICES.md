# Third-party notices

## Bundled code (`scripts/lib/vendor/`)

- `svgo.mjs` — a bundle of SVGO 4.1.0 (MIT) and its dependencies (css-select, css-what, css-tree, csso, sax,
  domhandler, domutils, dom-serializer, domelementtype, entities, nth-check, boolbase, mdn-data, source-map-js;
  MIT / BSD-2-Clause / ISC / CC0).
- `resvg.mjs`, `resvg.wasm` — @resvg/resvg-wasm 2.6.2, Mozilla Public License 2.0, **unmodified**. Source:
  https://github.com/thx/resvg-js. Under the MPL these files stay under the MPL; the rest of this project is MIT.

Full license texts: [`scripts/lib/vendor/LICENSES.md`](scripts/lib/vendor/LICENSES.md).
Regenerate the bundle with `npm install && npm run vendor`.

## Ideas

Rule ideas were inspired by public discussion and open-source icon tooling (set-relative balance checks, near-miss
angle checks, contact sheets on light and dark). No code or text was copied.
