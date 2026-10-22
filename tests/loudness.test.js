'use strict';
const test = require('node:test'), assert = require('node:assert');
const { hopEnergies, gatedLoudness } = require('../src/js/loudness.js');
const H = require('./helpers.js');

test('AC6 pink.mp3 within 0.5 LU of ffmpeg ebur128', () => {
  const file = H.fixturePath('pink.mp3'), sr = 48000;
  const { chans } = H.decodeF32(file, 2, sr);
  const { E, hop } = hopEnergies(chans, sr);
  const mine = gatedLoudness(E, hop, 0, chans[0].length / sr);
  const txt = H.ff(['-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-']);
  const sum = txt.slice(txt.lastIndexOf('Summary:'));
  const m = /I:\s*(-?[\d.]+) LUFS/.exec(sum);
  assert.ok(m, 'no I: line in ebur128 summary');
  const ref = parseFloat(m[1]);
  assert.ok(Math.abs(mine - ref) <= 0.5, 'gainsaw ' + mine.toFixed(2) + ' vs ffmpeg ' + ref);
});

test('stereo 1 kHz sine, 0.1 amplitude (-20 dBFS peak), 48 kHz = -20.0 LUFS', () => {
  // Per channel mean square = 0.1^2/2 = 0.005 (-23.01 dB). Two channels sum: +3.01 dB -> -20.0.
  // K-weighting gain at 1 kHz is +0.691 dB by design, cancelling the -0.691 offset. Theory: -20.0 LUFS.
  const sr = 48000, n = sr * 10, x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = 0.1 * Math.sin(2 * Math.PI * 1000 * i / sr);
  const { E, hop } = hopEnergies([x, x], sr);
  const mine = gatedLoudness(E, hop, 0, n / sr);
  assert.ok(Math.abs(mine - (-20.0)) <= 0.1, 'got ' + mine + ' (KNOWN BUG: kCoefs shelf differs from ITU BS.1770 48k coefs, +0.438 dB at 1 kHz instead of +0.698)');
});

test('silence returns null', () => {
  const z = new Float32Array(48000 * 2);
  const { E, hop } = hopEnergies([z, z], 48000);
  assert.strictEqual(gatedLoudness(E, hop, 0, 2), null);
});
