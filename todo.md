Linear: Gainsaw-MP3-Tool (https://linear.app/estains/project/gainsaw-mp3-tool-4e2a82c400d7)
# Todo

## Done
- Split `initial/Gainsaw.html` into the `src/` structure (SPEC §3) without changing behaviour (2026-10-22: code diff clean, unedited save byte-identical, +4 steps = +6.1 dB, loads from file:// with no JS errors)
- Add Node tests for `mp3.js` and `loudness.js` covering acceptance criteria 1–7 (2026-10-22: 33/33 pass via `node --test tests/`)
- Fix trimmed duration: zero LAME delay/padding on the trimmed side (2026-10-22: AC3 passes for VBR/Xing files)
- Fix K-weighting coefficients in `loudness.js` (2026-10-22: 1 kHz sine reads -20.0 LUFS)
- Add CRC, APE, MPEG-2.5 and 60-min test fixtures (2026-10-22: 54/54 pass, no bugs exposed)
- Keyboard support for trim handles: arrows = 1 frame, Shift+arrows = 1 s, Home/End (2026-10-22: headless keyboard test passes)
- Single-file dist: `node build.js` inlines everything into `dist/gainsaw.html` (2026-10-22: loads from file:// with no JS errors)
- README with usage, how it stays lossless, development and deploy (2026-10-22)
- Fix drop panel covering the waveform after load: `[hidden]` lost to `.drop{display:grid}` (2026-10-22: headless check shows drop hidden and canvas on top; 54/54 tests pass)
- Inline SVG favicon in `src/index.html` (accent-blue tile, waveform bars), carried into the single-file dist (2026-10-22: present in dist, renders at 16px, 54/54 tests pass)

## In Progress

## Pending
- LAME tag "music length" and "music CRC" are left at the original values after trim/gain (same as v1 and MP3Gain); update or zero them? (tech-reviewer warning)
- Decide whether to drop the Claude-viewer .zip save path (`src/js/zip.js`); proposed drop, waiting on owner
