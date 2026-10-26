# Gainsaw

Lossless MP3 trimming and volume changes, done in the browser. Your file never leaves your computer and is never re-encoded.

## Use

Open `dist/index.html` (one self-contained file) or `src/index.html` in Chrome. Both work from `file://`, so there is nothing to install or run. Fonts load from Google Fonts; offline, the page falls back to system fonts.

- **Open MP3 / drop a file:** loads an MPEG Layer III (MP3) file. Other formats are not supported.
- **Waveform:** drag the blue handles to trim the start and end. Click the waveform to move the playhead.
- **Play / Pause:** plays the kept part, with the volume and fades applied. **Space** does the same, unless focus is on a button, label or text field.
- **← / →:** move the playhead by 1 second (**Shift** for 5 seconds), unless focus is on a slider, a trim handle or the file name. A slider lets go of the keyboard after you drag it with the mouse; press Tab to reach it with the arrows again.
- **Hear start / Hear end:** plays the first or last 5 seconds of the kept part.
- **Trim card:** −1f / +1f nudge a cut by one MP3 frame (about 26 ms). **Trim silence** cuts quiet lead-in and tail (below −50 dBFS). **Reset trim** restores the full file. **Fade in / Fade out** set fades of up to 10 s.
- **Keyboard on the trim handles:** Tab to a handle, then
  - **← / →** move the cut by one frame
  - **Shift + ← / →** move the cut by 1 second
  - **Home / End** move the start handle to 0 and the end handle to the last frame (limited so the cut never inverts)
  - **Space** still plays and pauses
- **Volume card:** the gain is in 1.5 dB steps. **−** and **+** change it one step at a time. The loudness chips (−14, −16, −18 LUFS) set the step count that gets closest to the target. **Loudest without clipping** sets the largest gain whose peak stays under 0 dBFS. The preview plays with the same gain curve, and the saved file has it baked into the frames. If a boost pushes the peak past 0 dBFS, the status line turns red and warns that the file will clip. Loud songs often have little room to go up.
- **Save MP3:** writes the trimmed, volume-adjusted file. Choose **Add "-edit"** (`song-edit.mp3`, the default) or **Same name** (`song.mp3`); the page remembers your choice. The file name stays editable. The browser saves a new copy to Downloads, so the original is never overwritten (Chrome adds " (1)" if the name is already there).

## How it stays lossless

- **Trimming works on whole frames.** An MP3 is a chain of independent frames (about 26 ms each at 44.1 kHz). Gainsaw copies the frames you keep byte for byte and drops the rest, so no audio is decoded or re-encoded.
- **Volume changes the global gain field.** Each frame stores a `global_gain` value. One step changes it by 1.5 dB, which is the same method MP3Gain uses. Changing it back by the opposite number of steps restores the original.
- **Fades use the same mechanism.** Each frame's gain is stepped down (or up) across the fade, so the fade is also lossless. The steps are 1.5 dB, which is smooth enough over half a second or more.
- **The headers are rebuilt on trim.** The Xing/LAME header (VBR seek table and length) is rebuilt for the new length. If the front or end was cut, the LAME encoder delay and end padding are reset to zero so players don't drop real audio, and the header CRC is recomputed. ID3 tags (title, artist, cover art) are copied through. If nothing was trimmed, the Xing frame is left as it was, so an unedited save is byte-identical to the input.
- **Known quirk:** a front cut can cause a glitch of about 26 ms. The first kept frame can refer to bit-reservoir data that lived in a removed frame. A fade-in hides it.
- **Limits:** VBRI headers are dropped on save (playback is unaffected). Gain values that would exceed the format's ceiling are clamped, and Gainsaw shows a warning when that happens. The LAME tag's "music length" and "music CRC" keep their original values after an edit. Players ignore them, but strict validators may flag them.

## Development

Source is plain HTML, CSS and JavaScript with classic `<script>` tags, so it runs from `file://`. No build tools are needed to edit it.

- `src/index.html`: page markup
- `src/styles.css`: all styles
- `src/js/mp3.js`: frame parser and writer (trim, gain, tags, headers)
- `src/js/loudness.js`: LUFS measurement (K-weighting, gating)
- `src/js/waveform.js`: canvas waveform, drag handles, keyboard trim
- `src/js/player.js`: Web Audio playback with the gain curve applied
- `src/js/zip.js`: zip wrapper for the artifact viewer's save path
- `src/js/app.js`: file loading, UI state, save
- `initial/`: the original single-file version and the spec. Not used by the build.

Tests:

```
brew install ffmpeg lame      # only needed once, to generate fixtures
bash tests/make-fixtures.sh   # writes tests/fixtures/ (git-ignored)
node --test tests/
```

Build the single-file version:

```
node build.js                 # writes dist/index.html and clears the rest of dist/
```

## Deploy

Upload the contents of `dist/` to the web server by FTP (for example with FileZilla). `dist/` holds only `index.html`, so the folder URL opens the app. Google Fonts load from the network, so the page needs internet access for the fonts only.
