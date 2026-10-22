'use strict';
// Shared helpers for Gainsaw tests. Needs ffmpeg/ffprobe (Homebrew path added below).
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const FF = process.env.FFBIN || '/opt/homebrew/bin';
const FFMPEG = path.join(FF, 'ffmpeg'), FFPROBE = path.join(FF, 'ffprobe');
const FIX = path.join(__dirname, 'fixtures');

function fixturePath(name) {
  const p = path.join(FIX, name);
  if (!fs.existsSync(p)) throw new Error('Missing fixture ' + name + '. Run: bash tests/make-fixtures.sh');
  return p;
}
function loadFixture(name) { return new Uint8Array(fs.readFileSync(fixturePath(name))); }
function tmpFile(name) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gainsaw-'));
  return path.join(d, name);
}
function writeTmp(name, bytes) { const p = tmpFile(name); fs.writeFileSync(p, bytes); return p; }
function ff(args) { // run ffmpeg, return stderr text
  const r = require('child_process').spawnSync(FFMPEG, ['-hide_banner', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  return (r.stderr || '') + (r.stdout || '');
}
function meanVolume(file) {
  const m = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(ff(['-i', file, '-af', 'volumedetect', '-f', 'null', '-']));
  if (!m) throw new Error('volumedetect gave no mean_volume');
  return parseFloat(m[1]);
}
function duration(file) {
  return parseFloat(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }));
}
// Decode to float32 PCM, returns {sr, chans:[Float32Array...]} (planar split).
function decodeF32(file, nch, sr) {
  const buf = execFileSync(FFMPEG, ['-v', 'error', '-i', file, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', String(nch), '-ar', String(sr), '-'], { maxBuffer: 1 << 29 });
  const all = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length - (buf.length % 4)));
  const n = Math.floor(all.length / nch), chans = [];
  for (let c = 0; c < nch; c++) { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = all[i * nch + c]; chans.push(a); }
  return { sr, chans };
}
function decodeErrors(file) { return ff(['-v', 'error', '-i', file, '-f', 'null', '-']).trim(); }
module.exports = { FFMPEG, FFPROBE, loadFixture, fixturePath, writeTmp, tmpFile, ff, meanVolume, duration, decodeF32, decodeErrors };
