#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prestatu-argazkiak.py
=====================

Egutegiko 24 argazkiak web-rako prestatzeko tresna.

  • BEHIN BETIKO: ez du jatorrizko fitxategirik ukitzen (irakurtzen du soilik).
  • Argazkiak 01.jpg … 24.jpg izenarekin ateratzen ditu.
  • Neurri handia mugatzen du (luzera luzeena 1600 px, lehenetsita).
  • EXIF orientazioa zuzentzen du eta kolore-profila segurtatzen du.
  • Kontaktu-orri bat sortzen du ordena begiz ikusteko (aukerakoa).

Adibidea:
    python3 prestatu-argazkiak.py --sarrera ~/argazkiak
    python3 prestatu-argazkiak.py --sarrera ~/argazkiak --neurria 2000 --kalitatea 88
    python3 prestatu-argazkiak.py --sarrera ~/argazkiak --zerrenda-egin   # ordena.txt sortu
"""

from __future__ import annotations

import argparse
import math
import os
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    from PIL import Image, ImageOps, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    sys.exit(
        "Errorea: Pillow behar da.\n"
        "Instalatu horrela:  python3 -m pip install --user Pillow"
    )

# HEIC/HEIF onarpena (aukerakoa, pillow-heif badago)
try:
    import pillow_heif  # type: ignore

    pillow_heif.register_heif_opener()
    _HEIC = True
except Exception:  # pragma: no cover
    _HEIC = False

EXT_PERMITIDAS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".bmp", ".gif"}
if _HEIC:
    EXT_PERMITIDAS |= {".heic", ".heif"}

# Pillow 10+: Image.Resampling.LANCZOS
LANCZOS = getattr(Image, "Resampling", Image).LANCZOS

# EXIF etiketa-erreferentziak
EXIF_FECHA = (36867, 36868, 306)  # DateTimeOriginal, DateTimeDigitized, DateTime
EXIF_ARTIST = 315
EXIF_COPYRIGHT = 33432

FUENTES_CANDIDATAS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
]


def fmt_peso(n_bytes: int) -> str:
    for unidad in ("B", "KB", "MB", "GB"):
        if n_bytes < 1024 or unidad == "GB":
            return f"{n_bytes:.0f} {unidad}" if unidad == "B" else f"{n_bytes:.1f} {unidad}"
        n_bytes /= 1024
    return f"{n_bytes:.1f} GB"


def clave_natural(texto: str):
    """Ordena 'foto2' antes que 'foto10'."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", texto)]


def cargar_fuente(tam: int):
    for ruta in FUENTES_CANDIDATAS:
        if os.path.exists(ruta):
            try:
                return ImageFont.truetype(ruta, tam)
            except Exception:
                pass
    return ImageFont.load_default()


def listar_imagenes(carpeta: Path):
    if not carpeta.is_dir():
        sys.exit(f"Errorea: ez da karpeta hori aurkitu → {carpeta}")
    archivos = [
        p
        for p in carpeta.iterdir()
        if p.is_file() and p.suffix.lower() in EXT_PERMITIDAS
    ]
    archivos.sort(key=lambda p: clave_natural(p.name))
    return archivos


def fecha_exif(im: Image.Image):
    try:
        exif = im.getexif()
    except Exception:
        return None
    for etiqueta in EXIF_FECHA:
        valor = exif.get(etiqueta)
        if valor:
            try:
                return datetime.strptime(str(valor).strip(), "%Y:%m:%d %H:%M:%S")
            except ValueError:
                continue
    return None


def resolver_orden(archivos, args):
    """Devuelve la lista de rutas en el orden final."""
    if args.zerrenda:
        ruta = Path(args.zerrenda)
        if not ruta.is_file():
            sys.exit(f"Errorea: ez da zerrenda-fitxategia aurkitu → {ruta}")
        nombres = []
        for linea in ruta.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#"):
                nombres.append(linea)
        # Onartu bai izena soilik, bai bide-izena
        indice = {p.name: p for p in archivos}
        indice_bajo = {p.name.lower(): p for p in archivos}
        orden = []
        faltan = []
        for n in nombres:
            p = indice.get(n) or indice_bajo.get(Path(n).name.lower())
            if p and p not in orden:
                orden.append(p)
            else:
                faltan.append(n)
        if faltan:
            print("⚠  Zerrendan aurkitu ez diren izenak:")
            for n in faltan:
                print(f"     · {n}")
        sobra = [p for p in archivos if p not in orden]
        if sobra:
            print(f"ℹ  Zerrendan agertzen ez diren {len(sobra)} argazki ez dira sartuko.")
        return orden

    if args.ordena == "exif":
        def clave(p):
            try:
                with Image.open(p) as im:
                    f = fecha_exif(im)
            except Exception:
                f = None
            if f is None:
                f = datetime.fromtimestamp(p.stat().st_mtime)
            return f

        return sorted(archivos, key=clave)

    return archivos


def preparar_imagen(ruta: Path, args):
    """Abre, corrige orientación, aplana alfa y redimensiona (nunca agranda).

    Devuelve (imagen, (ancho_original, alto_original)).
    """
    with Image.open(ruta) as im:
        im.load()
        original = im.size
        im = ImageOps.exif_transpose(im) or im

        # Aplanar transparencia sobre blanco
        if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
            im = im.convert("RGBA")
            fondo = Image.new("RGB", im.size, (255, 255, 255))
            fondo.paste(im, mask=im.split()[-1])
            im = fondo
        elif im.mode != "RGB":
            try:
                im = im.convert("RGB")
            except Exception:
                im = im.convert("RGBA").convert("RGB")

        # Redimensionar solo si supera el lado máximo
        w, h = im.size
        if max(w, h) > args.neurria:
            if w >= h:
                nuevo = (args.neurria, max(1, round(h * args.neurria / w)))
            else:
                nuevo = (max(1, round(w * args.neurria / h)), args.neurria)
            im = im.resize(nuevo, LANCZOS)

        # Copiar para no depender del archivo cerrado
        return im.copy(), original


def guardar_jpeg(im: Image.Image, destino: Path, args) -> None:
    parametros = dict(
        format="JPEG",
        quality=args.kalitatea,
        optimize=True,
        progressive=True,
    )
    if args.kalitatea >= 90:
        parametros["subsampling"] = 0  # 4:4:4 colores delgados

    exif = None
    if args.egile:
        ex = Image.Exif()
        ex[EXIF_ARTIST] = args.egile
        ex[EXIF_COPYRIGHT] = args.egile
        exif = ex

    if exif is not None:
        parametros["exif"] = exif

    im.save(destino, **parametros)


def hoja_de_contacto(items, args, destino: Path) -> None:
    """Index-print para verificar la numeración de un vistazo."""
    cols = 6
    cw, ch = 300, 225       # celda (4:3)
    gap, etiqueta_h = 16, 38
    filas = math.ceil(len(items) / cols)
    ancho = cols * cw + (cols + 1) * gap
    alto = filas * (ch + etiqueta_h) + (filas + 1) * gap + 70

    hoja = Image.new("RGB", (ancho, alto), (246, 245, 243))
    dib = ImageDraw.Draw(hoja)
    fuente_titulo = cargar_fuente(26)
    fuente_celda = cargar_fuente(18)
    dib.text((gap, 22), "Egutegia · kontaktuzko orria", font=fuente_titulo, fill=(22, 24, 29))

    for i, (id_archivo, origen) in enumerate(items):
        fila, col = divmod(i, cols)
        x = gap + col * (cw + gap)
        y = 70 + gap + fila * (ch + etiqueta_h + gap)

        dib.rectangle([x - 1, y - 1, x + cw + 1, y + ch + 1], outline=(228, 226, 222), width=1)
        try:
            with Image.open(origen) as im:
                miniatura = ImageOps.contain(im.convert("RGB"), (cw, ch), LANCZOS)
            px = x + (cw - miniatura.width) // 2
            py = y + (ch - miniatura.height) // 2
            hoja.paste(miniatura, (px, py))
        except Exception:
            dib.text((x + 8, y + 8), "(errorea)", font=fuente_celda, fill=(185, 28, 28))

        texto = id_archivo
        ancho_texto = dib.textlength(texto, font=fuente_celda)
        dib.text(
            (x + (cw - ancho_texto) / 2, y + ch + 8),
            texto,
            font=fuente_celda,
            fill=(194, 65, 12),
        )

    hoja.save(destino, format="JPEG", quality=85, optimize=True)


def main() -> int:
    p = argparse.ArgumentParser(
        description="Egutegiko argazkiak web-rako prestatu: 01.jpg … 24.jpg (jatorrizkoak ukitu gabe).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--sarrera", default="argazkiak", help="Jatorrizko argazkien karpeta.")
    p.add_argument("--irteera", default="img", help="Irteerako karpeta (web-arena).")
    p.add_argument("--neurria", type=int, default=1600, help="Luzera luzeeneko gehienezko pixelak.")
    p.add_argument("--kalitatea", type=int, default=82, help="JPEG kalitatea (1-100).")
    p.add_argument("--ordena", choices=["izena", "exif"], default="izena",
                   help="Ordenatzeko irizpidea: fitxategi-izena edo EXIF data.")
    p.add_argument("--zerrenda", default=None,
                   help="Ordena zehatza dakarren testu-fitxategia (lerro bakoitzean fitxategi bat).")
    p.add_argument("--zerrenda-egin", action="store_true",
                   help="Zerrenda-txantiloia sortu eta irten (ordena eskuz zehazteko).")
    p.add_argument("--ez-abiarazi", action="store_true", help="Entsegu-modua: ez du ezer idazten.")
    p.add_argument("--kontaktu-orria", action=argparse.BooleanOptionalAction, default=True,
                   help="Kontaktuzko orria sortu (ordena begiz ikusteko).")
    p.add_argument("--egile", default=None,
                   help="Egilearen izena EXIF Copyright/Artist eremuetarako (aukerakoa).")
    p.add_argument("--isil", action="store_true", help="Irteera gutxiago erakutsi.")
    args = p.parse_args()

    carpeta = Path(args.sarrera).expanduser()
    archivos = listar_imagenes(carpeta)
    if not archivos:
        sys.exit(f"Ez da argazkirik aurkitu → {carpeta}\n"
                 f"Onartutako luzapenak: {', '.join(sorted(EXT_PERMITIDAS))}")

    if args.zerrenda_egin:
        destino = Path(args.zerrenda or "ordena.txt")
        lineas = [
            "# Ordena zehatza ezartzeko fitxategia.",
            "# Aldatu lerroen ordena, eta exekutatu:",
            "#   python3 prestatu-argazkiak.py --sarrera %s --zerrenda %s" % (args.sarrera, destino.name),
            "# '#' batekin hasten diren lerroak eta hutsak alde batera uzten dira.",
            "",
        ] + [p.name for p in archivos]
        destino.write_text("\n".join(lineas) + "\n", encoding="utf-8")
        print(f"✓ Zerrenda sortuta → {destino}  ({len(archivos)} argazki)")
        print("  Aldatu ordena nahi baduzu, fitxategia editatu eta berriz exekutatu --zerrenda-rekin.")
        return 0

    items = resolver_orden(archivos, args)
    if not items:
        sys.exit("Ez dago argazkirik prozesatzeko.")

    if len(items) != 24 and not args.isil:
        print(f"⚠  {len(items)} argazki aurkitu dira (egutegiak 24 behar ditu)."
              "  Prozesatzen jarraitzen dut.")

    salida = Path(args.irteera).expanduser()
    salida.mkdir(parents=True, exist_ok=True)

    digitos = max(2, len(str(len(items))))
    total_entrada = 0
    total_salida = 0
    fallos = 0

    if not args.isil:
        print()
        print(f"  Jatorria : {carpeta}")
        print(f"  Irteera  : {salida.resolve()}")
        print(f"  Neurria  : {args.neurria} px (luzera luzeena)   ·   Kalitatea: {args.kalitatea}")
        print(f"  Ordena   : {'zerrenda' if args.zerrenda else args.ordena}")
        print()
        print(f"  {'#':>3}  {'JATORRIZKO IZENA':<34} {'ORIG.':>11}  {'→':^3} {'BERRI':>11}  {'PISUA':>9}")
        print(f"  {'-'*3}  {'-'*34} {'-'*11}  {'-'*3} {'-'*11}  {'-'*9}")

    for i, origen in enumerate(items, start=1):
        num = str(i).zfill(digitos)
        id_archivo = num + ".jpg"
        destino = salida / id_archivo

        try:
            im, (w0, h0) = preparar_imagen(origen, args)
        except Exception as e:
            fallos += 1
            print(f"  ⚠  Ezinezkoa {origen.name} prozesatzea: {e}")
            continue

        entrada_peso = origen.stat().st_size
        total_entrada += entrada_peso

        if not args.ez_abiarazi:
            guardar_jpeg(im, destino, args)
            salida_peso = destino.stat().st_size
        else:
            salida_peso = 0
        total_salida += salida_peso

        if not args.isil:
            print(
                f"  {num:>3}  {origen.name[:34]:<34} "
                f"{f'{w0}×{h0}':>11}  {'→':^3} {f'{im.width}×{im.height}':>11}  "
                f"{'-' if args.ez_abiarazi else fmt_peso(salida_peso):>9}"
            )
        im.close()

    if args.kontaktu_orria and not args.ez_abiarazi:
        destino_hoja = salida / "kontaktu-orria.jpg"
        hoja_de_contacto(
            [(str(i).zfill(digitos), salida / (str(i).zfill(digitos) + ".jpg")) for i in range(1, len(items) + 1)],
            args,
            destino_hoja,
        )
        if not args.isil:
            print(f"\n  ✎ Kontaktuzko orria → {destino_hoja}")

    if not args.isil:
        print()
        print(f"  {'-'*72}")
        print(f"  ✓ {len(items) - fallos}/{len(items)} argazki prozesatuta"
              + (f"   ({fallos} huts)" if fallos else ""))
        if not args.ez_abiarazi:
            print(f"  Jatorrizko pisua: {fmt_peso(total_entrada)}   →   Berria: "
                  f"{fmt_peso(total_salida)}   (≈{100 * total_salida / max(1, total_entrada):.0f} %)")
        else:
            print("  (entsegu-modua: ezer ez da idatzi)")
        print()

    return 1 if fallos and fallos == len(items) else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        sys.exit("\nEtena.")
