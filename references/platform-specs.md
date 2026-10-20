# Favicon and app icon requirements (checked 2026-10)

What `zoro-icons favicon` and `zoro-icons app` produce, and why. Re-check the sources before relying on a detail;
platforms change these rules.

## Google Search favicon
- `<link rel="icon" | "shortcut icon" | "apple-touch-icon" | "apple-touch-icon-precomposed" href="…">` on the home
  page; relative, absolute or CDN URLs work. One favicon per hostname (subdomains have their own).
- Square, at least 8×8 px; larger than 48×48 is recommended. (Older docs said "multiple of 48 px"; 48/96/192 satisfy
  both.)
- Formats: BMP, GIF, ICO, PNG, JPEG, PPM, TIFF — **SVG is not listed**, so always ship an ICO or PNG next to an SVG.
- Googlebot-Image must be able to fetch it and Googlebot the home page; keep the URL stable. Showing it is not
  guaranteed; updates take days to weeks.
- Source: https://developers.google.com/search/docs/appearance/favicon-in-search
- Check a live site with `npx zoro-seo-audit https://example.com/ --only favicon-missing`.

## Browsers
- SVG favicons: Chrome/Edge 80+, Firefox 41+, Safari macOS and iOS 26+ (https://caniuse.com/link-icon-svg).
- Safari ignores `prefers-color-scheme` inside an SVG favicon and always shows the light version
  (https://bugs.webkit.org/show_bug.cgi?id=309949). The generator therefore checks contrast on light **and** dark tab
  colours; if the icon fails on dark, use `--background`.
- Minimal set: `favicon.ico` (16/32/48) at the root (still requested directly by some browsers and tools),
  `favicon.svg`, `apple-touch-icon.png` 180×180, manifest icons 192 and 512 (`any`) and 512 `maskable`.
- `apple-touch-icon`: 180 for iPhone; iOS fills transparency with black, so it is generated opaque.
  `-precomposed` has had no effect since iOS 7.

## Web app manifest (PWA)
- Chrome's install criteria need a 192 px and a 512 px icon plus `name`/`short_name`, `start_url` and `display`
  (https://web.dev/articles/install-criteria).
- `purpose`: `any` (default), `maskable` (the platform may crop it to any shape), `monochrome` (alpha only). Do not
  combine `"any maskable"` in one icon: transparent unpadded for `any`, opaque padded for `maskable`
  (https://web.dev/articles/maskable-icon).
- Maskable safe zone: a centred circle with a radius of 40% of the icon (W3C https://www.w3.org/TR/appmanifest/).
  The generator scales the artwork so its farthest corner stays inside that circle.

## Apple (iOS / iPadOS / macOS)
- 1024×1024 canvas, square and unmasked; the system applies the mask and the Liquid Glass effects — do not bake in
  highlights, shadows or blur. Background layer full-bleed and opaque.
- Icon Composer (Xcode) builds one layered file (background + foreground groups) with Default, Dark and Mono
  (Clear / Tinted) appearances; SVG layers are preferred. `app` writes `ios/layers/background.svg` and
  `foreground.svg` to import, plus flattened PNGs for asset catalogs: default (opaque), dark (transparent background)
  and tinted (grayscale).
- Sources: https://developer.apple.com/design/human-interface-guidelines/app-icons,
  https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer,
  https://developer.apple.com/documentation/xcode/configuring-your-app-icon

## Android
- Adaptive icon layers are 108×108 dp; 72 dp is visible, the centre 66 dp is never clipped. `app` writes 432 px
  layers (xxxhdpi) with the artwork inside the 66 dp safe circle, plus `mipmap-anydpi-v26/ic_launcher.xml`.
- Provide a `monochrome` layer for themed icons (Android 13+); Android 16 QPR2 themes apps without one automatically.
- Play Store icon: 512×512, 32-bit PNG, sRGB, ≤ 1 MB, full square (Play applies the corner radius and shadow).
- Sources: https://developer.android.com/develop/ui/views/launch/icon_design_adaptive,
  https://developer.android.com/distribute/google-play/resources/icon-design-specifications

## Windows
- `browserconfig.xml` / msapplication tiles are obsolete (they served IE11 and legacy Edge). Windows uses the web
  app manifest icons; 192/512 cover the basics
  (https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/icon-theme-color).
