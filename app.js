/* =========================================================
 *  Egutegiko argazki-bozketa · Logika nagusia
 * ========================================================= */
(function () {
  'use strict';

  var GORDE_KEYA = 'egutegi_bozketa_v1';

  var hautatuak = new Set();   // hautatutako argazkien id-ak
  var lightboxId = null;

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  document.addEventListener('DOMContentLoaded', hasi);

  /* ---------------- Hasiera ---------------- */
  function hasi() {
    if (!window.ARGAZKIAK || !window.CONFIG) {
      console.error('config.js / photos.js falta dira.');
      return;
    }
    document.getElementById('urtea').textContent = CONFIG.URTEKO;

    var grid = $('#grid');
    ARGAZKIAK.forEach(function (arg) { grid.appendChild(txartela(arg)); });

    lotuEkintzak();
    lokalaBerreskuratu();
    eguneratu();
  }

  /* ---------------- Txartela sortu ---------------- */
  function txartela(arg) {
    var fig = document.createElement('figure');
    fig.className = 'foto';
    fig.dataset.id = arg.id;
    fig.tabIndex = 0;
    fig.setAttribute('role', 'checkbox');
    fig.setAttribute('aria-checked', 'false');
    fig.setAttribute('aria-label', irudiIzena(arg));

    var media = document.createElement('div');
    media.className = 'foto-media';

    var img = document.createElement('img');
    img.src = arg.fitxategia;
    img.alt = irudiIzena(arg);
    img.loading = 'lazy';
    img.addEventListener('error', function () {
      if (!this.dataset.fallback) {
        this.dataset.fallback = '1';
        this.src = 'img/placeholder.svg';
      }
    });

    var zoom = document.createElement('button');
    zoom.type = 'button';
    zoom.className = 'foto-zoom';
    zoom.setAttribute('aria-label', 'Handitu argazkia');
    zoom.textContent = '⤢';
    zoom.addEventListener('click', function (e) {
      e.stopPropagation();
      irekiLightbox(arg.id);
    });

    var tick = document.createElement('span');
    tick.className = 'foto-tick';
    tick.textContent = '✓';

    media.appendChild(img);
    media.appendChild(zoom);
    media.appendChild(tick);
    fig.appendChild(media);

    var cap = document.createElement('figcaption');
    cap.className = 'foto-izenburua';
    cap.textContent = arg.izenburua || ('#' + arg.id);
    fig.appendChild(cap);

    fig.addEventListener('click', function () { aldatu(arg.id); });
    fig.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        aldatu(arg.id);
      }
    });

    return fig;
  }

  function irudiIzena(arg) {
    return arg.izenburua ? arg.izenburua + ' (argazkia ' + arg.id + ')' : 'Argazkia ' + arg.id;
  }

  /* ---------------- Aukeraketa ---------------- */
  function aldatu(id) {
    if (hautatuak.has(id)) {
      hautatuak.delete(id);
    } else {
      if (hautatuak.size >= CONFIG.MAX) {
        abisua('Gehienez ' + CONFIG.MAX + ' argazki aukeratu ahal dituk. Kendu bat lehenago.');
        return;
      }
      hautatuak.add(id);
    }
    eguneratu();
    if (lightboxId) eguneratuLightboxBotoia();
  }

  function eguneratu() {
    $$('.foto').forEach(function (fig) {
      var on = hautatuak.has(fig.dataset.id);
      fig.classList.toggle('aukeratuta', on);
      fig.setAttribute('aria-checked', on ? 'true' : 'false');
    });

    var n = hautatuak.size;
    $('#kontagailua').textContent = n + ' / ' + CONFIG.MAX;
    $('#bidali').disabled = !(n >= CONFIG.MIN && n <= CONFIG.MAX);
    $('#agindua').textContent = testuaAgindua();
  }

  function testuaAgindua() {
    var n = hautatuak.size;
    var min = CONFIG.MIN;
    var max = CONFIG.MAX;

    if (n === 0) {
      return 'Klikatu gustatzen jatzun argazkietan. Gutxienez ' + min + ', gehienez ' + max + ' aukeratu.';
    }
    if (n < min) {
      return n + ' aukeratuta. Gutxienez ' + min + ' behar dituk, gehienez ' + max + '.';
    }
    if (n < max) {
      return n + ' aukeratuta. Ondo! Nahi izanez gero, ' + (max - n) + ' aukera zeinkez gehiago.';
    }
    return max + ' aukeratuta. Ezin dozu gehiago aukeratu — aldatzeko, klikatu barriro kentzeko.';
  }

  /* ---------------- Lightbox ---------------- */
  function irekiLightbox(id) {
    var arg = ARGAZKIAK.filter(function (a) { return a.id === id; })[0];
    if (!arg) return;
    lightboxId = id;
    var img = $('#lightbox-irudia');
    img.src = arg.fitxategia;
    img.alt = irudiIzena(arg);
    img.onerror = function () { this.src = 'img/placeholder.svg'; };
    eguneratuLightboxBotoia();
    zabaldu('#lightbox');
  }

  function eguneratuLightboxBotoia() {
    var on = hautatuak.has(lightboxId);
    var b = $('#lightbox-aukeratu');
    b.textContent = on ? 'Kendu' : 'Aukeratu';
    b.classList.toggle('botoia-nagusia', !on);
    b.classList.toggle('botoia-biguna', on);
  }

  /* ---------------- Overlay-ak ---------------- */
  function zabaldu(sel) {
    var el = $(sel);
    el.hidden = false;
    document.documentElement.classList.add('blokeoa');
  }
  function itxi(sel) {
    var el = $(sel);
    el.hidden = true;
    if ($$('.overlay').filter(function (o) { return !o.hidden; }).length === 0) {
      document.documentElement.classList.remove('blokeoa');
    }
  }

  /* ---------------- Formularioa ---------------- */
  function irekiFormularioa() {
    var n = hautatuak.size;
    if (n < CONFIG.MIN) {
      abisua('Aukeratu gutxienez ' + CONFIG.MIN + ' argazki.');
      return;
    }
    $('#form-kopurua').textContent = n;
    $('#form-errorea').hidden = true;

    var lok = lokalaIrakurri();
    if (lok) {
      if (!$('#izena').value && lok.izena) $('#izena').value = lok.izena;
      if (!$('#email').value && lok.email) $('#email').value = lok.email;
    }
    zabaldu('#formularioa');
    setTimeout(function () { $('#izena').focus(); }, 60);
  }

  function bidaliForm(e) {
    e.preventDefault();

    var izena = $('#izena').value.trim();
    if (!izena) {
      erakutsiErrorea('Idatzi zeure izena, mesedez.');
      $('#izena').focus();
      return;
    }

    var datuak = {
      izena: izena,
      email: $('#email').value.trim(),
      oharra: $('#oharra').value.trim(),
      hautatuak: Array.from(hautatuak),
      hizkuntza: 'eu-bizkaiera',
      orria: location.href,
      denbora: new Date().toISOString(),
    };

    var b = $('#form-bidali');
    b.disabled = true;
    b.textContent = 'Bidaltzen…';

    // Zerbitzaria ez badago konfiguratuta: proba-modua
    if (!CONFIG.API_URL) {
      console.log('[PROBA-MODUA] Bozketa:', datuak);
      setTimeout(function () { amaituBidalketa({ ok: true, demo: true }); }, 600);
      return;
    }

    jsonp(CONFIG.API_URL, datuak, function (res) {
      b.disabled = false;
      b.textContent = 'Bidali';
      if (res && res.ok) {
        amaituBidalketa(res);
      } else {
        erakutsiErrorea('Arazo bat egon da zerbitzariagaz. Saiatu barriro, mesedez.');
      }
    });
  }

  function erakutsiErrorea(msg) {
    var el = $('#form-errorea');
    el.textContent = msg;
    el.hidden = false;
  }

  function amaituBidalketa(res) {
    lokalaGorde();
    itxi('#formularioa');
    itxi('#lightbox');
    lightboxId = null;

    var t = $('#eskerrak-testua');
    if (res && res.demo) {
      t.textContent = 'Proba-moduan zagoz (zerbitzaria ez dago konektatuta). Zeure aukera gordeta geratu da.';
    } else if (res && res.eguneratua) {
      t.textContent = 'Badirudi email horregaz lehenago be bozkatu zenduala, eta zeure aukera eguneratu dogu. Mila esker!';
    } else {
      t.textContent = 'Zeure bozka ondo jaso dogu. Mila esker egutegia aukeratzen laguntzeagatik!';
    }
    zabaldu('#eskerrak');
  }

  /* ---------------- JSONP (CORS-ik gabe) ---------------- */
  function jsonp(url, datuak, cb) {
    var cbIzena = 'egutegi_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    var script = document.createElement('script');
    var amaitu = false;

    var denbora = setTimeout(function () {
      garbitu();
      cb({ ok: false, errorea: 'denbora' });
    }, 15000);

    window[cbIzena] = function (res) {
      clearTimeout(denbora);
      garbitu();
      cb(res);
    };

    function garbitu() {
      if (amaitu) return;
      amaitu = true;
      clearTimeout(denbora);
      try { delete window[cbIzena]; } catch (e) { window[cbIzena] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    var params = new URLSearchParams({
      callback: cbIzena,
      d: JSON.stringify(datuak),
    });

    script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + params.toString();
    script.onerror = function () { clearTimeout(denbora); garbitu(); cb({ ok: false, errorea: 'sarea' }); };
    document.body.appendChild(script);
  }

  /* ---------------- Tokiko memoria (tresna honetan) ---------------- */
  function lokalaGorde() {
    try {
      localStorage.setItem(GORDE_KEYA, JSON.stringify({
        hautatuak: Array.from(hautatuak),
        izena: $('#izena').value.trim(),
        email: $('#email').value.trim(),
        noiz: new Date().toISOString(),
      }));
    } catch (e) { /* pribatutasun-modua */ }
  }

  function lokalaIrakurri() {
    try {
      var raw = localStorage.getItem(GORDE_KEYA);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function lokalaBerreskuratu() {
    var d = lokalaIrakurri();
    if (!d) return;

    (d.hautatuak || []).forEach(function (id) {
      if (ARGAZKIAK.some(function (a) { return a.id === id; })) hautatuak.add(id);
    });

    var oharra = $('#ohar-berria');
    oharra.hidden = false;
    oharra.textContent = 'Honezkero bozkatu dozu tresna honetatik. Zeure aukerak aldatu nahi badituzu, egin eta bidali barriro: aurrekoak ordeztuko dira.';

    if (d.izena) $('#izena').value = d.izena;
    if (d.email) $('#email').value = d.email;
  }

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function abisua(msg) {
    var t = $('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('ikusi');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('ikusi'); }, 2800);
  }

  /* ---------------- Ekintzak lotu ---------------- */
  function lotuEkintzak() {
    $('#bidali').addEventListener('click', irekiFormularioa);
    $('#bozka-form').addEventListener('submit', bidaliForm);

    $('#lightbox-aukeratu').addEventListener('click', function () {
      aldatu(lightboxId);
    });

    $('#bukatu').addEventListener('click', function () { itxi('#eskerrak'); });

    // Itxi botoiak
    $$('[data-itxi]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sel = '#' + btn.dataset.itxi;
        if (sel === '#lightbox') lightboxId = null;
        itxi(sel);
      });
    });

    // Klik overlay-ean bertan: itxi
    $$('.overlay').forEach(function (ov) {
      ov.addEventListener('click', function (e) {
        if (e.target === ov) {
          if (ov.id === 'lightbox') lightboxId = null;
          itxi('#' + ov.id);
        }
      });
    });

    // ESC
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var irekiak = $$('.overlay').filter(function (o) { return !o.hidden; });
      if (irekiak.length) {
        var top = irekiak[irekiak.length - 1];
        if (top.id === 'lightbox') lightboxId = null;
        itxi('#' + top.id);
      }
    });
  }
})();
