# SPEC: Gainsaw

Lossless MP3 trimmer and MP3Gain-style volume adjuster that runs entirely in the browser.

- **Status:** v1 prototype exists as a single file (`Gainsaw.html`, attach it with this spec). It works and has been tested. This spec is for turning it into a maintainable project and continuing development.
- **Owner:** Ee
- **Target:** personal desktop use in Chrome. Music files. One file at a time.

---

## 1. Goals

1. Trim the front and/or back of an MP3 **without re-encoding**.
2. Change the volume of an MP3 **without re-encoding**, the same way MP3Gain does.
3. Show enough measurement (loudness, peak, clipping) to make good volume decisions.
4. Keep everything client-side. No server, no upload, no build tools required to run.

### Non-goals (for now)

- Batch processing or album mode (see Backlog)
- Formats other than MP3 (MPEG Layer III)
- Mobile layout polish (must not break, but desktop is the priority)
- Cutting in the middle of a track or joining tracks
- Editing ID3 tags

---

## 2. Tech constraints

- Vanilla HTML, CSS and JavaScript. No framework, no npm runtime dependencies.
- Must run by double-clicking the HTML file (`file://`) in Chrome. This means:
  - Use **classic `<script src>` tags**, not ES modules (`type="module"` is blocked on `file://`).
  - No `fetch()` of local files.
- Deployable by copying the `dist/` folder via FTP.
- Node.js is allowed **for tests only** (dev dependency free, plain `node`).
- `ffmpeg` is used in tests to generate fixtures and verify output.

---

## 3. Proposed project structure

```
gainsaw/
  src/
    index.html          markup only, links css + scripts
    styles.css
    js/
      mp3.js            frame parser, gain editing, rebuild (no DOM)
      loudness.js       BS.1770 K-weighting + gated loudness (no DOM)
      zip.js            stored-zip writer + crc32 (used only inside Claude viewer)
      waveform.js       canvas drawing + handle dragging
      player.js         Web Audio preview playback
      app.js            state, wiring, UI refresh, save
  tests/
    make-fixtures.sh    ffmpeg commands that generate test MP3s
    mp3.test.js         node tests for mp3.js
    loudness.test.js    node tests for loudness.js
  dist/                 copy of src/ ready to FTP (or a single inlined file, see 3.1)
  todo.md
  memory.md
  README.md
```

`mp3.js` and `loudness.js` must stay DOM-free so Node can load them. Pattern: attach to a global namespace in the browser and `module.exports` when `module` exists.

```js
(function (root) {
  function parseMp3(u8) { /* ... */ }
  const api = { parseMp3, buildMp3 };
  if (typeof module !== 'undefined') module.exports = api;
  else root.GainsawMp3 = api;
})(this);
```

### 3.1 Optional: single-file dist

Nice to have: a tiny Node script (`build.js`, no deps) that inlines CSS and JS into `dist/gainsaw.html`, so the app is one portable file like v1. Decide during planning.

---

## 4. How the lossless trick works (core knowledge)

### 4.1 MP3 file layout

```
[ID3v2 tag(s)]  [Xing/Info or VBRI frame?]  [audio frame][audio frame]...  [APE / Lyrics3 / ID3v1 tail?]
```

- **ID3v2:** starts with `ID3`. Size is a 4-byte syncsafe integer at bytes 6..9 (7 bits per byte). Total = 10 + size, plus 10 more if the footer flag (`byte5 & 0x10`) is set. There can be more than one in a row.
- **Tail:** anything after the last valid frame that starts with `TAG`, `APETAGEX` or `LYRICS`. Copy it through unchanged.

### 4.2 Frame header (4 bytes)

| Field | Bits | Notes |
|---|---|---|
| Sync | 11 | all 1s (`0xFFE`) |
| Version | 2 | 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5, 1 = reserved |
| Layer | 2 | must be `01` (Layer III) |
| Protection | 1 | **0 means a 16-bit CRC follows the header** |
| Bitrate index | 4 | 0 and 15 invalid |
| Sample rate index | 2 | 3 invalid |
| Padding | 1 | |
| Private | 1 | |
| Channel mode | 2 | 3 = mono, else 2 channels |
| (rest) | 6 | mode ext, copyright, original, emphasis |

Bitrates (kbps):
- MPEG-1 L3: `0,32,40,48,56,64,80,96,112,128,160,192,224,256,320`
- MPEG-2/2.5 L3: `0,8,16,24,32,40,48,56,64,80,96,112,128,144,160`

Sample rates: MPEG-1 `44100,48000,32000`; MPEG-2 `22050,24000,16000`; MPEG-2.5 `11025,12000,8000`.

- Samples per frame: 1152 (MPEG-1), 576 (MPEG-2/2.5)
- Frame length in bytes: `floor(144 * bitrate / samplerate) + padding` for MPEG-1, `72 * ...` for MPEG-2/2.5

**Sync rule:** only accept a first frame if the next frame header is also valid with the same version and sample rate. On a bad header mid-stream, resync by scanning forward for two consecutive valid frames.

### 4.3 Side info and `global_gain`

Side info starts right after the header (and after the 2 CRC bytes if present).

| | Mono | Stereo |
|---|---|---|
| MPEG-1 side info | 17 bytes | 32 bytes |
| MPEG-2/2.5 side info | 9 bytes | 17 bytes |

Bit offset of each `global_gain` field (8 bits), relative to the start of side info:

- **MPEG-1:** `start = 9 + (mono ? 5 : 3) + 4 * nch`. For granule `g` in 0..1 and channel `c`: `start + (g * nch + c) * 59 + 21`
- **MPEG-2/2.5:** `start = 8 + (mono ? 1 : 2)`. For channel `c`: `start + c * 63 + 21`

(21 = `part2_3_length` 12 bits + `big_values` 9 bits.)

**Volume change:** add `n` to every `global_gain`, clamp to 0..255. Each step is exactly **1.5 dB**. If the frame has a CRC, recompute it: CRC-16, poly `0x8005`, init `0xFFFF`, not reflected, over header bytes 2..3 plus all side info bytes. Store at bytes 4..5.

Count how many values hit 255 (or 0) and report it. Clamped frames are not exactly reversible.

### 4.4 Trimming

- Keep a contiguous range of audio frames `[s, e)`.
- Copy bytes verbatim. Cut points therefore snap to frame boundaries (~26.1 ms at 44.1 kHz).

### 4.5 Xing / Info / LAME header

The first frame may be a silent metadata frame. Find it at `4 + crcBytes + sideInfoLength` from the frame start, tag `Xing` (VBR) or `Info` (CBR).

- Flags (4 bytes, big-endian) then optional fields in order: frames (4) if `&1`, bytes (4) if `&2`, TOC (100) if `&4`, quality (4) if `&8`.
- A LAME/Lavf extension tag may follow (36 bytes; 9-byte encoder string at its start). Its last 2 bytes are a CRC-16/ARC (reflected poly `0xA001`, init 0) over all frame bytes before them.

When the output is trimmed:
1. Write the new frame count and byte count (Xing frame + kept audio frames).
2. Rebuild the TOC: entry `i` = `min(255, floor(byteOffsetOfFrame(floor(i * n / 100)) / totalBytes * 256))`, offsets measured from the start of the Xing frame.
3. Recompute the LAME tag CRC if the tag is present.

**Decision:** when the full range is kept (no trim), do **not** touch the Xing frame at all. Our TOC math differs from LAME's by 1 unit in some entries, and leaving it alone keeps the output byte-identical except for the gain fields.

**VBRI** (Fraunhofer, `VBRI` at offset 36): drop that frame on output. Tell the user in the status line.

### 4.6 Lossless fades (Gainsaw's own idea)

Fades are done by lowering `global_gain` per frame, so they are lossless too.

- For frame position `t` in 0..1 across the fade length: `steps = max(-40, round(20 * log10(max(t, 1e-4)) / 1.5))` (amplitude-linear curve, floor at -60 dB).
- When fade in and fade out overlap, use the larger reduction (the minimum of the two values).
- Total per-frame delta = user gain steps + fade steps.

### 4.7 Known audio quirks (accept, document)

- **Bit reservoir:** the first kept frame can reference data from a removed frame, so a ~26 ms glitch is possible at a front cut. Usually inaudible, especially with a fade in.
- **Encoder delay/padding:** the LAME tag delay values are not updated after a trim. Effect is about 1100 samples (~25 ms). Not worth fixing now.

---

## 5. Measurement

All measurement uses `AudioContext.decodeAudioData`. Editing never depends on decoding: if decoding fails, trimming and gain still work, with a warning.

- **Loudness:** ITU-R BS.1770 integrated loudness (LUFS).
  - K-weighting = two biquads computed for the buffer's sample rate:
    - High shelf: G = 3.999843853973347 dB, Q = 0.7071752369554196, fc = 1681.974450955533 Hz
    - High pass: Q = 0.5003270373238773, fc = 38.13547087602444 Hz
  - Sum energy into 100 ms hops (all channels, weight 1.0). Blocks = 4 hops (400 ms, 75% overlap).
  - Absolute gate -70 LUFS, then relative gate -10 LU.
  - Precompute hop energies once per file so loudness of any selection is instant.
- **Peak:** per-frame sample peak (dBFS). Selection peak = max over kept frames.
- **After values:** loudness and peak + (steps x 1.5 dB).
- **Clip state:** Clean (< -0.5 dBFS), Tight (-0.5 to 0), Clips (> 0).
- **Silence detection:** per-frame RMS, threshold -50 dBFS.

---

## 6. Features and UI (as built in v1)

### Header
- Wordmark "Gainsaw", one-line tagline
- File info: name, MPEG version, sample rate, channel mode, bitrate (with "VBR ~" when bitrates vary), duration

### Waveform deck
- Empty state: drop zone + "Open MP3" button
- Canvas waveform (min/max per pixel column), time ruler at the bottom
- Kept region drawn in full color **with the gain and fades applied**, so you see the result. Cut regions are dimmed.
- Clipping marked in red at the top/bottom where amplified peaks exceed 0 dBFS
- Two draggable trim handles (blue, with grip tabs). Click elsewhere to move the playhead.
- Transport: Play/Pause (plays the selection), Hear start (first 5 s), Hear end (last 5 s), clock readout, Space to toggle

### Trim card
- Start and End readouts (`m:ss.mmm`) with -1 frame / +1 frame buttons
- Length readout
- Trim silence (-50 dBFS), Reset trim
- Fade in / Fade out sliders, 0 to 10 s in 0.5 s steps

### Volume card
- Big dB readout and step count
- Slider -16..+16 steps, plus -/+ buttons
- Loudness: before -> after (LUFS); Peak: before -> after (dBFS) + clip pill
- Target chips: Streaming -14, Apple Music -16, MP3Gain classic -18, Loudest without clipping
- Note that gain is reversible

### Export bar
- Filename input, default `<original>-edit.mp3`
- Save MP3 button + status line

### Preview playback
- `AudioBufferSourceNode -> GainNode -> destination`
- Gain node gets a `setValueCurveAtTime` curve with one value per frame, built from the same per-frame steps used for export, so the preview matches the saved file.
- Changing gain or fades while playing restarts playback from the current position (debounced 120 ms).

### Saving
- **Standalone (normal case):** Blob + `<a download>` gives a plain `.mp3`.
- **Inside the Claude artifact viewer:** downloads go through `window.claude.use('downloads')`, which does not allow `.mp3`. v1 wraps the MP3 in a stored (uncompressed) `.zip`. Keep this path only if the Claude-hosted version is still wanted.

### Design
- Light and dark themes via CSS tokens and `prefers-color-scheme`
- Fonts: Unbounded (wordmark and card titles), IBM Plex Sans (body), JetBrains Mono (readouts)
- Cool aluminium grey with a cobalt accent

---

## 7. Acceptance criteria

1. Opening and saving an MP3 with no changes produces a **byte-identical** file.
2. Gain of +4 steps raises measured mean volume by **6.0 dB** (ffmpeg `volumedetect`), with no re-encode.
3. A trim of `[s, e)` produces a file whose `ffprobe` duration equals `(e - s) * samplesPerFrame / sampleRate` (within 1 ms), for VBR files too.
4. ID3v2 at the start and ID3v1/APE at the end survive unchanged.
5. Files with CRC-protected frames still decode cleanly after a gain change.
6. Loudness reading is within **0.5 LU** of `ffmpeg -af ebur128` on the same file.
7. Works on MPEG-1 (44.1/48 kHz), MPEG-2 (22.05 kHz), mono and stereo, CBR and VBR.
8. Non-MP3 or broken files show a clear error and do not crash the page.
9. Opens and works from `file://` in Chrome.

### v1 test results (for reference)

| File | Check | Result |
|---|---|---|
| VBR stereo 44.1 kHz | +4 steps, trim 2 s front / 1 s back | -38.1 -> -32.2 dB, 10.031 -> 7.027 s (expected 7.027) |
| CBR mono 128k, no Xing | same | -35.5 -> -29.5 dB, 5.042 s (expected) |
| MPEG-2 22.05 kHz + title tag | same | -38.5 -> -32.5 dB, 5.068 s (expected) |
| Pink noise VBR | loudness | Gainsaw -25.55 LUFS vs ffmpeg -25.3 LUFS |

Not yet tested: a real CRC-protected file, files with APE tags, very long files (60+ min), MPEG-2.5.

---

## 8. Test fixtures

```bash
# VBR stereo with Xing + LAME tag
ffmpeg -f lavfi -i "sine=f=440:d=10,volume=0.2" -ac 2 -c:a libmp3lame -q:a 2 vbr.mp3
# CBR mono, no Xing frame
ffmpeg -f lavfi -i "sine=f=300:d=8,volume=0.2" -ac 1 -c:a libmp3lame -b:a 128k -write_xing 0 cbr_mono.mp3
# MPEG-2 with an ID3 title
ffmpeg -f lavfi -i "sine=f=500:d=8,volume=0.2" -ar 22050 -ac 2 -c:a libmp3lame -b:a 64k -metadata title=Test mpeg2.mp3
# Loudness reference
ffmpeg -f lavfi -i "anoisesrc=d=12:c=pink:a=0.3" -ac 2 -c:a libmp3lame -q:a 2 pink.mp3

# Verify
ffmpeg -i out.mp3 -af volumedetect -f null -
ffprobe -v error -show_entries format=duration -of csv=p=0 out.mp3
ffmpeg -i pink.mp3 -af ebur128 -f null -
```

For a CRC fixture: `lame --cbr -b 128 -p in.wav crc.mp3` (needs the `lame` CLI).

---

## 9. Suggested first tasks (seed for todo.md)

1. Split `Gainsaw.html` into the structure in section 3 without changing behaviour.
2. Add Node tests for `mp3.js` and `loudness.js` covering acceptance criteria 1 to 7.
3. Add the CRC and APE fixtures; fix anything they expose.
4. Keyboard support for the trim handles (focusable handles, arrow = 1 frame, Shift+arrow = 1 s).
5. Decide on single-file dist (3.1) and set up `dist/`.
6. README with usage and the "how it stays lossless" explanation.

---

## 10. Backlog (ideas, not committed)

- **Album mode:** load several files, set one gain so they share loudness while keeping their relative levels
- **Undo tag:** store the applied gain in an APE tag like MP3Gain (`MP3GAIN_UNDO`) so it can be reverted later
- **Set exact times:** type a start/end time instead of dragging
- **Zoom** into the waveform near each handle for precise cuts
- **Remember last target** in localStorage
- **Gapless-aware trim:** update the LAME tag encoder delay/padding after a cut
- **PWA** so it installs like a desktop app and works offline

---

## 11. Decisions log (copy into memory.md)

| Decision | Why |
|---|---|
| Frame-level editing, never decode + re-encode | Zero quality loss, matches MP3Gain |
| Fades via per-frame `global_gain` | Keeps fades lossless; 1.5 dB steps are smooth enough over 0.5 s+ |
| Leave Xing frame untouched when not trimming | Byte-identical output; our TOC rounding differs slightly from LAME |
| Drop VBRI frames | Rare format, rebuilding it is not worth it; playback unaffected |
| Loudness target in LUFS, not ReplayGain 89 dB | Modern standard; "MP3Gain classic" chip approximates 89 dB as -18 LUFS |
| Classic scripts, no ES modules | Must work from `file://` |
| One file at a time, desktop first | Owner's stated use case |
