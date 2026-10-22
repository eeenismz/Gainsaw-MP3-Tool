'use strict';
// Usage: node make-ape.js <in.mp3> <out.mp3> [withId3v1]
// Appends an APEv2 tag (header + one Title item + footer), optionally followed by a 128-byte ID3v1 tag.
const fs = require('fs');
const [, , inp, outp, v1] = process.argv;
const le32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const key = Buffer.from('Title\0'), val = Buffer.from('APE Test Title');
const item = Buffer.concat([le32(val.length), le32(0), key, val]); // size, flags, key\0, value
const mk = flags => Buffer.concat([Buffer.from('APETAGEX'), le32(2000), le32(item.length + 32), le32(1), le32(flags), Buffer.alloc(8)]);
// header flags: has header + has footer + is header; footer flags: has header + has footer
const ape = Buffer.concat([mk(0xA0000000), item, mk(0x80000000)]);
const parts = [fs.readFileSync(inp), ape];
if (v1) { const t = Buffer.alloc(128); t.write('TAG'); t.write('V1 Title', 3); parts.push(t); }
fs.writeFileSync(outp, Buffer.concat(parts));
