// Netzteilbox/-halter: Jede Befestigungsschraube muss von unten mit einem Schraubendreher erreichbar sein.
// Prüfung: ein Zylinder (Schaft Ø6) von der Schraubenkopf-Auflage senkrecht nach unten darf kein Bauteil schneiden.
// Ausgenommen sind das Netzteil selbst (wird erst danach eingeschoben) und die Rückwand (wird erst nach der Box montiert).
import { W, solid, generate, eulerTo, rng, randomPsuConfig } from './harness.mjs';

const SHAFT_R = 3, REACH = 45, START = 0.4, TOL = 0.02;   // mm, mm, mm, mm³

function blockedScrews(res) {
  const screws = res.hardware.filter(h => h.type === 'screw' && h.psu);
  if (!screws.length) return null;
  const solids = res.assembly.filter(a => a.role !== 'psu' && a.role !== 'panel').map(a => ({ role: a.role, tag: a.tag, m: solid(a.mesh) }));
  let blocked = 0;
  for (const h of screws) {
    const e = h.dir.map(x => -x);                                   // Schraubendreher kommt von unten
    const col = W.Manifold.cylinder(REACH, SHAFT_R, SHAFT_R, 24).translate([0, 0, START]).rotate(eulerTo(e)).translate(h.p);
    if (solids.some(s => { const x = col.intersect(s.m); const v = x.volume(); x.delete(); return v > TOL; })) blocked++;
    col.delete();
  }
  solids.forEach(s => s.m.delete());
  return { screws: screws.length, blocked };
}

export default function run({ log, fail }) {
  const r = rng(20261012), N = 60;
  let valid = 0, screws = 0, withBox = 0;
  for (let i = 0; i < N; i++) {
    const cfg = randomPsuConfig(r);
    const res = generate(cfg);
    if (res.errors.length) continue;
    const out = blockedScrews(res);
    if (!out) continue;
    valid++; screws += out.screws; if (cfg.psuType === 'box') withBox++;
    if (out.blocked) fail(`Zugang blockiert (${out.blocked}/${out.screws} Schrauben): ${JSON.stringify(cfg)}`);
  }
  if (valid < 15) fail(`zu wenige gültige Zufallskonfigurationen (${valid} von ${N}) – Testbasis zu dünn`);
  log(`${valid} Konfigurationen, ${screws} Netzteil-Schrauben, davon ${withBox} Konfigurationen mit Box`);
}
