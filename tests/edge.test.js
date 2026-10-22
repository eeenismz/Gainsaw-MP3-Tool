'use strict';
// Edge-case tests: CRC-protected frames, APE tags, MPEG-2.5, very long files.
const test = require('node:test'), assert = require('node:assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { parseMp3, buildMp3 } = require('../src/js/mp3.js');
const H = require('./helpers.js');
const eq = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

// Independent CRC-16 (poly 0x8005, init 0xFFFF, MSB first) over header bytes 2..3 + side info.
function crc16(bytes) {
  let crc = 0xFFFF;
  for (const x of bytes) {
    crc ^= x << 8;
    for (let k = 0; k < 8; k++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x8005) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc;
}
// Side info length from the raw header bytes (not using src helpers).
function sideLen(u, p) {
  const mpeg1 = ((u[p + 1] >> 3) & 3) === 3, mono = ((u[p + 3] >> 6) & 3) === 3;
  return mpeg1 ? (mono ? 17 : 32) : (mono ? 9 : 17);
}
function checkAllCrcs(P, bytes) { // every CRC-protected frame in the output must carry a valid CRC
  const Q = parseMp3(bytes); let n = 0;
  for (const f of Q.audio) {
    const p = f.off;
    assert.ok(f.h.crc, 'frame at ' + p + ' lost its CRC flag');
    const sl = sideLen(bytes, p);
    const want = crc16([bytes[p + 2], bytes[p + 3], ...bytes.subarray(p + 6, p + 6 + sl)]);
    const got = (bytes[p + 4] << 8) | bytes[p + 5];
    assert.strictEqual(got, want, 'bad CRC at frame offset ' + p);
    n++;
  }
  assert.ok(n > 50);
}

for (const name of ['crc.mp3', 'crc_vbr.mp3']) {
  test('CRC detected on frames ' + name, () => {
    const P = parseMp3(H.loadFixture(name));
    assert.ok(P.audio.length > 50);
    assert.ok(P.audio.every(f => f.h.crc === true));
  });
  test('CRC AC1 round trip is byte-identical ' + name, () => {
    const u = H.loadFixture(name), P = parseMp3(u);
    assert.ok(eq(buildMp3(P, 0, P.audio.length, () => 0).bytes, u));
  });
  for (const steps of [4, -3]) {
    test('CRC valid after ' + steps + ' steps ' + name, () => {
      const P = parseMp3(H.loadFixture(name));
      const r = buildMp3(P, 0, P.audio.length, () => steps);
      checkAllCrcs(P, r.bytes);
      const out = H.writeTmp('crc.mp3', r.bytes);
      assert.strictEqual(H.decodeErrors(out), ''); // AC5
      if (steps === 4) {
        const d = H.meanVolume(out) - H.meanVolume(H.fixturePath(name));
        assert.ok(Math.abs(d - 6.0) <= 0.2, 'delta ' + d);
      }
    });
  }
  test('CRC valid after trim + gain ' + name, () => {
    const P = parseMp3(H.loadFixture(name));
    const r = buildMp3(P, 20, P.audio.length - 20, () => 2);
    checkAllCrcs(P, r.bytes);
    assert.strictEqual(H.decodeErrors(H.writeTmp('crc.mp3', r.bytes)), '');
  });
}

// ---- APE tags ----
const APE_LEN = 32 + (8 + 6 + 14) + 32; // header + one Title item + footer (see make-ape.js)
for (const [name, extra] of [['ape.mp3', 0], ['ape_id3v1.mp3', 128]]) {
  test('APE AC1 round trip ' + name, () => {
    const u = H.loadFixture(name), P = parseMp3(u);
    assert.ok(eq(buildMp3(P, 0, P.audio.length, () => 0).bytes, u));
  });
  test('APE tail kept verbatim and not parsed as audio ' + name, () => {
    const u = H.loadFixture(name), P = parseMp3(u);
    const base = parseMp3(H.loadFixture('vbr.mp3'));
    assert.strictEqual(P.audio.length, base.audio.length, 'audio frame count differs from tag-less file');
    assert.strictEqual(P.tail.length, APE_LEN + extra);
    assert.strictEqual(Buffer.from(P.tail.subarray(0, 8)).toString(), 'APETAGEX');
    // cross-check with ffprobe (it also counts the Xing frame as a packet in some builds: accept N or N+1)
    const n = parseInt(execFileSync(H.FFPROBE, ['-v', 'error', '-count_packets', '-select_streams', 'a:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', H.fixturePath(name)], { encoding: 'utf8' }));
    assert.ok(n === P.audio.length || n === P.audio.length + 1, 'ffprobe packets ' + n + ' vs ' + P.audio.length);
  });
  test('APE tail byte-identical after gain + trim ' + name, () => {
    const u = H.loadFixture(name), P = parseMp3(u);
    const r = buildMp3(P, 10, P.audio.length - 10, () => 3).bytes;
    const t = APE_LEN + extra;
    assert.ok(eq(r.subarray(r.length - t), u.subarray(u.length - t)));
    const out = H.writeTmp('ape.mp3', r);
    assert.strictEqual(H.decodeErrors(out), '');
    assert.strictEqual(parseMp3(r).audio.length, P.audio.length - 20);
  });
}

// ---- MPEG-2.5 ----
test('MPEG-2.5 parses (ver 0, 11025 Hz, mono)', () => {
  const P = parseMp3(H.loadFixture('mpeg25.mp3'));
  assert.strictEqual(P.first.ver, 0);
  assert.strictEqual(P.first.sr, 11025);
  assert.strictEqual(P.first.nch, 1);
  assert.strictEqual(P.first.spf, 576);
  assert.ok(P.audio.length > 50);
});
test('MPEG-2.5 AC1 round trip', () => {
  const u = H.loadFixture('mpeg25.mp3'), P = parseMp3(u);
  assert.ok(eq(buildMp3(P, 0, P.audio.length, () => 0).bytes, u));
});
test('MPEG-2.5 AC2 +4 steps = +6.0 dB, decodes clean', () => {
  const P = parseMp3(H.loadFixture('mpeg25.mp3'));
  const out = H.writeTmp('g.mp3', buildMp3(P, 0, P.audio.length, () => 4).bytes);
  const d = H.meanVolume(out) - H.meanVolume(H.fixturePath('mpeg25.mp3'));
  assert.ok(Math.abs(d - 6.0) <= 0.2, 'delta ' + d);
  assert.strictEqual(H.decodeErrors(out), '');
});
test('MPEG-2.5 AC3 trim duration within 1 ms', () => {
  const P = parseMp3(H.loadFixture('mpeg25.mp3')), { sr, spf } = P.first;
  const N = P.audio.length, s = Math.round(2 * sr / spf), e = N - Math.round(1 * sr / spf);
  const out = H.writeTmp('t.mp3', buildMp3(P, s, e, () => 0).bytes);
  const want = (e - s) * spf / sr, got = H.duration(out);
  assert.ok(Math.abs(got - want) <= 0.001, 'ffprobe ' + got + ' expected ' + want + ' (deficit ' + Math.round((want - got) * sr) + ' samples; likely stale LAME delay/padding, see SPEC 4.7)');
});

// ---- long file ----
test('60-minute 32k mono file: parse + no-op build < 5 s, byte-identical', (t) => {
  const out = H.tmpFile('long.mp3');
  const t0 = Date.now();
  try {
    execFileSync(H.FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=300:d=3600', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '32k', out], { timeout: 90000 });
  } catch (e) { return t.skip('long file generation failed/too slow: ' + e.message); }
  console.log('# generated 60 min fixture in ' + (Date.now() - t0) + ' ms');
  const u = new Uint8Array(fs.readFileSync(out));
  const t1 = Date.now();
  const P = parseMp3(u);
  const r = buildMp3(P, 0, P.audio.length, () => 0);
  const ms = Date.now() - t1;
  assert.ok(ms < 5000, 'parse+build took ' + ms + ' ms');
  assert.ok(P.audio.length > 3600 * 44100 / 1152 - 5);
  assert.ok(eq(r.bytes, u));
});
