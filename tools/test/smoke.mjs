// Voreinstellungen erzeugen ohne Fehler und mit gleichen Kennzahlen wie im Referenzstand (tools/test/golden.json).
// Nach beabsichtigten Änderungen der Geometrie: npm run test:update, Unterschiede im Diff prüfen und committen.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generate, eng } from './harness.mjs';
import { buildDrawing } from '../../js/drawing.js';

const goldenFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden.json');

const CONFIGS = {
  default: {},
  'no-psu': { psu: false },
  alu: { mode: 'alu' },
  plate: { mode: 'plate' },
  'plate-clips': { mode: 'plate', clips: [{ size: '1590b', w: 60, d: 112, type: 'spring', rot: false, at: null }, { size: 'mini', w: 60, d: 112, type: 'bayonet', rot: true, at: null }] },
  bend: { bend: true, bendAngle: 8 },
  'bend-alu': { mode: 'alu', bend: true, bendAngle: -6, W: 800 },
  tiers3: { psu: false, tiers: 3, hF: 40, hB: 90, tier2Hb: 160, tier3Hb: 230, W: 700, bedX: 400, bedY: 400 },
  text: { text: 'TEST', textMode: 'engrave' },
  'psu-box': { psu: true, psuType: 'box', psuW: 94, psuL: 150, psuH: 30 },
  'psu-box-one': { psu: true, psuType: 'box', psuOne: true, psuW: 80, psuL: 130, psuH: 34 },
  'psu-bracket': { psu: true, psuType: 'bracket' },
  'psu-alu-two': { mode: 'alu', psu: true, psuCount: 2, psuW: 70, psuL: 100, psuH: 25, W: 900 },
};

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
function snapshot(res) {
  return {
    errors: res.errors.length,
    warnings: res.warnings.length,
    assembly: res.assembly.length,
    hardware: res.hardware.length,
    bom: res.bom.length,
    parts: res.parts.map(p => [p.name, p.qty, round(p.volume, 1), p.fit.ok]),
  };
}

export default function run({ log, fail, update }) {
  const now = {};
  for (const [name, cfg] of Object.entries(CONFIGS)) {
    const res = generate(cfg);
    if (res.errors.some(e => /geometry error|Geometriefehler/i.test(e))) fail(`${name}: Geometriefehler – ${res.errors.join(' | ')}`);
    for (const p of res.parts) {
      if (!(p.volume > 0) || !p.mesh.indices.length) fail(`${name}: Teil „${p.name}“ ist leer oder hat kein Volumen`);
    }
    for (const a of res.assembly) if (!a.mesh.indices.length) fail(`${name}: leeres Teil in der Baugruppe (${a.role})`);
    if (res.drawing) {                                              // Zeichnung entsteht ohne Fehler; gebogen mit Stützenkette und Neigungswinkel
      let svg = '';
      try { svg = buildDrawing(res, { ...eng.DEFAULTS, ...cfg }); } catch (e) { fail(`${name}: Zeichnung: ${e.message}`); }
      if (res.drawing.bent) {
        const sup = res.drawing.bentSup || [];
        if (sup.length !== res.drawing.supports.length || sup.some((x, i) => i && x <= sup[i - 1])) fail(`${name}: gebogene Zeichnung: Stützenpositionen ungültig`);
        const ang = res.drawing.angle.toFixed(1).replace('.', ',');
        if (svg && !(svg.includes(`${res.drawing.angle.toFixed(1)}°`) || svg.includes(`${ang}°`))) fail(`${name}: gebogene Zeichnung ohne Neigungswinkel`);
      }
    }
    now[name] = snapshot(res);
  }
  if (update) {
    fs.writeFileSync(goldenFile, JSON.stringify(now, null, 1) + '\n');
    log(`Referenzstand geschrieben (${Object.keys(now).length} Konfigurationen)`);
    return;
  }
  if (!fs.existsSync(goldenFile)) { fail('tools/test/golden.json fehlt – einmal npm run test:update ausführen'); return; }
  const gold = JSON.parse(fs.readFileSync(goldenFile, 'utf8'));
  for (const name of Object.keys(CONFIGS)) {
    const g = gold[name], n = now[name];
    if (!g) { fail(`${name}: nicht im Referenzstand`); continue; }
    for (const k of ['errors', 'warnings', 'assembly', 'hardware', 'bom']) if (g[k] !== n[k]) fail(`${name}: ${k} ${g[k]} → ${n[k]}`);
    if (g.parts.length !== n.parts.length) { fail(`${name}: Teileanzahl ${g.parts.length} → ${n.parts.length}`); continue; }
    g.parts.forEach((gp, i) => {
      const np = n.parts[i];
      if (gp[0] !== np[0] || gp[1] !== np[1] || gp[3] !== np[3]) fail(`${name}: Teil ${i}: ${JSON.stringify(gp)} → ${JSON.stringify(np)}`);
      else if (Math.abs(gp[2] - np[2]) > 0.05 + 1e-3 * gp[2]) fail(`${name}: „${gp[0]}“ Volumen ${gp[2]} → ${np[2]} cm³`);
    });
  }
  log(`${Object.keys(CONFIGS).length} Konfigurationen gegen den Referenzstand geprüft`);
}
