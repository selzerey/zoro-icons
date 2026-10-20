# Accessible icons

## Decorative or informative?
- **Decorative** (next to a visible text label, or purely ornamental): hide it from assistive technology with
  `aria-hidden="true"`. The generated React/Vue components and `<zoro-icon>` do this by default.
- **Informative** (the icon is the only label, e.g. an icon-only button): give it a name. On the component, pass
  `title` (React/Vue) or `label` (`<zoro-icon>`): it renders `role="img"`, `aria-label` and a `<title>`.
- For icon-only **buttons**, label the button instead and keep the icon decorative:
  `<button aria-label="Close"><X /></button>`. The accessible name belongs to the interactive element.
- Name priority: `aria-labelledby` > `aria-label` > a direct child `<title>`
  (https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/img_role).
- `focusable="false"` was only needed for Internet Explorer and legacy Edge.

## Colour and contrast
- Use `currentColor` so the icon follows the text colour, including hover, disabled and dark-mode states.
- Icons that carry meaning need 3:1 contrast against their background (WCAG 1.4.11 non-text contrast).
- Forced-colours mode (Windows high contrast) replaces `fill` and `stroke` with system colours. `currentColor`
  works automatically; fixed colours may vanish
  (https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors).
- Never rely on colour alone (a red vs green dot): add a shape difference or text.

## Size
- Touch targets: at least 24×24 CSS px (WCAG 2.5.8), 44×44 recommended for primary actions. The icon can be
  smaller than its button.
- Draw for the size you ship. Icons designed on 24 lose detail at 16; check the 16 px column of the contact sheet.

## Motion
See `animation.md`: every animated icon needs a `prefers-reduced-motion` fallback.
