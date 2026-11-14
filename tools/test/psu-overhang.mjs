// Einteilige Netzteilbox: muss ohne Stützstrukturen druckbar sein.
// Schichtweise geprüft: Was in einer Schicht nicht auf der darunterliegenden aufliegt (45°-Überhang erlaubt),
// darf nur eine Brücke bis PSU_BRIDGE_MAX sein, also keine freitragende Fläche mit größerem Innenkreis.
import { W, solid, generate, rng, between, eng } from './harness.mjs';

const DZ = 0.5;                  // Schichthöhe der Prüfung (mm)
const SLIVER = 1.2;              // Reste schmaler als 2·SLIVER sind Schlitze/Kanten, keine Brücken
const BRIDGE = 45;               // dokumentierte größte freitragende Brücke (mm), wie PSU_BRIDGE_MAX in pedalboard.js

// größter freitragender Innenkreis-Durchmesser (mm) und Höhe, in der er auftritt; Bett (unterste Schicht) ausgenommen
export function worstOverhang(mesh) {
  const m = solid(mesh), bb = m.boundingBox();
  let prev = m.slice(bb.min[2] + DZ / 2), worst = { d: 0, z: 0 };
  for (let z = bb.min[2] + DZ * 1.5; z < bb.max[2]; z += DZ) {
    const cur = m.slice(z);
    const open = cur.subtract(prev.offset(DZ, 'Miter'));              // 45°: je Schicht darf der Rand um DZ auskragen
    for (let r = SLIVER; r <= BRIDGE; r += 1) {                       // Innenkreis suchen: solange Rest bei Erosion r übrig bleibt
      const left = open.offset(-r, 'Round');
      const any = !left.isEmpty(); left.delete();
      if (!any) { if (2 * r > worst.d) worst = { d: 2 * r, z }; break; }
      if (r === BRIDGE) worst = { d: 2 * BRIDGE + 2, z };
    }
    open.delete(); prev.delete(); prev = cur;
  }
  prev.delete(); m.delete();
  return worst;
}

export default function run({ log, fail }) {
  // 1. Alle Höhen, bei denen die einteilige Box angeboten wird
  const r = rng(7);
  let checked = 0, worstAll = 0;
  for (const psuH of [18, 25, 32, 38, 40, 42, 44]) {
    for (let k = 0; k < 2; k++) {
      const cfg = { mode: 'print', psu: true, psuType: 'box', psuOne: true, psuH, psuW: between(r, 60, 110), psuL: between(r, 90, 140), hF: 60, hB: 130, W: 700, D: 320 };
      const res = generate(cfg);
      if (res.errors.length) { fail(`Konfiguration fehlerhaft: ${res.errors[0]}`); continue; }
      if (!res.info.psuOne) continue;                                // sicherer Rückfall auf zwei Hälften (Bett zu klein)
      const part = res.parts.find(p => p.group === 'psu');
      const w = worstOverhang(part.mesh);
      checked++; worstAll = Math.max(worstAll, w.d);
      if (w.d > BRIDGE) fail(`psuH ${psuH}, ${cfg.psuW}×${cfg.psuL}: freitragende Fläche mit Ø ${w.d.toFixed(0)} mm bei z ${w.z.toFixed(1)} mm (erlaubt ${BRIDGE})`);
    }
  }
  if (checked < 6) fail(`nur ${checked} einteilige Boxen geprüft – Testbasis zu dünn`);
  log(`${checked} einteilige Boxen geprüft, größte freitragende Fläche Ø ${worstAll} mm (Grenze ${BRIDGE})`);

  // 2. Oberhalb der Brückengrenze muss die Engine auf zwei Hälften zurückfallen
  for (const psuH of [45, 60]) {
    const res = generate({ mode: 'print', psu: true, psuType: 'box', psuOne: true, psuH, hF: 80, hB: 160, W: 700, D: 320 });
    if (res.errors.length) { fail(`psuH ${psuH}: Konfiguration fehlerhaft: ${res.errors[0]}`); continue; }
    if (res.info.psuOne) fail(`psuH ${psuH}: einteilige Box trotz Überschreitung der Brückengrenze`);
    if (!res.warnings.some(w => /one piece|einteilig/i.test(w))) fail(`psuH ${psuH}: keine Warnung zur Brückengrenze`);
  }

  // 3. Gegenprobe: das Prüfverfahren muss eine zu breite Brücke (60 mm) erkennen und eine schmale (30 mm) durchlassen
  const bridge = gap => {
    const C = W.Manifold.cube;
    const m = W.Manifold.union([C([10, 100, 40]), C([10, 100, 40]).translate([10 + gap, 0, 0]), C([20 + gap, 100, 5]).translate([0, 0, 40])]);
    const g = m.getMesh();
    return worstOverhang({ positions: g.vertProperties, indices: g.triVerts });
  };
  const wide = bridge(60), narrow = bridge(30);
  if (wide.d <= BRIDGE) fail(`Gegenprobe: 60-mm-Brücke nicht erkannt (Ø ${wide.d})`);
  if (narrow.d > BRIDGE) fail(`Gegenprobe: 30-mm-Brücke fälschlich beanstandet (Ø ${narrow.d})`);
  log(`Gegenprobe: 60-mm-Brücke Ø ${wide.d} mm (erkannt), 30-mm-Brücke Ø ${narrow.d} mm (ok)`);
}
