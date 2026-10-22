Linear: Gainsaw-MP3-Tool (https://linear.app/estains/project/gainsaw-mp3-tool-4e2a82c400d7)
# Todo

## Done
- Split `initial/Gainsaw.html` into the `src/` structure (SPEC §3) without changing behaviour (2026-10-22: code diff clean, unedited save byte-identical, +4 steps = +6.1 dB, loads from file:// with no JS errors)

## In Progress

## Pending
- Add Node tests for `mp3.js` and `loudness.js` covering acceptance criteria 1–7 (SPEC §7)
- Add CRC and APE test fixtures; fix anything they expose
- Keyboard support for trim handles (focusable, arrow = 1 frame, Shift+arrow = 1 s)
- Decide on single-file dist (SPEC §3.1) and set up `dist/`
- README with usage and the "how it stays lossless" explanation
