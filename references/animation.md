# Animated icons

## Rules
- Every animation needs a reduced-motion fallback (WCAG 2.3.3, technique C39):
  ```css
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
  ```
  `animation-reduced-motion` flags animated icons without one.
- Prefer CSS animations over SMIL (`<animate>`). SMIL works in all current browsers
  (https://caniuse.com/svg-smil), but a media query cannot pause it, so reduced motion cannot switch it off.
- Animate `transform` and `opacity` (and `stroke-dashoffset` for line drawing); these stay smooth at 60 fps.
  Animating `d`, `width`, `x`, `r` or filters is costly. `animation-costly`
  (https://web.dev/articles/animations-guide)
- Durations: micro-interactions 100–200 ms; state changes up to about 400 ms (Material motion tokens: short
  50–200 ms, medium 250–400 ms). Loops (spinners) about 0.8–1.2 s per turn.
- Set `transform-box: fill-box; transform-origin: center` on rotating parts, or they rotate around the canvas corner.

## Quality checks (look at frames)
- The first and last frame equal the static icon, so the icon reads correctly when motion is off or paused.
- Every intermediate frame still reads as the same icon (no shapes flying off-canvas, no clipping at the padding).
- Peak speed stays calm: no more than about 30° of rotation per frame for UI icons.
- Infinite loops only for real ongoing states (loading). One-shot animations for feedback (copied, saved).

Render a frame by pausing the animation at a time with CSS (`animation-delay: -0.3s; animation-play-state: paused`)
and `node scripts/render.mjs file.svg --size 96`.
