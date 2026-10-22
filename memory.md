# Memory

## Decisions
- 2026-10-22 Frame-level editing only, never decode + re-encode: zero quality loss, matches MP3Gain. (from SPEC §11)
- 2026-10-22 Fades are done by lowering `global_gain` per frame, so they stay lossless; 1.5 dB steps are smooth enough over 0.5 s+. (from SPEC §11)
- 2026-10-22 Leave the Xing frame untouched when not trimming, so output is byte-identical; our TOC rounding differs slightly from LAME's. (from SPEC §11)
- 2026-10-22 Drop VBRI frames on output: rare format, not worth rebuilding, playback unaffected. (from SPEC §11)
- 2026-10-22 Loudness target in LUFS, not ReplayGain 89 dB; the "MP3Gain classic" chip approximates 89 dB as -18 LUFS. (from SPEC §11)
- 2026-10-22 Classic `<script src>` tags, no ES modules, because the app must run from `file://`. (from SPEC §11)
- 2026-10-22 One file at a time, desktop Chrome first: the owner's stated use case. (from SPEC §11)

## Rejected Approaches

## Gotchas
- 2026-10-22 Front cuts can glitch for ~26 ms because the first kept frame may reference bit-reservoir data from a removed frame; a fade-in hides it. Accepted. (from SPEC §4.7)
- 2026-10-22 LAME encoder delay/padding is not updated after a trim (~25 ms effect). Accepted for now. (from SPEC §4.7)
