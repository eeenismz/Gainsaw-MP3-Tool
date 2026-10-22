// build.js: inlines src/styles.css and src/js/*.js into one file, dist/gainsaw.html.
// Node only, no dependencies. Run: node build.js
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, 'src'), DIST = path.join(__dirname, 'dist');
const OUT = path.join(DIST, 'gainsaw.html');

let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');

// Stylesheet link -> inline <style>. A literal </style> in the CSS would end the block early, so refuse to build.
const cssTag = '<link rel="stylesheet" href="styles.css">';
if (!html.includes(cssTag)) throw new Error('build: stylesheet link not found in src/index.html');
if (/<\/style/i.test(css)) throw new Error('build: src/styles.css contains </style>');
html = html.split(cssTag).join('<style>\n' + css + '</style>');

// Script tags -> inline <script>, in the same order. A </script inside JS would end the block early,
// so it is written as <\/script (identical inside strings and regex literals).
let count = 0;
html = html.replace(/<script src="js\/([\w-]+\.js)"><\/script>/g, (_, file) => {
  count++;
  const js = fs.readFileSync(path.join(SRC, 'js', file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>\n' + js + '</script>';
});
if (count === 0) throw new Error('build: no <script src="js/..."> tags found in src/index.html');

// Start from an empty dist/ so nothing stale ships. Only entries inside dist/ are touched.
fs.mkdirSync(DIST, { recursive: true });
for (const f of fs.readdirSync(DIST)) fs.rmSync(path.join(DIST, f), { recursive: true, force: true });
fs.writeFileSync(OUT, html);

const bytes = fs.statSync(OUT).size;
console.log(`Built ${OUT} (${(bytes / 1024).toFixed(1)} KB, ${count} scripts + 1 stylesheet inlined)`);
