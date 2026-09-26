// 3MF mit mehreren Druckplatten in EINER Datei.
//
// Der 3MF-Kern kennt keine Platten. Die gängigen Slicer mit Plattenverwaltung (Bambu Studio, OrcaSlicer und
// deren Ableger) lesen sie aus Metadata/model_settings.config: jede <plate> listet ihre Objekt-Instanzen, die
// Instanzen liegen im Plattenraster des Slicers (Spalten = ⌈√n⌉, Abstand 1/5 der Bettgröße, weitere Reihen
// in −y). Vorschaubilder je Platte liegen als Metadata/plate_N.png (Schrägansicht) und top_N.png (Draufsicht).
// Andere Slicer lesen nur den Kern: alle Teile, nebeneinander im selben Raster.
// Die Kennung „BambuStudio-…“ im Kopf ist die Voraussetzung dafür, dass diese Slicer die Plattendaten
// überhaupt auswerten (geprüft mit dem Importer von OrcaSlicer 2.3; ältere Versionskennungen lehnt er ab).
//
// Farbe/Filament: Bambu Studio/OrcaSlicer und deren Ableger werten dafür NICHT das 3MF-Kernschema
// (<basematerials>/pid/pindex) aus, sondern die "extruder"-Metadaten je <part> in model_settings.config
// zusammen mit der Filamentliste in Metadata/project_settings.config (geprüft anhand eines von Bambu Studio
// exportierten Referenz-3MF). <basematerials>/pid/pindex bleibt zusätzlich gesetzt, als Fallback für Slicer
// ohne Plattenverwaltung (PrusaSlicer, Cura), die den 3MF-Kern direkt lesen.

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n6 = v => +(+v).toFixed(6);

// Raster wie in Bambu Studio / OrcaSlicer (PartPlateList::compute_colum_count, LOGICAL_PART_PLATE_GAP = 1/5)
export function plateColumns(count) {
  const v = Math.sqrt(count), r = Math.round(v);
  return v > r ? r + 1 : r;
}
export function plateOrigin(j, count, bedX, bedY) {
  const cols = plateColumns(count);
  return [(j % cols) * bedX * 1.2, -Math.floor(j / cols) * bedY * 1.2];
}

/**
 * plates: [{ name, items: [{ part, rot, tx, ty }] }]   (tx/ty: Lage auf der Platte, rot in Grad um z)
 * parts:  [{ name, mesh:{positions,indices}, inlay?, role }]
 * opts:   { bedX, bedY, title, colors: {role: '#rrggbb'}, thumbs: [{ plate: Uint8Array, top: Uint8Array }] }
 * Rückgabe: { path: string | Uint8Array } – vom Aufrufer zu einem ZIP (= .3mf) gepackt.
 */
export function build3MF(plates, parts, opts) {
  const roles = ['printed', 'rail', 'brace', 'panel', 'text', 'clip'];
  const colors = opts.colors || {};
  const used = [...new Set(plates.flatMap(pl => pl.items.map(it => it.part)))];
  const objs = [], cfgObjs = [];
  const ref = new Map();
  let id = 2;
  const meshObj = (oid, mesh, pindex) => {
    const P = mesh.positions, I = mesh.indices;
    const v = [], t = [];
    for (let q = 0; q < P.length; q += 3) v.push(`<vertex x="${+P[q].toFixed(4)}" y="${+P[q + 1].toFixed(4)}" z="${+P[q + 2].toFixed(4)}"/>`);
    for (let q = 0; q < I.length; q += 3) t.push(`<triangle v1="${I[q]}" v2="${I[q + 1]}" v3="${I[q + 2]}"/>`);
    return `<object id="${oid}" type="model" pid="1" pindex="${pindex}"><mesh><vertices>${v.join('')}</vertices><triangles>${t.join('')}</triangles></mesh></object>`;
  };
  const partCfg = (pid, name, extruder) => `  <part id="${pid}" subtype="normal_part">
      <metadata key="name" value="${esc(name)}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="extruder" value="${extruder}"/>
    </part>`;
  for (const pi of used) {
    const pt = parts[pi];
    // jedes Bauteil ist ein Objekt aus Komponenten (Hauptkörper + ggf. Schrift-Einlage als zweites Teil)
    // extruder = 1-basierter Index in `roles`, so wie ihn Metadata/project_settings.config unten erwartet
    const bodyEx = roles.indexOf(pt.role) + 1;
    const a1 = id++;
    objs.push(meshObj(a1, pt.mesh, roles.indexOf(pt.role)));
    const comps = [[a1, pt.name, bodyEx]];
    if (pt.inlay) { const textEx = roles.indexOf('text') + 1; const a2 = id++; objs.push(meshObj(a2, pt.inlay, roles.indexOf('text'))); comps.push([a2, `${pt.name} – Schriftzug`, textEx]); }
    const oid = id++;
    objs.push(`<object id="${oid}" name="${esc(pt.name)}" type="model"><components>${comps.map(([c]) => `<component objectid="${c}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`).join('')}</components></object>`);
    cfgObjs.push(`  <object id="${oid}">
    <metadata key="name" value="${esc(pt.name)}"/>
    <metadata key="extruder" value="${bodyEx}"/>
  ${comps.map(([c, nm, ex]) => partCfg(c, nm, ex)).join('\n  ')}
  </object>`);
    ref.set(pi, oid);
  }

  // Build: Instanzen in Plattenreihenfolge; instance_id zählt je Objekt in Build-Reihenfolge
  const items = [], cfgPlates = [], instCount = new Map();
  let ident = 1000;
  plates.forEach((pl, j) => {
    const [ox, oy] = plateOrigin(j, plates.length, opts.bedX, opts.bedY);
    const inst = [];
    for (const it of pl.items) {
      const oid = ref.get(it.part);
      const r = it.rot * Math.PI / 180, c = n6(Math.cos(r)), s = n6(Math.sin(r));
      items.push(`<item objectid="${oid}" transform="${c} ${s} 0 ${-s} ${c} 0 0 0 1 ${n6(ox + it.tx)} ${n6(oy + it.ty)} 0" printable="1"/>`);
      const k = instCount.get(oid) || 0;
      instCount.set(oid, k + 1);
      inst.push(`    <model_instance>
      <metadata key="object_id" value="${oid}"/>
      <metadata key="instance_id" value="${k}"/>
      <metadata key="identify_id" value="${ident++}"/>
    </model_instance>`);
    }
    const th = opts.thumbs && opts.thumbs[j];
    cfgPlates.push(`  <plate>
    <metadata key="plater_id" value="${j + 1}"/>
    <metadata key="plater_name" value="${esc(pl.name || '')}"/>
    <metadata key="locked" value="false"/>${th ? `
    <metadata key="thumbnail_file" value="Metadata/plate_${j + 1}.png"/>
    <metadata key="top_file" value="Metadata/top_${j + 1}.png"/>` : ''}
${inst.join('\n')}
  </plate>`);
  });

  const date = new Date().toISOString().slice(0, 10);
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="de-DE" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <metadata name="Application">BambuStudio-02.00.00.00</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="Title">${esc(opts.title || '')}</metadata>
 <metadata name="Description">Erzeugt mit Parametric Pedal Board – ${plates.length} Druckplatte${plates.length === 1 ? '' : 'n'}</metadata>
 <metadata name="CreationDate">${date}</metadata>
 <metadata name="ModificationDate">${date}</metadata>
 <resources>
  <basematerials id="1">${roles.map(r => `<base name="${r}" displaycolor="${(colors[r] || '#ffffff').toUpperCase()}FF"/>`).join('')}</basematerials>
  ${objs.join('\n  ')}
 </resources>
 <build>
  ${items.join('\n  ')}
 </build>
</model>`;
  const config = `<?xml version="1.0" encoding="UTF-8"?>
<config>
${cfgObjs.join('\n')}
${cfgPlates.join('\n')}
</config>`;

  // Filamentfarben je extruder (1-basiert, Reihenfolge = `roles`) plus Voreinstellung passend zur eigenen
  // Filamentschätzung (3 Wandschleifen, 30 % Infill, siehe WALL_LOOPS/INFILL in app.js)
  const projectSettings = JSON.stringify({
    filament_colour: roles.map(r => (colors[r] || '#ffffff').toUpperCase()),
    filament_type: roles.map(() => 'PETG'),
    wall_loops: '3',
    sparse_infill_density: '30%',
  }, null, 1);

  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
 <Default Extension="config" ContentType="text/xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>${opts.thumbs && opts.thumbs[0] ? `
 <Relationship Target="/Metadata/plate_1.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>` : ''}
</Relationships>`,
    '3D/3dmodel.model': model,
    'Metadata/model_settings.config': config,
    'Metadata/project_settings.config': projectSettings,
  };
  (opts.thumbs || []).forEach((th, j) => {
    if (!th) return;
    files[`Metadata/plate_${j + 1}.png`] = th.plate;
    files[`Metadata/top_${j + 1}.png`] = th.top;
  });
  return files;
}
