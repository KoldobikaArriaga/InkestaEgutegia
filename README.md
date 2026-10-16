# InkestaEgutegia

Web sinple bat, zure egutegirako **24 argazkien artean 5–6 gogokoenak** aukeratzeko.
Interfazea **euskera bizkaineraz** dago, eta botoak automatikoki **Google Sheets** baten gordetzen dira.

- Front-end-a: HTML + CSS + JavaScript hutsa (mendekotasunik gabe).
- Back-end-a: Google Apps Script (doan, zerbitzaririk gabe).
- Argazkiak: zure `img/` karpetan.

## Egitura

```
InkestaEgutegia/
├── index.html          ← bozketa-orri nagusia (publikoa)
├── styles.css          ← itxura orokorra
├── app.js              ← bozketaren logika
├── config.js           ← ezarpenak (API_URL, MIN/MAX, urtea)
├── photos.js           ← 24 argazkien zerrenda
├── prestatu-argazkiak.py ← argazkiak web-rako prestatzeko tresna (Python)
├── resultados.html     ← emaitzen orri pribatua
├── resultados.css      ← emaitzen orriaren itxura
├── resultados.js       ← emaitzen logika (sarbide-kodea)
├── img/                ← hemen jarri 01.jpg … 24.jpg
│   └── placeholder.svg
└── apps-script/
    └── Code.gs         ← Google-eko back-end-a
```

---

## 1. Argazkiak prestatu

Jatorrizko argazkiak **inoiz ez dira ukitzen**. Bi modu daude:

### A) `prestatu-argazkiak.py` tresnarekin (gomendatua)

Jarri hautatutako 24 argazkiak karpeta batean (adib. `argazkiak/`) eta exekutatu:

```bash
python3 prestatu-argazkiak.py --sarrera ~/argazkiak --irteera img
```

Tresnak hau egiten du:

- **EXIF orientazioa** zuzentzen du (mugikorreko argazki bihurrituak ondo jartzeko).
- Luzera luzeena **1.600 px**-era mugatzen du, eta **inoiz ez du handitzen**.
- `01.jpg` … `24.jpg` izenekin ateratzen ditu `img/` karpetan, JPEG optimizatuta.
- **GPSa eta metadatuak kentzen ditu** (pribatutasuna). `--egile "Zeure Izena"` jarriz
  gero, *Copyright/Artist* eremuak gehitzen ditu.
- `img/kontaktu-orria.jpg` sortzen du, **ordena begiz ikusteko**.
- Transparentzia duen PNG bat zuri gainean lauatzen du.

Aukera nagusiak: `--neurria 2000`, `--kalitatea 88`, `--ordena exif`, `--ez-abiarazi`
(entsegu-modua, ezer ez idazteko), `--no-kontaktu-orria`.
Laguntza osoa: `python3 prestatu-argazkiak.py --help`.

> Beharrezkoa: **Python 3 + Pillow**. Pillow falta bada: `python3 -m pip install --user Pillow`.

**Ordena zehatza** nahi baduzu (hilabete-ordenari begira, adibidez):

```bash
# 1) ordena-txantiloia sortu (ordena.txt)
python3 prestatu-argazkiak.py --sarrera ~/argazkiak --zerrenda-egin
# 2) ordena.txt editatu: lerroen ordena aldatu nahi duzun bezala
# 3) exekutatu
python3 prestatu-argazkiak.py --sarrera ~/argazkiak --zerrenda ordena.txt
```

### B) Eskuz

Kopiatu zure 24 argazkiak `img/` karpetan, `01.jpg` … `24.jpg` izenekin
(gutxi gorabehera 1.600 px, JPG ~%80 kalitatea).

### Izenburuak (aukerakoa)

Izenburuak erakutsi nahi badituzu (lekua, gaia…), ireki `photos.js` eta bete
`izenburua` eremua.

## 2. Back-end-a sortu (Google Sheets + Apps Script)

1. Sortu **Google Sheets** berri bat → kopiatu ID-a URL-tik:
   `https://docs.google.com/spreadsheets/d/`**`AU_ID_HORI`**`/edit`
2. Orri horretan: **Extensiones → Apps Script**.
3. Ezabatu kodea eta itsatsi `apps-script/Code.gs` fitxategiko edukia.
4. `SHEET_ID` aldagaiaren balioa zure ID-arekin ordezkatu.
5. **Sarbide-kodea sortu** (emaitzen orrirako): exekutatu `sortuToken()` (▷ Run) eta
   *Execution log*-ean agertzen den kodea `TOKEN` aldagaiaren balio gisa itsatsi.
   Gorde (💾).
6. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como*: **Yo**
   - *Quién tiene acceso*: **Cualquier persona**
7. Kopiatu lortutako URL-a (`…/exec`-ekin amaitzen da).

## 3. Web-a konektatu eta probatu

1. Itsatsi URL hori `config.js` fitxategiko `API_URL` eremuan:
   ```js
   API_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
   ```
2. Proba lokala egiteko:
   ```bash
   cd InkestaEgutegia
   python3 -m http.server 8000
   ```
   eta ireki `http://localhost:8000`.

   > `API_URL` hutsik badago, **proba-moduan** ibiliko da: bozketa ez da inora bidaliko, baina kontsolan ikusiko duzu.

## 4. Web-a argitaratu (doan)

### GitHub Pages (errepositorio publikoa)

GitHub Free-rekin errepositorioa **publikoa** izan behar da (repo pribatu bat doan
nahiago baduzu, erabili Cloudflare Pages / Netlify / Vercel). Errepositorio-izena:
**InkestaEgutegia**.

1. GitHub-en: **New repository** → izena `InkestaEgutegia` → **Public** → *Create*.
2. Fitxategiak igo (**Add file → Upload files**), edo `git`-ekin:
   ```bash
   cd InkestaEgutegia
   git init && git add . && git commit -m "InkestaEgutegia"
   git branch -M main
   git remote add origin https://github.com/ERABILTZAILEA/InkestaEgutegia.git
   git push -u origin main
   ```
3. **Settings → Pages** → *Source*: **Deploy from a branch** → *Branch*: **main** /
   **(root)** → *Save*.
4. Minutu batean prest: `https://ERABILTZAILEA.github.io/InkestaEgutegia/`

> ⚠️ GitHub Pages-en bidea **maiuskulak/minuskulak bereizten ditu**: erabili
> `InkestaEgutegia`, ez `inkestaegutegia`. Jekyll-aren eragozpenak saihesteko,
> `.nojekyll` fitxategi hutsa proiektuan dago jada.

### Beste aukera batzuk

- **Cloudflare Pages**: proiektu bat sortu eta karpeta edo Git errepositorioa lotu.
- **Netlify Drop**: arrastratu karpeta `app.netlify.com/drop`-era. (Hau da azkarrena.)

Gero, lortutako esteka bidali lagunei, senideei eta argazkilariei.

---

## Emaitzen orri pribatua

`resultados.html` orrian bozketaren ranking-a ikusiko duzu, boto-kopuruekin eta
barra grafikoekin, eta **egutegirako 12 hautagaiak** nabarmenduta (zuriune bat
mugan). Guztiz pribatua da:

1. Ireki `resultados.html` (adibidez: `https://ERABILTZAILEA.github.io/InkestaEgutegia/resultados.html`).
2. Sartu `Code.gs`-ko `TOKEN` kodea. Behin bakarrik; geroago gogoratuko du.
3. *Berritu* botoiarekin unean uneko emaitzak freskatzen dira.

> ⚠️ **Ez lotu orri hau bozketa-orritik.** `index.html`-ean ez dago estekarik
> *resultados.html*-era, nahita. Esteka hori bera ezagutzen dutenek soilik ikusiko dute,
> eta kodea behar da barruan sartzeko.
>
> Kodeaz ahaztu bazara: `localStorage` garbitu edo *Irten* sakatu, eta berriz idatzi.

**Segurtasun-ohar garrantzitsua:** `apps-script/Code.gs` fitxategia GitHub-era
publikoki igotzen baduzu, **ez** utzi `SHEET_ID` eta `TOKEN` benetako balioekin.
Bertsio publikorako, utzi balio faltsuak eta benetakoak Apps Script-ean soilik gorde.

## Emaitzak ikusi

Google Sheets-en bertan:

- Ilara bakoitza = pertsona bat. `01`…`24` zutabeek `1` dute hautatutako argazkietan.
- Argazki bakoitzaren **boto-kopurua** jakiteko:

  ```
  =SUM(E2:E1000)   →  hartu behar dituen 24 zutabeentzat
  ```

- Edo erabili prest dagoen laburpena: Apps Script-en `taldekatu()` funtzioa exekutatu (▷ Run).
  `Emaitzak` orri batean **ranking osoa** sortuko du eta **Top 12** nabarmenduko du.

> Email bera duten botoak bat egingo dira (aurreko bozka ordeztu), eta ez dira bikoiztuko.

## Pertsonalizatu

- **Zenbat aukeratu**: `config.js` → `MIN` eta `MAX`.
- **Testuak**: `index.html` (estatikoak) eta `app.js` → `testuaAgindua()` (dinamikoak).
- **Kolorea**: `styles.css` → `--azentua`.

## Pribatutasun-ohar bat

Argazkiek *lightbox*-a dute (handituta ikusteko ⤢ botoia). Jasotako datuak zure Sheets-en baino ez dira geratzen.
Esteka publikoa denez, nahi izanez gero, eman aurretik proba bat egin eta gero bidali.
