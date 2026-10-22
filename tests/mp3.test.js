'use strict';
const test = require('node:test'), assert = require('node:assert');
const { parseMp3, buildMp3 } = require('../src/js/mp3.js');
const H = require('./helpers.js');

// name -> expected {ver (3=MPEG-1, 2=MPEG-2), sr, nch}
const FIX = {
  'vbr.mp3': { ver: 3, sr: 44100, nch: 2 },
  'cbr_mono.mp3': { ver: 3, sr: 44100, nch: 1 },
  'mpeg2.mp3': { ver: 2, sr: 22050, nch: 2 },
  'pink.mp3': { ver: 3, sr: 48000, nch: 2 },
  'sr48.mp3': { ver: 3, sr: 48000, nch: 2 },
  'id3v1.mp3': { ver: 3, sr: 44100, nch: 2 },
};
const eq = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

for (const [name, exp] of Object.entries(FIX)) {
  test('AC7 parse ' + name, () => {
    const P = parseMp3(H.loadFixture(name));
    assert.strictEqual(P.first.ver, exp.ver);
    assert.strictEqual(P.first.sr, exp.sr);
    assert.strictEqual(P.first.nch, exp.nch);
    assert.ok(P.audio.length > 50);
  });

  test('AC1 no-change round trip is byte-identical ' + name, () => {
    const u = H.loadFixture(name), P = parseMp3(u);
    const r = buildMp3(P, 0, P.audio.length, () => 0);
    assert.ok(eq(r.bytes, u));
  });

  test('AC2 +4 steps = +6.0 dB, all frames still decode ' + name, () => {
    const u = H.loadFixture(name), P = parseMp3(u);
    const r = buildMp3(P, 0, P.audio.length, () => 4);
    // note: a few granules in real encodes can sit near 255 and clamp (reported, not an error)
    const out = H.writeTmp('gain.mp3', r.bytes);
    const d = H.meanVolume(out) - H.meanVolume(H.fixturePath(name));
    assert.ok(Math.abs(d - 6.0) <= 0.2, 'delta ' + d);
    assert.strictEqual(H.decodeErrors(out), '');
  });

  test('AC3 trim 2 s front / 1 s back duration ' + name, () => {
    const P = parseMp3(H.loadFixture(name)), { sr, spf } = P.first;
    const N = P.audio.length, s = Math.round(2 * sr / spf), e = N - Math.round(1 * sr / spf);
    const r = buildMp3(P, s, e, () => 0);
    const out = H.writeTmp('trim.mp3', r.bytes);
    const want = (e - s) * spf / sr, got = H.duration(out);
    assert.ok(Math.abs(got - want) <= 0.001, 'ffprobe ' + got + ' expected ' + want + ' (deficit ' + Math.round((want - got) * sr) + ' samples; ffprobe subtracts the stale LAME delay+padding when a Xing/LAME tag is kept. KNOWN BUG vs SPEC AC3, see 4.7)');
    assert.strictEqual(H.decodeErrors(out), '');
  });
}

test('AC4 ID3v2 head and ID3v1 tail survive gain + trim', () => {
  const u = H.loadFixture('id3v1.mp3'), P = parseMp3(u);
  assert.ok(P.head.length > 10 && P.tail.length === 128, 'head ' + P.head.length + ' tail ' + P.tail.length);
  const r = buildMp3(P, 10, P.audio.length - 10, () => 2).bytes;
  assert.ok(eq(r.subarray(0, P.head.length), u.subarray(0, P.head.length)));
  assert.ok(eq(r.subarray(r.length - 128), u.subarray(u.length - 128)));
  assert.strictEqual(Buffer.from(r.subarray(r.length - 128, r.length - 125)).toString(), 'TAG');
});

test('AC4 ID3v2 title tag kept in mpeg2.mp3', () => {
  const u = H.loadFixture('mpeg2.mp3'), P = parseMp3(u);
  const r = buildMp3(P, 5, 50, () => -1).bytes;
  assert.ok(eq(r.subarray(0, P.head.length), P.head));
  assert.ok(Buffer.from(r.subarray(0, P.head.length)).includes('Test'));
});

test('Xing frame rebuilt on trim: frame count and byte count match', () => {
  const P = parseMp3(H.loadFixture('vbr.mp3'));
  assert.ok(P.xing && P.xing.vbr);
  const r = buildMp3(P, 20, 120, () => 0).bytes, b = Buffer.from(r);
  const o = P.head.length + P.xing.xo + 4;
    const flags = b.readUInt32BE(o);
  assert.ok(flags & 1 && flags & 2);
  assert.strictEqual(b.readUInt32BE(o + 4), 100);
  assert.strictEqual(b.readUInt32BE(o + 8), r.length - P.head.length - P.tail.length);
});

test('clamping is counted', () => {
  const P = parseMp3(H.loadFixture('vbr.mp3'));
  const r = buildMp3(P, 0, 10, () => 300);
  assert.ok(r.clampHi > 0);
});

test('AC8 non-MP3 input throws Error', () => {
  const rnd = new Uint8Array(5000); let x = 12345;
  for (let i = 0; i < rnd.length; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; rnd[i] = (x >> 16) & 255; }
  // random bytes with no 0xFF at all are guaranteed non-MP3 (random may rarely hold two valid frames)
  for (let i = 0; i < rnd.length; i++) if (rnd[i] === 0xFF) rnd[i] = 0x7F;
  const cases = { random: rnd, text: new TextEncoder().encode('hello, this is not an mp3'), empty: new Uint8Array(0),
    tinyID3: new Uint8Array([0x49, 0x44, 0x33]), allFF: new Uint8Array(4000).fill(0xFF) };
  for (const [k, v] of Object.entries(cases)) assert.throws(() => parseMp3(v), Error, k);
});

test('AC8 truncated mp3 (first frame only) throws or parses without hanging', () => {
  const u = H.loadFixture('vbr.mp3').subarray(0, 300);
  try { parseMp3(u); } catch (e) { assert.ok(e instanceof Error); }
});
