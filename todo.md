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
- ←/→ move the playhead 1 s (Shift = 5 s) when focus isn't on a slider, trim handle or text field (2026-10-26: checked in Chrome via MAMP, 54/54 tests pass)
- Sliders release focus after a mouse drag, so arrows don't keep changing the volume after you click it (2026-10-26: checked in Chrome)
- Build writes `dist/index.html` instead of `dist/gainsaw.html`, so the folder URL opens the app (2026-10-26)
- Volume "no difference" report: gain works; loud tracks already peak near 0 dBFS so a boost only clips. Raising gain past 0 dBFS now shows a red status saying so (2026-10-26: tester-quality 4/4 pass on loud and quiet files, 54/54 tests)
- Review follow-ups: held ←/→ no longer restarts playback 30×/s, ←/→ while playing stays inside the kept part, the clip warning clears once the gain no longer clips (2026-10-26: checked in Chrome, 54/54 tests)

## In Progress

## Pending
- LAME tag "music length" and "music CRC" are left at the original values after trim/gain (same as v1 and MP3Gain); update or zero them? (tech-reviewer warning)
- Decide whether to drop the Claude-viewer .zip save path (`src/js/zip.js`); proposed drop, waiting on owner
