// Prüft die Wörterbücher: node tools/check-i18n.mjs
//  - de.js und en.js haben dieselben Schlüssel und dieselben {Platzhalter}
//  - Mehrzahl-Schlüssel (.one/.other) sind vollständig
//  - jeder im Code verwendete Schlüssel existiert (t('…'), tn('…'), tr('…'), data-i18n…)
//  - nicht verwendete Schlüssel werden gemeldet (ohne dynamisch gebildete wie f.<id>)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const load = code => new Function('module', read(`js/lang/${code}.js`).replace('export default', 'module.exports ='))({ exports: null }) ?? null;
function dict(code) {
  const m = { exports: null };
  new Function('module', read(`js/lang/${code}.js`).replace('export default', 'module.exports ='))(m);
  return m.exports;
}
const de = dict('de'), en = dict('en');
let problems = 0;
const fail = msg => { problems++; console.log('✗ ' + msg); };
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

for (const k of Object.keys(de)) if (!(k in en)) fail(`fehlt in en.js: ${k}`);
for (const k of Object.keys(en)) if (!(k in de)) fail(`fehlt in de.js: ${k}`);
for (const k of Object.keys(de)) if (k in en && ph(de[k]) !== ph(en[k])) fail(`Platzhalter verschieden bei ${k}: de {${ph(de[k])}} / en {${ph(en[k])}}`);
for (const [name, d] of [['de', de], ['en', en]]) {
  for (const k of Object.keys(d)) {
    if (k.endsWith('.one') && !(k.slice(0, -4) + '.other' in d)) fail(`${name}: ${k} ohne .other`);
    if (k.endsWith('.other') && !(k.slice(0, -6) + '.one' in d)) fail(`${name}: ${k} ohne .one`);
    if (/^\s|\s$/.test(d[k]) && !/^[ ·]|[ :·]$/.test(d[k])) fail(`${name}: ${k} hat ungewollte Leerzeichen am Rand`);
  }
}

// Verwendung im Code
const files = ['index.html', 'js/app.js', 'js/pedalboard.js', 'js/drawing.js', 'js/threemf.js'];
const calls = new Set(), plural = new Set(), mentioned = new Set();
for (const f of files) {
  const src = read(f);
  for (const m of src.matchAll(/\b(?:t|tr)\(\s*'([\w.]+)'/g)) calls.add(m[1]);
  for (const m of src.matchAll(/\btn\(\s*'([\w.]+)'/g)) plural.add(m[1]);
  for (const m of src.matchAll(/data-i18n(?:-html|-aria)?="([\w.]+)"/g)) calls.add(m[1]);
  for (const m of src.matchAll(/'([\w.]+)'/g)) mentioned.add(m[1]);
}
// dynamisch gebildete Schlüssel (f.<id>, scheme.<name> …) und per Variable gewählte Schlüssel
const dynamic = /^(f\.|g\.|scheme\.|look\.|profile\.|clipsize\.|cliptype\.|opt\.|preset\.|file\.)/;
for (const k of calls) if (!(k in de) && !k.endsWith('.')) fail(`im Code verwendet, aber nicht definiert: ${k}`);
for (const k of plural) for (const sfx of ['.one', '.other']) if (!(k + sfx in de)) fail(`tn('${k}') ohne ${k + sfx}`);
const unused = Object.keys(de).filter(k => !mentioned.has(k) && !calls.has(k) && !dynamic.test(k) && ![...plural].some(p => k === p + '.one' || k === p + '.other'));
for (const k of unused) console.log('· evtl. unbenutzt: ' + k);
console.log(`${Object.keys(de).length} Schlüssel (de), ${Object.keys(en).length} (en)` + (problems ? ` – ${problems} Problem(e)` : ' – alles konsistent'));
process.exit(problems ? 1 : 0);
