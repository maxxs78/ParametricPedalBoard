// Minimale Mehrsprachigkeit ohne Abhängigkeiten: t(key, params), tn(key, n), fmt(zahl)
// Wörterbücher liegen in js/lang/<code>.js (Default-Export: { 'schlüssel': 'text mit {platzhalter}' }).

export const LANGS = ['de', 'en'];
export const LANG_STORE = 'pedalboard-lang';
const LOCALE = { de: 'de-DE', en: 'en-US' };
let lang = 'de';
let dict = {};
const warned = new Set();

export const getLang = () => lang;
export const getLocale = () => LOCALE[lang];

// Reihenfolge: ?lang=… in der URL, gespeicherte Wahl, Browser-Sprache (Deutsch → de, sonst en)
export function detectLang() {
  try { const q = new URLSearchParams(location.search).get('lang'); if (LANGS.includes(q)) return q; } catch (e) { /* kein Browser */ }
  try { const s = localStorage.getItem(LANG_STORE); if (LANGS.includes(s)) return s; } catch (e) { /* ohne Speicher */ }
  const nav = typeof navigator !== 'undefined' ? (navigator.languages && navigator.languages[0]) || navigator.language || '' : '';
  return /^de(\b|-)/i.test(nav) ? 'de' : 'en';
}

export async function initI18n(code, loader) {
  lang = LANGS.includes(code) ? code : 'en';
  dict = await loader(lang);
  fmtCache.clear();
}

export const has = key => dict[key] !== undefined;

export function t(key, params) {
  let s = dict[key];
  if (s === undefined) {
    if (!warned.has(key)) { warned.add(key); console.warn('i18n: fehlender Schlüssel', key); }
    s = key;
  }
  return params ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m)) : String(s);
}

// Einzahl/Mehrzahl: Schlüssel "<key>.one" bzw. "<key>.other", {n} wird eingesetzt
export const tn = (key, n, params) => t(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...params });

// Zahlen im Zahlenformat der Sprache: fmt(v, d) mit festen Nachkommastellen, num(v, d) mit höchstens d
const fmtCache = new Map();
function nf(min, max) {
  const k = `${lang}|${min}|${max}`;
  if (!fmtCache.has(k)) fmtCache.set(k, new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: min, maximumFractionDigits: max }));
  return fmtCache.get(k);
}
export const fmt = (v, d = 0) => nf(d, d).format(Number(v));
export const num = (v, d = 2) => nf(0, d).format(Number(v));
export const fmtDate = (d = new Date()) => new Date(d).toLocaleDateString(LOCALE[lang]);
export const fmtDateTime = d => new Date(d).toLocaleString(LOCALE[lang], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
