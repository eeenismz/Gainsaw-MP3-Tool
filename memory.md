# Memory

## Decisions
- 2026-10-22 Frame-level editing only, never decode + re-encode: zero quality loss, matches MP3Gain. (from SPEC §11)
- 2026-10-22 Fades are done by lowering `global_gain` per frame, so they stay lossless; 1.5 dB steps are smooth enough over 0.5 s+. (from SPEC §11)
- 2026-10-22 Leave the Xing frame untouched when not trimming, so output is byte-identical; our TOC rounding differs slightly from LAME's. (from SPEC §11)
- 2026-10-22 Drop VBRI frames on output: rare format, not worth rebuilding, playback unaffected. (from SPEC §11)
- 2026-10-22 Loudness target in LUFS, not ReplayGain 89 dB; the "MP3Gain classic" chip approximates 89 dB as -18 LUFS. (from SPEC §11)
- 2026-10-22 Classic `<script src>` tags, no ES modules, because the app must run from `file://`. (from SPEC §11)
- 2026-10-22 One file at a time, desktop Chrome first: the owner's stated use case. (from SPEC §11)
- 2026-10-22 On trim, `buildMp3` zeroes the LAME tag's encoder delay if the front was cut and end padding if the end was cut (then recomputes the tag CRC). Leaving them stale made ffprobe/players drop 24–72 ms of real audio, more than SPEC §4.7 estimated.
- 2026-10-22 K-weighting uses the libebur128 bilinear (tan) form, not the RBJ cookbook shelf; RBJ with the same G/Q/fc read ~0.26 LU low.

- 2026-10-22 The favicon is an inline SVG `data:` URI in `src/index.html`, not a separate file, so `dist/` stays one file for FTP and the icon works from `file://`. No PNG/apple-touch-icon, because Chrome is the target and a PNG would need base64 inlining.
## Rejected Approaches
- 2026-10-22 Widening the AC3 duration tolerance to hide the trim shortfall: the shortfall was exactly the stale LAME delay+padding, so it was fixed in code instead.

## Gotchas
- 2026-10-22 Front cuts can glitch for ~26 ms because the first kept frame may reference bit-reservoir data from a removed frame; a fade-in hides it. Accepted. (from SPEC §4.7)
- 2026-10-22 Recent ffprobe/ffmpeg honour the LAME tag's delay/padding when reporting duration, so a stale tag shows up as a short file in tests.
- 2026-10-22 ffmpeg `anoisesrc` defaults to 48 kHz; the pink fixture is 48 kHz and uses `seed=1` for reproducibility.
- 2026-10-22 The LAME tag's music length (q+28) and music CRC (q+32) are not updated on save; only delay/padding and the tag CRC are. Playback is fine, strict validators may complain.
- 2026-10-22 A class with `display:` overrides the `hidden` attribute, so the drop panel stayed over the waveform after load and the handles couldn't be reached. v1 had the same bug; the Claude viewer's wrapper masked it. Fixed with a global `[hidden]{display:none!important}`. "No JS errors" checks don't catch this; check computed styles.
- 2026-10-22 In headless Chrome with `--virtual-time-budget`, `decodeAudioData` never resolves, so awaiting `load()` hangs and the page dump shows nothing. To check the UI state after a load, read the DOM on a timer instead of awaiting the full load.
- 2026-10-22 The Claude-in-Chrome extension cannot open file:// pages; use headless Chrome (`--headless=new --dump-dom`, `--allow-file-access-from-files`) for file:// checks.
