/************************************************************
 *  Egutegiko argazki-bozketa · Backend (Google Apps Script)
 *  ----------------------------------------------------------
 *  AURRETIK EGIN BEHARREKOA:
 *   1) Sortu Google Sheets bat eta kopiatu bere ID-a (URL-tik).
 *   2) Hemen behean SHEET_ID aldatu.
 *   3) Sarbide-kodea sortzeko: exekutatu sortuToken() (▷ Run) eta
 *      lortutako balioa TOKEN-en itsatsi.
 *   4) Gorde (💾).
 *
 *  DESPLEGATU (inplementatu):
 *   Implementar > Nueva implementación > Aplicación web
 *     - Ejecutar como:  Yo
 *     - Quién tiene acceso:  Cualquier persona
 *   Eta URL-a (…/exec) kopiatu eta "config.js"-eko API_URL-en itsatsi.
 *
 *  OHARRA: fitxategi hau GITHUB-era publikoki igotzen baduzu, ez utzi
 *  hemen SHEET_ID eta TOKEN benetako balioekin.
 ************************************************************/

const SHEET_ID = 'UID del Google Sheets';
const SHEET_NAME = 'Bozkak';       // bozken orria
const EMAITZA_SHEET = 'Emaitzak';  // laburpena

// Emaitzen orri pribaturako sarbide-kodea (sortuToken() erabili).
const TOKEN = 'ALDAKATU_KODEA_HONEN_ORDURA';

const MIN = 5;                    // gutxieneko aukeraketa
const MAX = 6;                    // gehienezko aukeraketa
const ARGAZKI_KOPURUA = 24;       // argazki-kopurua
const EGUTEGIAN = 12;          // egutegirako argazki-kopurua

/* ---------------- Sarrera-puntuak ---------------- */

// GET: JSONP bidez (front-end-ak hau erabiltzen du).
//   • Bozketa:      ?callback=cb&d={"izena":…,"hautatuak":[…]}
//   • Emaitzak:     ?callback=cb&action=emaitzak&token=KODEA
function doGet(e) {
  const p = (e && e.parameter) || {};
  const cb = p.callback || null;

  let res;
  try {
    if (p.action === 'emaitzak') {
      res = emaitzak(p.token);
    } else {
      res = prozesatu(p.d);
    }
  } catch (err) {
    res = { ok: false, errorea: String(err) };
  }
  return jsonpErantzuna(res, cb);
}

// POST (aukerakoa): bozketa soilik.
function doPost(e) {
  let res;
  try {
    res = prozesatu(e && e.postData ? e.postData.contents : null);
  } catch (err) {
    res = { ok: false, errorea: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- Bozketa prozesatu ---------------- */
function prozesatu(dRaw) {
  const d = typeof dRaw === 'string' ? JSON.parse(dRaw) : (dRaw || {});

  const izena = kendu(d.izena);
  const email = kendu(d.email).toLowerCase();
  const oharra = kendu(d.oharra);
  const hautatuak = (d.hautatuak || []).map(function (x) { return String(x); });

  if (!izena) return { ok: false, errorea: 'izena' };
  if (hautatuak.length < MIN || hautatuak.length > MAX) return { ok: false, errorea: 'kopurua' };

  const sh = lortuOrria();
  if (sh.getLastRow() === 0) idatziGoiburua(sh);

  // Email bera badago: ilara eguneratu (ez dugu bozkarik bikoiztu nahi).
  if (email) {
    const fila = bilatuEmail(sh, email);
    if (fila > 0) {
      beteIlera(sh, fila, izena, email, oharra, hautatuak);
      return { ok: true, eguneratua: true };
    }
  }

  beteIlera(sh, sh.getLastRow() + 1, izena, email, oharra, hautatuak);
  return { ok: true };
}

/* ---------------- Emaitzak (orri pribatua) ---------------- */
function emaitzak(token) {
  if (!TOKEN || kendu(token) !== String(TOKEN)) {
    return { ok: false, errorea: 'baimena' };
  }
  const r = kalkulatuEmaitzak();
  return {
    ok: true,
    bozkak: r.bozkak,
    emaitzak: r.emaitzak,
    egutegian: EGUTEGIAN,
  };
}

function kalkulatuEmaitzak() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return { bozkak: 0, emaitzak: [] };

  const bozkak = sh.getLastRow() - 1;
  const balioak = sh.getRange(2, 5, bozkak, ARGAZKI_KOPURUA).getValues(); // E.. = argazkiak

  const emaitzak = [];
  for (let i = 0; i < ARGAZKI_KOPURUA; i++) {
    let batuketa = 0;
    for (let f = 0; f < bozkak; f++) batuketa += Number(balioak[f][i]) || 0;
    emaitzak.push({ id: kodea(i + 1), botoak: batuketa });
  }

  emaitzak.sort(function (a, b) {
    return b.botoak - a.botoak || (a.id < b.id ? -1 : 1);
  });
  emaitzak.forEach(function (r) {
    r.ehunekoa = bozkak ? Math.round((r.botoak / bozkak) * 1000) / 10 : 0;
  });

  return { bozkak: bozkak, emaitzak: emaitzak };
}

/* ---------------- Laburpena: taldekatu() ---------------- */
/* Exekutatu eskuz Apps Script-en (▷ Run) "Emaitzak" orria sortzeko. */
function taldekatu() {
  const r = kalkulatuEmaitzak();
  if (!r.emaitzak.length) {
    Logger.log('Oraindik ez dago bozkarik.');
    return [];
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const esh = ss.getSheetByName(EMAITZA_SHEET) || ss.insertSheet(EMAITZA_SHEET);
  esh.clear();
  esh.getRange(1, 1, 1, 4).setValues([['Postua', 'Argazkia', 'Botoak', 'Ehunekoa']]).setFontWeight('bold');

  const irteera = r.emaitzak.map(function (x, i) {
    return [i + 1, x.id, x.botoak, x.ehunekoa / 100];
  });
  esh.getRange(2, 1, irteera.length, 4).setValues(irteera);
  esh.getRange(2, 4, irteera.length, 1).setNumberFormat('0.0%');
  esh.getRange(2, 1, Math.min(EGUTEGIAN, irteera.length), 4).setBackground('#fff1e9');

  Logger.log('Bozketa-kopurua: ' + r.bozkak);
  Logger.log('Top ' + EGUTEGIAN + ':\n' + irteera.slice(0, EGUTEGIAN).map(function (x) {
    return '  ' + x[1] + ' → ' + x[2] + ' boto (' + (x[3] * 100).toFixed(1) + '%)';
  }).join('\n'));

  return r.emaitzak;
}

/* ---------------- Lagungarriak ---------------- */
function lortuOrria() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function idatziGoiburua(sh) {
  const kab = ['Data', 'Izena', 'Emaila', 'Oharra'];
  for (let i = 1; i <= ARGAZKI_KOPURUA; i++) kab.push(kodea(i));
  kab.push('Guztira');
  sh.getRange(1, 1, 1, kab.length).setValues([kab]).setFontWeight('bold');
  sh.setFrozenRows(1);
}

function bilatuEmail(sh, email) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const vals = sh.getRange(2, 3, last - 1, 1).getValues(); // C = Emaila
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).toLowerCase() === email) return i + 2;
  }
  return -1;
}

function beteIlera(sh, fila, izena, email, oharra, hautatuak) {
  const multzoa = {};
  hautatuak.forEach(function (id) { multzoa[kodea(parseInt(id, 10))] = 1; });

  const balioak = [new Date(), izena, email, oharra];
  for (let i = 1; i <= ARGAZKI_KOPURUA; i++) balioak.push(multzoa[kodea(i)] ? 1 : 0);
  balioak.push(hautatuak.length);

  sh.getRange(fila, 1, 1, balioak.length).setValues([balioak]);
}

// Sarbide-kode bat sortu eta Logger-era erakutsi (▷ Run).
function sortuToken() {
  const t = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  Logger.log('Zure TOKEN-a: ' + t);
  return t;
}

function jsonpErantzuna(res, cb) {
  const out = cb ? cb + '(' + JSON.stringify(res) + ');' : JSON.stringify(res);
  return ContentService
    .createTextOutput(out)
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function kodea(n) {
  return (n < 10 ? '0' : '') + n;
}

function kendu(v) {
  return v == null ? '' : String(v).trim();
}
