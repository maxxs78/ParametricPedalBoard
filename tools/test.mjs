// Prüfläufe: npm test   (node tools/test.mjs [--update] [Teilname …])
//   i18n      Wörterbücher und Schlüsselverwendung
//   smoke     Voreinstellungen erzeugen ohne Fehler; Kennzahlen gegen tools/test/golden.json
//   access    Netzteil-Schrauben mit Schraubendreher erreichbar (Zufallskonfigurationen)
//   overhang  einteilige Netzteilbox ohne Stützstrukturen druckbar
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), update = args.includes('--update');
const only = args.filter(a => !a.startsWith('--'));
const suites = ['i18n', 'smoke', 'access', 'overhang'].filter(s => !only.length || only.includes(s));
let failed = 0;

for (const name of suites) {
  const t0 = Date.now();
  const problems = [];
  const ctx = { update, log: m => console.log('  ' + m), fail: m => problems.push(m) };
  console.log(`▶ ${name}`);
  if (name === 'i18n') {
    const r = spawnSync(process.execPath, [path.join(here, 'check-i18n.mjs')], { encoding: 'utf8' });
    if (r.status !== 0) problems.push((r.stdout + r.stderr).trim());
  } else {
    const mod = await import(pathToFileURL(path.join(here, 'test', `${{ smoke: 'smoke', access: 'psu-access', overhang: 'psu-overhang' }[name]}.mjs`)).href);
    try { await mod.default(ctx); } catch (e) { problems.push(`Ausnahme: ${e.stack || e}`); }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (problems.length) { failed++; console.log(`✗ ${name} (${secs} s)`); for (const p of problems) console.log('  - ' + p); }
  else console.log(`✓ ${name} (${secs} s)`);
}
console.log(failed ? `\n${failed} von ${suites.length} Prüfungen fehlgeschlagen` : `\nAlle ${suites.length} Prüfungen bestanden`);
process.exit(failed ? 1 : 0);
