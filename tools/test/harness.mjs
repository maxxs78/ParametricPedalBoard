// Gemeinsame Hilfen für die Prüfskripte: Engine in Node laden, Meshes in Manifold-Körper verwandeln, Zufallskonfigurationen.
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = f => pathToFileURL(path.join(root, f)).href;

export const eng = await import(url('js/pedalboard.js'));
const i18n = await import(url('js/i18n.js'));
await i18n.initI18n('en', async l => (await import(url(`js/lang/${l}.js`))).default);
await eng.initGeometry();

// eigene Manifold-Instanz für die Prüfungen (die der Engine ist nicht öffentlich)
export const W = await (await import(url('lib/manifold.js'))).default();
W.setup();

export const solid = m => W.Manifold.ofMesh(new W.Mesh({ numProp: 3, vertProperties: m.positions, triVerts: m.indices }));
export const generate = (cfg = {}) => eng.generate({ ...eng.DEFAULTS, clips: [], ...cfg });

// Euler-Winkel (x, y), die +z auf die Richtung d drehen (Manifold dreht erst um x, dann um y)
export function eulerTo(d) {
  const l = Math.hypot(...d), v = d.map(x => x / l);
  const rx = Math.asin(-v[1]);
  const ry = Math.atan2(v[0], v[2]);                                // auch für Richtungen nach unten (v[2] < 0)
  return [rx * 180 / Math.PI, ry * 180 / Math.PI, 0];
}

// Zufallszahlen mit festem Startwert, damit Fehlschläge reproduzierbar sind
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = (r, a) => a[Math.floor(r() * a.length)];
export const between = (r, lo, hi, step = 1) => lo + Math.floor(r() * ((hi - lo) / step + 1)) * step;

// Zufällige, aber plausible Konfiguration mit Netzteilbox (Maße so gewählt, dass die meisten gültig sind)
export function randomPsuConfig(r) {
  const tiers = pick(r, [1, 1, 1, 2, 3]);
  const mode = pick(r, ['print', 'alu', ...(tiers === 1 ? ['plate'] : [])]);
  const hF = between(r, 35, 70), hB = hF + between(r, 40, 90);
  return {
    mode, tiers, W: between(r, 500, 1000, 5), D: between(r, 280, 420, 5), hF, hB,
    tier2D: 220, tier2StepH: 35, tier2Hb: hB + 35 + 40, tier3D: 180, tier3StepH: 35, tier3Hb: hB + 35 + 40 + 35 + 40,   // Stufe: Vorderhöhe = Hinterhöhe davor + Stufenhöhe
    nRails: between(r, 3, 5),
    bend: r() < 0.3, bendAngle: between(r, -12, 12, 0.5),
    psu: true, psuType: pick(r, ['box', 'box', 'bracket']), psuOne: r() < 0.4,
    psuCount: between(r, 1, 2), psuL: between(r, 70, 140), psuW: between(r, 40, 110), psuH: between(r, 18, 40), psuBay: between(r, 0, 2),
  };
}
