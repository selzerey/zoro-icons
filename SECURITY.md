# Security

Report vulnerabilities privately through
[GitHub security advisories](https://github.com/selzerey/zoro-icons/security/advisories/new).

- Zoro Icons makes **no network requests**: parsing, rendering and building run locally.
- `lint` rejects SVGs with scripts, event handlers, `foreignObject`, `javascript:` URLs and external references
  (`unsafe-content`), and `build` refuses them, because generated components inline the markup.
- Generated components escape the `title` / `label` text.
- See [`references/security.md`](references/security.md) for how to handle user-uploaded SVGs.
