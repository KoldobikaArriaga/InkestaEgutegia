/* =========================================================
 *  Emaitzen orri pribatua · logika
 * ========================================================= */
(function () {
  'use strict';

  var TOKEN_KEY = 'egutegi_admin_token';
  var token = '';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };

  document.addEventListener('DOMContentLoaded', hasi);

  function hasi() {
    if (!window.CONFIG || !window.ARGAZKIAK) {
      console.error('config.js / photos.js falta dira.');
      return;
    }

    document.getElementById('argazkiak').textContent = ARGAZKIAK.length;

    $('#sarrera-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var t = $('#token').value.trim();
      if (!t) {
        erakutsiSarrera('Idatzi sarbide-kodea.');
        return;
      }
      token = t;
      try { localStorage.setItem(TOKEN_KEY, t); } catch (err) { /* pribatutasun-modua */ }
      kargatu();
    });

    $('#berritu').addEventListener('click', kargatu);

    $('#irten').addEventListener('click', function () {
      try { localStorage.removeItem(TOKEN_KEY); } catch (err) { /* ignore */ }
      token = '';
      $('#token').value = '';
      erakutsiSarrera();
    });

    try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (err) { token = ''; }

    if (token) kargatu();
    else erakutsiSarrera();
  }

  /* ---------------- Datuak jaso ---------------- */
  function kargatu() {
    if (!CONFIG.API_URL) {
      mezua('Ez dago API_URL konfiguratuta config.js fitxategian.');
      return;
    }

    erakutsiKarga();

    jsonp(CONFIG.API_URL, { action: 'emaitzak', token: token }, function (res) {
      if (!res) {
        mezua('Ez dago erantzunik zerbitzaritik. Egiaztatu API_URL eta Internet-konexioa.');
        return;
      }
      if (!res.ok) {
        if (res.errorea === 'baimena') {
          try { localStorage.removeItem(TOKEN_KEY); } catch (err) { /* ignore */ }
          token = '';
          erakutsiSarrera('Kode okerra. Saiatu barriro.');
        } else {
          mezua('Errorea: ' + res.errorea);
        }
        return;
      }
      marraztu(res);
    });
  }

  /* ---------------- Emaitzak marraztu ---------------- */
  function marraztu(res) {
    var emaitzak = res.emaitzak || [];
    var guztira = Number(res.bozkak) || 0;

    $('#bozkak').textContent = guztira;
    $('#eguneratze-ordua').textContent = 'Eguneratuta: ' + new Date().toLocaleString('eu-ES');

    var zerr = $('#zerrenda');
    zerr.innerHTML = '';

    if (!emaitzak.length) {
      var huts = document.createElement('p');
      huts.className = 'mezu-kargatzen';
      huts.textContent = 'Oraindik ez dago bozkarik.';
      zerr.appendChild(huts);
    } else {
      emaitzak.forEach(function (r, i) {
        if (i === (res.egutegian || 12)) {
          var m = document.createElement('div');
          m.className = 'mozketa';
          m.textContent = 'Egutegirako ' + (res.egutegian || 12) + 'ak';
          zerr.appendChild(m);
        }
        zerr.appendChild(errenkada(r, i + 1, guztira, res.egutegian || 12));
      });
    }

    $('#sarrera').hidden = true;
    $('#kargatzen').hidden = true;
    $('#mezu-orokorra').hidden = true;
    $('#emaitzak').hidden = false;
  }

  function errenkada(r, pos, guztira, muga) {
    var arg = ARGAZKIAK.filter(function (a) { return a.id === r.id; })[0] ||
      { fitxategia: 'img/placeholder.svg', id: r.id, izenburua: '' };
    var ehun = guztira ? (r.botoak / guztira) * 100 : 0;

    var div = document.createElement('div');
    div.className = 'errenkada' + (pos <= muga ? ' top' : '');

    var p = document.createElement('span');
    p.className = 'pos';
    p.textContent = pos;

    var img = document.createElement('img');
    img.className = 'irudi';
    img.src = arg.fitxategia;
    img.alt = 'Argazkia ' + r.id;
    img.loading = 'lazy';
    img.addEventListener('error', function () {
      if (!this.dataset.f) { this.dataset.f = '1'; this.src = 'img/placeholder.svg'; }
    });

    var datuak = document.createElement('div');
    datuak.className = 'datuak';

    var goian = document.createElement('div');
    goian.className = 'goian';

    var argIzena = document.createElement('span');
    argIzena.className = 'arg';
    argIzena.textContent = '#' + r.id + (arg.izenburua ? ' · ' + arg.izenburua : '');

    var bot = document.createElement('span');
    bot.className = 'botoak';
    bot.textContent = r.botoak + ' bozka · %' + ehun.toFixed(1).replace('.', ',');

    goian.appendChild(argIzena);
    goian.appendChild(bot);

    var barra = document.createElement('div');
    barra.className = 'barra2';
    var barne = document.createElement('span');
    barne.style.width = (r.botoak > 0 ? Math.max(ehun, 2) : 0) + '%';
    barra.appendChild(barne);

    datuak.appendChild(goian);
    datuak.appendChild(barra);

    div.appendChild(p);
    div.appendChild(img);
    div.appendChild(datuak);
    return div;
  }

  /* ---------------- Egoerak ---------------- */
  function erakutsiSarrera(msg) {
    $('#emaitzak').hidden = true;
    $('#kargatzen').hidden = true;
    $('#mezu-orokorra').hidden = true;
    $('#sarrera').hidden = false;

    var e = $('#sarrera-errorea');
    if (msg) { e.textContent = msg; e.hidden = false; } else { e.hidden = true; }
    setTimeout(function () { $('#token').focus(); }, 60);
  }

  function erakutsiKarga() {
    $('#sarrera').hidden = true;
    $('#emaitzak').hidden = true;
    $('#mezu-orokorra').hidden = true;
    $('#kargatzen').hidden = false;
  }

  function mezua(m) {
    $('#kargatzen').hidden = true;
    $('#sarrera').hidden = true;
    $('#emaitzak').hidden = true;
    var el = $('#mezu-orokorra');
    el.textContent = m;
    el.hidden = false;
  }

  /* ---------------- JSONP ---------------- */
  function jsonp(url, params, cb) {
    var izena = 'egutegi_emaitza_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    var script = document.createElement('script');
    var amaitu = false;

    var denbora = setTimeout(function () { garbitu(); cb(null); }, 15000);

    window[izena] = function (res) {
      clearTimeout(denbora);
      garbitu();
      cb(res);
    };

    function garbitu() {
      if (amaitu) return;
      amaitu = true;
      clearTimeout(denbora);
      try { delete window[izena]; } catch (e) { window[izena] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    var q = new URLSearchParams(Object.assign({ callback: izena }, params));
    script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + q.toString();
    script.onerror = function () { clearTimeout(denbora); garbitu(); cb(null); };
    document.body.appendChild(script);
  }
})();
