# Contributing

The most valuable contributions are **false-alarm reports** (a finding that is fine), **missed problems**, and
**benchmarks on real icon sets**.

## Setup

```bash
git clone https://github.com/selzerey/zoro-icons.git
cd zoro-icons
npm install            # only needed for tests (React/Vue rendering) and `npm run vendor`
npm test
git config core.hooksPath .githooks   # blocks commits that contain secrets
```

## Add a rule

1. Add an object to `scripts/lib/rules.mjs`: `{ id, severity, en, check(icon, ctx) → [detail] }` for one icon, or
   in `SET_RULES` `check(icons, ctx) → [{ name, detail }]` for the whole set.
2. Add a test in `scripts/tests/rules.test.mjs` with a **planted problem** and a **realistic trap** it must ignore.
3. Run it on a real set (Lucide, Tabler, your own). If it reports many icons in a careful set, it is too noisy:
   lower the severity, tighten the threshold, or document the trade-off in `references/false-positives.md`.
4. Add the rule to the tables in `SKILL.md` and `README.md`.

## Pull requests

- `npm test` and `node scripts/leak-check.mjs --all` must pass.
- Do not add icons copied from other sets or brand logos to `examples/`. Test fixtures are drawn inline in tests.
- Platform rules (favicon, iOS, Android) change: cite the official source in `references/platform-specs.md`.
