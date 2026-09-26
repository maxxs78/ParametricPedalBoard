// Technische Zeichnung (A3 quer, Projektionsmethode 1) als SVG
// Ansichten: Vorderansicht, Seitenansicht von links (rechts daneben), Draufsicht (darunter),
// Schnitt A–A durch eine Schiene, Stücklisten und Schriftfeld.

const SHEET = { w: 420, h: 297 };
const SCALES = [1, 2, 2.5, 3, 4, 5, 7.5, 10, 15, 20, 25, 50];
const LW = { vis: 0.5, thin: 0.25, hid: 0.3, dim: 0.18, frame: 0.7 };
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

const f1 = v => (Math.round(v * 10) / 10).toLocaleString('de-DE', { maximumFractionDigits: 1 });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function buildDrawing(result, params) {
  const d = result.drawing;
  if (!d) return null;
  const out = [];
  const push = s => out.push(s);

  // ---------------------------------------------------------------- Maßstab und Anordnung
  const view = { x0: 28, y0: 16, x1: 410, y1: 196 };
  const dimPad = 16;
  let k = 1;
  for (const sc of SCALES) {
    const s = 1 / sc;
    const wNeed = d.W * s + 30 + d.D * s + 2 * dimPad;
    const hNeed = d.hB * s + 26 + d.D * s + 2 * dimPad;
    if (wNeed <= view.x1 - view.x0 && hNeed <= view.y1 - view.y0) { k = sc; break; }
    k = sc;
  }
  const s = 1 / k;
  const fx = view.x0 + dimPad;                        // Vorderansicht: Ursprung links unten
  const fy = view.y0 + dimPad + d.hB * s;
  const sx = fx + d.W * s + 30;                       // Seitenansicht (von links) rechts daneben
  const tyBase = fy + 26 + d.D * s;                   // Draufsicht darunter (y nach oben)

  const F = (x, z) => [fx + x * s, fy - z * s];
  const Sd = (y, z) => [sx + (d.D - y) * s, fy - z * s];
  const T = (x, y) => [fx + x * s, tyBase - y * s];

  // ---------------------------------------------------------------- Zeichenhelfer
  const pts = arr => arr.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const line = (a, b, cls = 'v') => push(`<line class="${cls}" x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}"/>`);
  const polygon = (arr, cls = 'v', fill = true) => push(`<polygon class="${cls}${fill ? ' f' : ''}" points="${pts(arr)}"/>`);
  const polyline = (arr, cls = 'v') => push(`<polyline class="${cls}" points="${pts(arr)}"/>`);
  const rectP = (a, b, cls = 'v', fill = true) => polygon([a, [b[0], a[1]], b, [a[0], b[1]]], cls, fill);
  // Rechteck mit verrundeten Ecken (Papierkoordinaten a, b; Radius in Papier-mm)
  const rrect = (a, b, r, cls = 'v') => {
    const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]), wd = Math.abs(b[0] - a[0]), ht = Math.abs(b[1] - a[1]);
    push(`<rect class="${cls}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${wd.toFixed(2)}" height="${ht.toFixed(2)}" rx="${Math.min(r, wd / 2, ht / 2).toFixed(2)}"/>`);
  };
  const circ = (c, r, cls = 'v') => push(`<circle class="${cls}" cx="${c[0].toFixed(2)}" cy="${c[1].toFixed(2)}" r="${r.toFixed(2)}"/>`);
  const text = (p, str, size = 2.5, anchor = 'middle', extra = '') =>
    push(`<text x="${p[0].toFixed(2)}" y="${p[1].toFixed(2)}" font-size="${size}" text-anchor="${anchor}" ${extra}>${esc(str)}</text>`);
  const arrow = (tip, dir) => {
    const [dx, dy] = dir, l = 2.6, wdt = 0.9;
    const bx = tip[0] - dx * l, by = tip[1] - dy * l;
    push(`<polygon class="arr" points="${pts([tip, [bx - dy * wdt, by + dx * wdt], [bx + dy * wdt, by - dx * wdt]])}"/>`);
  };
  // lineare Maße (Papierkoordinaten); off > 0 = nach oben bzw. links versetzt
  const dimH = (a, b, yLine, label) => {
    line([a[0], a[1]], [a[0], yLine + Math.sign(yLine - a[1]) * 1.5], 'd');
    line([b[0], b[1]], [b[0], yLine + Math.sign(yLine - b[1]) * 1.5], 'd');
    line([a[0], yLine], [b[0], yLine], 'd');
    const dir = Math.sign(b[0] - a[0]) || 1;
    arrow([a[0], yLine], [-dir, 0]); arrow([b[0], yLine], [dir, 0]);
    text([(a[0] + b[0]) / 2, yLine - 0.9], label, 2.5);
  };
  const dimV = (a, b, xLine, label) => {
    line([a[0], a[1]], [xLine + Math.sign(xLine - a[0]) * 1.5, a[1]], 'd');
    line([b[0], b[1]], [xLine + Math.sign(xLine - b[0]) * 1.5, b[1]], 'd');
    line([xLine, a[1]], [xLine, b[1]], 'd');
    const dir = Math.sign(b[1] - a[1]) || 1;
    arrow([xLine, a[1]], [0, -dir]); arrow([xLine, b[1]], [0, dir]);
    const cy = (a[1] + b[1]) / 2;
    text([xLine - 0.9, cy], label, 2.5, 'middle', `transform="rotate(-90 ${(xLine - 0.9).toFixed(2)} ${cy.toFixed(2)})"`);
  };
  const title = (p, str) => text(p, str, 3.5, 'start', 'font-weight="bold"');

  // ---------------------------------------------------------------- Vorderansicht (X–Z), Maler-Algorithmus
  const frontItems = [];
  for (const r of d.rails) {
    const segs = [[d.capT, ...d.supports.flatMap(c => [c - d.supT / 2, c + d.supT / 2]), d.W - d.capT]];
    const e = segs[0];
    for (let i = 0; i < e.length; i += 2) frontItems.push({ depth: (r.ymin + r.ymax) / 2, draw: () => rectP(F(e[i], r.zmin), F(e[i + 1], r.zmax)) });
  }
  for (const q of d.psus) frontItems.push({ depth: (q.ymin + q.ymax) / 2, draw: () => rectP(F(q.x0, q.zmin), F(q.x1, q.zmax)) });
  for (const b of d.braces) frontItems.push({ depth: b.y, draw: () => rectP(F(d.railX0, b.z0), F(d.W - d.railX0, b.z0 + b.h)) });
  if (d.back) frontItems.push({ depth: d.D + 1, draw: () => {
    rectP(F(0, 0), F(d.W, d.hB));
    for (const c of d.back.cutouts) rrect(F(c.x0, c.z0), F(c.x1, c.z1), (c.r || 0) * s);
  } });
  frontItems.sort((a, b) => b.depth - a.depth).forEach(it => it.draw());
  const sideBlock = (x0, x1) => {
    rectP(F(x0, 0), F(x1, d.hB));
    line(F(x0, d.hF), F(x1, d.hF), 'v');
  };
  sideBlock(0, d.capT); sideBlock(d.W - d.capT, d.W);
  d.supports.forEach(c => sideBlock(c - d.supT / 2, c + d.supT / 2));
  // Mittellinien der Stützen
  d.supports.forEach(c => line(F(c, -3), F(c, d.hB + 3), 'c'));
  // Maße
  dimH(F(0, d.hB), F(d.W, d.hB), F(0, d.hB)[1] - 8, f1(d.W));
  dimV(F(0, 0), F(0, d.hF), F(0, 0)[0] - 7, f1(d.hF));
  let prev = 0;
  const chainY = fy + 7;
  [...d.supports, d.W].forEach((c, i, arr) => {
    const x = i === arr.length - 1 ? d.W : c;
    dimH(F(prev, 0), F(x, 0), chainY, f1(x - prev));
    prev = x;
  });
  title([fx, view.y0 + 1], 'Vorderansicht');

  // ---------------------------------------------------------------- Seitenansicht von links (Y–Z)
  // Kontur mit Fenstern (Löcher werden über evenodd ausgespart)
  const outlinePath = d.outline.map(pg => 'M' + pts(pg.map(p => Sd(p[0], p[1]))).replace(/ /g, ' L') + ' Z').join(' ');
  push(`<clipPath id="sideclip"><path d="${outlinePath}"/></clipPath>`);
  push(`<path class="v f" fill-rule="evenodd" d="${outlinePath}"/>`);
  // Taschen für die Schienen (von außen unsichtbar)
  push('<g clip-path="url(#sideclip)">');
  for (const pg of d.notches) polygon(pg.map(p => Sd(p[0], p[1])), 'h', false);
  push('</g>');
  // verdeckt: Netzteil und Halter hinter der Endkappe
  for (const q of d.psus.slice(0, 1)) { polygon(q.wall.map(p => Sd(p[0], p[1])), 'h', false); polygon(q.box.map(p => Sd(p[0], p[1])), 'h', false); }
  for (const b of d.braces) rectP(Sd(b.y - b.w / 2, b.z0), Sd(b.y + b.w / 2, b.z0 + b.h), 'h', false);
  if (d.back) rectP(Sd(d.D, 0), Sd(d.D + d.back.t, d.hB));
  // Senkungen Endkappe
  for (const c of d.cb) { circ(Sd(c.y, c.z), c.r * s); circ(Sd(c.y, c.z), c.r2 * s, 'thin'); }
  // Teilungsfugen mit Schwalbenschwanz, Laschen verdeckt, Mutterntaschen sichtbar
  for (const c of d.cuts) {
    const path = [[c.c, 0]];
    for (const t of [...c.tails].sort((a, b) => a.zc - b.zc)) {
      path.push([c.c, t.zc - t.nw / 2], [c.c + c.dd, t.zc - t.tw / 2], [c.c + c.dd, t.zc + t.tw / 2], [c.c, t.zc + t.nw / 2]);
    }
    path.push([c.c, c.top]);
    polyline(path.map(p => Sd(p[0], p[1])), 'v');
    if (c.splice) {
      const sp = c.splice;
      rectP(Sd(sp.y0, sp.z0), Sd(sp.y1, sp.z1), 'h', false);
      for (const y of sp.cols) for (const z of sp.rows) {
        const r = 7.3 / Math.sqrt(3) * s, [cx, cy] = Sd(y, z);
        polygon([0, 1, 2, 3, 4, 5].map(i => [cx + r * Math.cos(Math.PI / 3 * i), cy + r * Math.sin(Math.PI / 3 * i)]), 'thin', false);
      }
    }
  }
  for (const y of d.feet) line(Sd(y - d.footD / 2, 0), Sd(y + d.footD / 2, 0), 'h');
  // Maße
  dimH(Sd(d.D, 0), Sd(0, 0), fy + 7, f1(d.D));
  dimV(Sd(0, 0), Sd(0, d.hF), Sd(0, 0)[0] + 7, f1(d.hF));
  dimV(Sd(d.D, 0), Sd(d.D, d.hB), Sd(d.D, 0)[0] - 20, f1(d.hB));
  // Neigungswinkel
  {
    // an der hinteren Oberkante, außerhalb des Bauteils: Horizontale nach links, Schräge verlängert
    const o = Sd(d.D, d.hB), R = 16;
    const a = d.angle * Math.PI / 180;
    const p1 = [o[0] - R, o[1]], p2 = [o[0] - R * Math.cos(a), o[1] - R * Math.sin(a)];
    line(o, [o[0] - R - 3, o[1]], 'd');
    line(o, [o[0] - (R + 3) * Math.cos(a), o[1] - (R + 3) * Math.sin(a)], 'd');
    push(`<path class="d" d="M${p1[0].toFixed(2)},${p1[1].toFixed(2)} A${R},${R} 0 0 1 ${p2[0].toFixed(2)},${p2[1].toFixed(2)}"/>`);
    text([o[0] - R * 0.55, o[1] - (R + 3) * Math.sin(a) - 1.8], `${f1(d.angle)}°`, 2.5, 'middle');
  }
  title([sx, view.y0 + 1], 'Seitenansicht von links');

  // ---------------------------------------------------------------- Draufsicht (X–Y)
  for (const r of d.rails) {
    const e = [d.capT, ...d.supports.flatMap(c => [c - d.supT / 2, c + d.supT / 2]), d.W - d.capT];
    for (let i = 0; i < e.length; i += 2) rectP(T(e[i], r.top[0]), T(e[i + 1], r.top[1]));
    line(T(d.railX0 - 4, (r.top[0] + r.top[1]) / 2), T(d.W - d.railX0 + 4, (r.top[0] + r.top[1]) / 2), 'c');
  }
  const topBlock = (x0, x1) => {
    rectP(T(x0, 0), T(x1, d.D));
    for (const c of d.cuts) line(T(x0, c.c), T(x1, c.c), 'v');
  };
  topBlock(0, d.capT); topBlock(d.W - d.capT, d.W);
  d.supports.forEach(c => topBlock(c - d.supT / 2, c + d.supT / 2));
  if (d.plate) {
    for (const q of d.plate.slots) rrect(T(q.x0, q.y0), T(q.x1, q.y1), q.r * s);
    for (const st of d.plate.strips) if (st.seam !== null) line(T(d.capT, st.seam), T(d.W - d.capT, st.seam), 'v');
  }
  for (const q of d.psus) rectP(T(q.x0, q.ymin), T(q.x1, q.ymax), 'h', false);
  for (const b of d.braces) rectP(T(d.railX0, b.y - b.w / 2), T(d.W - d.railX0, b.y + b.w / 2), 'h', false);
  if (d.back) {
    rectP(T(0, d.D), T(d.W, d.D + d.back.t));
    for (const sm of d.back.seams) line(T(sm.x, d.D), T(sm.x, d.D + d.back.t), 'v');
  }
  // Maße
  dimV(T(d.W, 0), T(d.W, d.D), T(d.W, 0)[0] + 9, f1(d.D));
  dimH(T(d.railX0, 0), T(d.W - d.railX0, 0), tyBase + 7, `${f1(d.railLen)} (Schienenlänge)`);
  if (d.rails.length > 1) {
    const r0 = d.rails[0], r1 = d.rails[1];
    const ya = (r0.top[0] + r0.top[1]) / 2, yb = (r1.top[0] + r1.top[1]) / 2;
    dimV(T(0, ya), T(0, yb), T(0, 0)[0] - 7, f1(yb - ya));
  }
  title([fx, fy + 20], 'Draufsicht');

  // ---------------------------------------------------------------- Schnitt A–A (Schiene)
  const ds = [2, 1.5, 1, 0.5].find(v => d.h * v <= 28 && d.w * v <= 80) || 0.5;
  const dox = 262 + 50, doy = 223 + d.h * ds;
  const Dp = (a, b) => [dox + (a + d.w / 2) * ds, doy - (b + d.h) * ds];
  push(`<path class="v sec" fill-rule="evenodd" d="${d.section.map(pg => 'M' + pts(pg.map(p => Dp(p[0], p[1]))).replace(/ /g, ' L') + ' Z').join(' ')}"/>`);
  dimH(Dp(-d.w / 2, 0), Dp(d.w / 2, 0), Dp(0, 0)[1] - 4, f1(d.w));
  dimV(Dp(d.w / 2, -d.h), Dp(d.w / 2, 0), Dp(d.w / 2, 0)[0] + 6, f1(d.h));
  const detScale = ds >= 1 ? `${String(ds).replace('.', ',')}:1` : `1:${1 / ds}`;
  title([262, 212], `Schnitt Schiene (${detScale})`);
  text([262, 216.5], d.profileLabel, 2.3, 'start');

  // ---------------------------------------------------------------- Stücklisten
  const tables = [
    { x: 28, title: 'Druckteile', cols: [[10, 'Pos'], [10, 'Anz'], [66, 'Benennung'], [30, 'Maße (mm)']],
      rows: result.parts.map((pt, i) => [i + 1, pt.qty, pt.name, pt.size.map(v => Math.round(v)).join('×')]) },
    { x: 148, title: 'Zukaufteile', cols: [[12, 'Menge'], [96, 'Benennung']],
      rows: result.bom.map(b => [b.qty, b.item]) },
  ];
  for (const tb of tables) {
    const y0 = 212, rh = 3.9;
    title([tb.x, y0], tb.title);
    const width = tb.cols.reduce((a, c) => a + c[0], 0);
    let yy = y0 + 2;
    const maxRows = Math.floor((SHEET.h - 12 - yy) / rh) - 1;
    const rows = tb.rows.slice(0, maxRows);
    line([tb.x, yy], [tb.x + width, yy], 'thin');
    let xx = tb.x;
    tb.cols.forEach(([cw, lab]) => { text([xx + 1, yy + 2.9], lab, 2.2, 'start', 'font-weight="bold"'); xx += cw; });
    yy += rh; line([tb.x, yy], [tb.x + width, yy], 'thin');
    for (const r of rows) {
      xx = tb.x;
      r.forEach((v, i) => {
        const cw = tb.cols[i][0];
        const maxChars = Math.floor(cw / 1.18);
        let str = String(v);
        if (str.length > maxChars) str = str.slice(0, maxChars - 1) + '…';
        text([xx + 1, yy + 2.9], str, 2.2, 'start');
        xx += cw;
      });
      yy += rh; line([tb.x, yy], [tb.x + width, yy], 'thin');
    }
    if (tb.rows.length > rows.length) text([tb.x + 1, yy + 2.9], `… ${tb.rows.length - rows.length} weitere, siehe stueckliste.txt`, 2.2, 'start');
  }

  // ---------------------------------------------------------------- Schriftfeld
  const tbx = 262, tby = 255, tbw = 148, tbh = 32;
  rectP([tbx, tby], [tbx + tbw, tby + tbh], 'frame', false);
  line([tbx, tby + 12], [tbx + tbw, tby + 12], 'thin');
  line([tbx, tby + 22], [tbx + tbw, tby + 22], 'thin');
  line([tbx + 74, tby + 12], [tbx + 74, tby + tbh], 'thin');
  line([tbx + 111, tby + 12], [tbx + 111, tby + tbh], 'thin');
  text([tbx + 2, tby + 5], 'Benennung', 1.8, 'start');
  text([tbx + 2, tby + 10.2], `Pedalboard ${d.W} × ${d.D} mm, Bauart ${d.mode === 'alu' ? 'B · Alu-Profile' : d.mode === 'plate' ? 'C · Druckplatte' : 'A · voll gedruckt'}`, 3.5, 'start', 'font-weight="bold"');
  const cell = (x, y, lab, val) => { text([x + 2, y + 3.2], lab, 1.8, 'start'); text([x + 2, y + 8.2], val, 3, 'start'); };
  cell(tbx, tby + 12, 'Maße (B × T × H)', `${d.W} × ${d.D} × ${d.hF}–${d.hB} mm`);
  cell(tbx + 74, tby + 12, 'Maßstab', `1:${String(k).replace('.', ',')}`);
  cell(tbx + 111, tby + 12, 'Neigung', `${f1(d.angle)}°`);
  cell(tbx, tby + 22, 'Erstellt', new Date().toLocaleDateString('de-DE'));
  cell(tbx + 74, tby + 22, 'Blatt', '1 / 1  ·  A3');
  if (d.bendAngle) text([tbx + 2, tby + tbh + 4], `Board an jeder Stütze um ${f1(d.bendAngle)}° gebogen (insgesamt ${f1(Math.abs(d.bendTotal))}°) – hier ungebogen (abgewickelt) dargestellt.`, 2.2, 'start');
  // Projektionssymbol Methode 1
  {
    const cx = tbx + 118, cy = tby + 27.5;
    push(`<g class="thin">`);
    polygon([[cx + 7, cy - 2.2], [cx + 13, cy - 3.5], [cx + 13, cy + 3.5], [cx + 7, cy + 2.2]], 'thin', false);
    circ([cx + 2.5, cy], 3.5, 'thin'); circ([cx + 2.5, cy], 2.2, 'thin');
    line([cx - 2, cy], [cx + 15, cy], 'c');
    push(`</g>`);
  }
  text([tbx + tbw - 2, tby + tbh + 4.5], `Parametric Pedal Board · ${params.bedX}×${params.bedY}×${params.bedZ} mm Bauraum`, 2, 'end');

  // ---------------------------------------------------------------- Blatt
  const css = `
    .v{stroke:#000;stroke-width:${LW.vis};fill:none;stroke-linejoin:round;stroke-linecap:round}
    .f{fill:#fff}
    .h{stroke:#000;stroke-width:${LW.hid};fill:none;stroke-dasharray:2.4 1.2}
    .c{stroke:#000;stroke-width:${LW.dim};fill:none;stroke-dasharray:8 1.2 1 1.2}
    .d{stroke:#000;stroke-width:${LW.dim};fill:none}
    .thin{stroke:#000;stroke-width:${LW.thin};fill:none}
    .frame{stroke:#000;stroke-width:${LW.frame};fill:none}
    .arr{fill:#000;stroke:none}
    .sec{fill:url(#hatch)}
    text{font-family:${FONT};fill:#000}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}mm" height="${SHEET.h}mm" viewBox="0 0 ${SHEET.w} ${SHEET.h}">
<defs><style>${css}</style>
<pattern id="hatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="2" fill="#fff"/><line x1="0" y1="0" x2="0" y2="2" stroke="#000" stroke-width="0.2"/></pattern></defs>
<rect x="0" y="0" width="${SHEET.w}" height="${SHEET.h}" fill="#fff"/>
<rect class="frame" x="20" y="10" width="${SHEET.w - 30}" height="${SHEET.h - 20}"/>
${out.join('\n')}
</svg>`;
}
