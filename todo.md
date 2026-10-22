Linear: Gainsaw-MP3-Tool (https://linear.app/estains/project/gainsaw-mp3-tool-4e2a82c400d7)
# Todo

## Done
- Split `initial/Gainsaw.html` into the `src/` structure (SPEC §3) without changing behaviour (2026-10-22: code diff clean, unedited save byte-identical, +4 steps = +6.1 dB, loads from file:// with no JS errors)
- Add Node tests for `mp3.js` and `loudness.js` covering acceptance criteria 1–7 (2026-10-22: 33/33 pass via `node --test tests/`)
- Fix trimmed duration: zero LAME delay/padding on the trimmed side (2026-10-22: AC3 passes for VBR/Xing files)
- Fix K-weighting coefficients in `loudness.js` (2026-10-22: 1 kHz sine reads -20.0 LUFS)
- Add CRC, APE, MPEG-2.5 and 60-min test fixtures (2026-10-22: 54/54 pass, no bugs exposed)

## In Progress

## Pending
- Keyboard support for trim handles (focusable, arrow = 1 frame, Shift+arrow = 1 s)
- Decide on single-file dist (SPEC §3.1) and set up `dist/`
- README with usage and the "how it stays lossless" explanation
