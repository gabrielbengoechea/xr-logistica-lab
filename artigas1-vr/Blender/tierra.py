"""Texturas de la Tierra vista desde la Cupula, con geografia real.

Proyeccion: azimutal equivalente de Lambert centrada en el nadir de la estacion (NADIR). Es la que usa el
shader (js/entorno.js): con la direccion d del punto de la esfera, en el marco este-norte-arriba del nadir,
las coordenadas del plano son k * (d.este, d.norte) con k = sqrt(2 / (1 + d.arriba)). Sin trigonometria por pixel.

Dos capas, cada una con su textura de dia (color) y de noche (luces urbanas):
  - base:    30 grados alrededor del nadir (toda la zona que entra en el horizonte, con margen para la deriva).
  - detalle: 5,5 grados (unos 610 km): Uruguay entero, Buenos Aires y la Laguna Merin, a 0,6 km por pixel.

Fuentes (todas de uso libre; se bajan o se instalan, no van en el repositorio):
  - Costas, lagos y embalses: GSHHG (resolucion completa), via `pip install basemap basemap-data-hires`.
  - Rios: WDBII (mismo paquete). Los nombres y la jerarquia salen de Natural Earth 1:10m.
  - Color del terreno y del agua: NASA Blue Marble Next Generation (bmng.jpg de basemap-data, 7,4 km/px).
  - Manchas urbanas, localidades y rutas: Natural Earth 1:10m (dominio publico).
Nada se dibuja a mano: si un rio o un embalse no esta en los datos, no aparece.

Salida (en SALIDA/textures): T_Tierra_Base_Dia.png, T_Tierra_Base_Noche.png, T_Tierra_Detalle_Dia.png,
T_Tierra_Detalle_Noche.png (rojo: luces; verde: mascara de agua), T_Tierra_*_Luces.png
(mapa de emision para Unity) y vistas de control en SALIDA/review.
"""
import json
import math
import os
import urllib.request
import warnings

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

warnings.filterwarnings("ignore")

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.environ.get("ARTIGAS1_SALIDA", os.path.join(AQUI, "salida"))
GEO = os.environ.get("ARTIGAS1_GEO", os.path.join(AQUI, "geo"))
os.makedirs(SALIDA + "/textures", exist_ok=True)
os.makedirs(SALIDA + "/review", exist_ok=True)
os.makedirs(GEO, exist_ok=True)

NADIR = (-35.2, -55.9)            # el mismo de cupula.py: al sureste de Montevideo
RADIO_BASE, RADIO_DETALLE = 30.0, 5.5
PX = 2048
PX_NOCHE_BASE = 1024
KM_GRADO = 111.19
NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/"
NE_CAPAS = ("ne_10m_rivers_lake_centerlines_scale_rank", "ne_10m_urban_areas", "ne_10m_populated_places_simple", "ne_10m_roads")


# ---------------------------------------------------------------- datos
def natural_earth(nombre):
    ruta = os.path.join(GEO, nombre + ".geojson")
    if not os.path.exists(ruta):
        print("bajando", nombre)
        urllib.request.urlretrieve(NE_URL + nombre + ".geojson", ruta)
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)["features"]


def lineas_de(geom):
    """Listas de (lon, lat) de una geometria GeoJSON (lineas o anillos exteriores e interiores)."""
    t, c = geom["type"], geom["coordinates"]
    if t == "LineString":
        return [c]
    if t in ("MultiLineString", "Polygon"):
        return list(c)
    if t == "MultiPolygon":
        return [anillo for pol in c for anillo in pol]
    return []


# ---------------------------------------------------------------- proyeccion
class Lambert:
    def __init__(self, radio_grados, px):
        self.radio = radio_grados
        self.rmax = 2 * math.sin(math.radians(radio_grados) / 2)
        self.px = px
        self.km_px = 2 * radio_grados * KM_GRADO / px       # en el centro
        self.f0, self.l0 = math.radians(NADIR[0]), math.radians(NADIR[1])

    def adelante(self, lat, lon):
        """lat, lon (grados, arrays) -> columna, fila (pixeles, float) y coseno de la distancia al nadir."""
        f, dl = np.radians(lat), np.radians(lon) - self.l0
        cosc = math.sin(self.f0) * np.sin(f) + math.cos(self.f0) * np.cos(f) * np.cos(dl)
        k = np.sqrt(2 / (1 + np.maximum(cosc, -0.999)))
        x = k * np.cos(f) * np.sin(dl)
        y = k * (math.cos(self.f0) * np.sin(f) - math.sin(self.f0) * np.cos(f) * np.cos(dl))
        return (0.5 + x / (2 * self.rmax)) * self.px, (0.5 - y / (2 * self.rmax)) * self.px, cosc

    def atras(self, px=None):
        """Latitud y longitud del centro de cada pixel, y distancia al nadir en unidades del radio (0 a 1,41)."""
        n = px or self.px
        c = (np.arange(n) + 0.5) / n
        x = (c[None, :] - 0.5) * 2 * self.rmax
        y = (0.5 - c[:, None]) * 2 * self.rmax
        rho = np.sqrt(x * x + y * y) + 1e-12
        cc = 2 * np.arcsin(np.clip(rho / 2, 0, 1))
        lat = np.arcsin(np.clip(np.cos(cc) * math.sin(self.f0) + y * np.sin(cc) * math.cos(self.f0) / rho, -1, 1))
        lon = self.l0 + np.arctan2(x * np.sin(cc), rho * math.cos(self.f0) * np.cos(cc) - y * math.sin(self.f0) * np.sin(cc))
        return np.degrees(lat).astype(np.float32), np.degrees(lon).astype(np.float32), (rho / self.rmax).astype(np.float32)

    def caja(self, margen=1.25):
        """Caja lat/lon que contiene el circulo (con margen), para pedirle los datos a basemap."""
        r = self.radio * margen
        lat0, lat1 = max(-89, NADIR[0] - r), min(89, NADIR[0] + r)
        ancho = r / max(0.2, math.cos(math.radians(min(abs(lat0), abs(lat1), 89) if lat0 * lat1 > 0 else 0)))
        ancho = min(170, r / max(0.15, math.cos(math.radians(max(abs(lat0), abs(lat1))))))
        return lat0, lat1, NADIR[1] - ancho, NADIR[1] + ancho


class Lienzo:
    """Mascara dibujada con sobremuestreo 2x (bordes suaves) en la proyeccion dada."""

    def __init__(self, proy, ss=2, px=None):
        self.p, self.ss, self.n = proy, ss, px or proy.px
        self.img = Image.new("L", (self.n * ss, self.n * ss), 0)
        self.d = ImageDraw.Draw(self.img)
        self.k = self.n * ss / proy.px

    def _xy(self, pts):
        a = np.asarray(pts, np.float64)
        x, y, cosc = self.p.adelante(a[:, 1], a[:, 0])
        if cosc.max() < math.cos(math.radians(min(175, self.p.radio * 1.6))):
            return None
        return list(zip((x * self.k).tolist(), (y * self.k).tolist()))

    def poligono(self, pts, valor=255):
        xy = self._xy(pts)
        if xy and len(xy) >= 3:
            self.d.polygon(xy, fill=valor)

    def linea(self, pts, ancho_km, valor=255):
        xy = self._xy(pts)
        if xy and len(xy) >= 2:
            w = ancho_km / self.p.km_px * self.k
            self.d.line(xy, fill=valor, width=max(1, int(round(w))), joint="curve")

    def punto(self, lon, lat, valor=255):
        xy = self._xy([(lon, lat)])
        if xy:
            self.d.point(xy[0], fill=valor)

    def matriz(self):
        return np.asarray(self.img.resize((self.n, self.n), Image.LANCZOS), np.float32) / 255


def ruido(n, celdas, octavas, semilla):
    """Ruido de valor suave en [0, 1], n x n pixeles."""
    r = np.random.default_rng(semilla)
    acc = np.zeros((n, n), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octavas):
        c = min(n, celdas * 2 ** o)
        g = (r.random((c, c)) * 255).astype(np.uint8)
        acc += amp * np.asarray(Image.fromarray(g).resize((n, n), Image.BICUBIC), np.float32) / 255
        tot += amp
        amp *= 0.5
    return acc / tot


# ---------------------------------------------------------------- Blue Marble
def blue_marble():
    """Campos de color de tierra y de agua por separado (asi la costa nitida no mezcla verde con azul)."""
    import mpl_toolkits.basemap_data as bd
    from global_land_mask import globe
    bm = np.asarray(Image.open(os.path.join(list(bd.__path__)[0], "bmng.jpg")).convert("RGB"), np.float32) / 255
    h, w = bm.shape[:2]
    lat = 90 - (np.arange(h) + 0.5) * 180 / h
    lon = -180 + (np.arange(w) + 0.5) * 360 / w
    f0, f1 = np.searchsorted(-lat, -12), np.searchsorted(-lat, 82)          # +12 a -82
    c0, c1 = np.searchsorted(lon, -125), np.searchsorted(lon, 10)
    bm, lat, lon = bm[f0:f1, c0:c1], lat[f0:f1], lon[c0:c1]
    LON, LAT = np.meshgrid(lon, lat)
    tierra = globe.is_land(LAT, LON)
    tierra = ndimage.binary_erosion(tierra, iterations=1)                    # pixeles de tierra sin mezcla de costa
    agua = ndimage.binary_erosion(~ndimage.binary_dilation(tierra, iterations=2), iterations=1)

    def extender(mascara, sigma):
        m = mascara.astype(np.float32)
        num = np.dstack([ndimage.gaussian_filter(bm[..., i] * m, sigma) for i in range(3)])
        den = ndimage.gaussian_filter(m, sigma)[..., None]
        campo = num / np.maximum(den, 1e-4)
        return np.where(m[..., None] > 0, bm, campo), den[..., 0]

    t1, d1 = extender(tierra, 1.5)
    t2, _ = extender(tierra, 12)
    campo_tierra = np.where(d1[..., None] > 0.02, t1, t2)
    a1, e1 = extender(agua, 1.5)
    a2, _ = extender(agua, 12)
    campo_agua = np.where(e1[..., None] > 0.02, a1, a2)

    def muestrear(campo, LATp, LONp):
        fy = (lat[0] - LATp) / (180 / h)
        fx = (LONp - lon[0]) / (360 / w)
        return np.dstack([ndimage.map_coordinates(campo[..., i], [fy, fx], order=3, mode="nearest") for i in range(3)])

    return lambda LATp, LONp: (muestrear(campo_tierra, LATp, LONp), muestrear(campo_agua, LATp, LONp))


# ---------------------------------------------------------------- vectores
def costas_y_rios(proy, resolucion):
    """Poligonos de GSHHG y lineas de WDBII de la caja que cubre la proyeccion."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.basemap import Basemap
    lat0, lat1, lon0, lon1 = proy.caja()
    fig, ax = plt.subplots()
    m = Basemap(projection="cyl", llcrnrlon=lon0, urcrnrlon=lon1, llcrnrlat=lat0, urcrnrlat=lat1,
                resolution=resolucion, area_thresh=0.5 if resolucion == "f" else 30, ax=ax)
    pols = [(t, np.column_stack(p)) for t, p in zip(m.coastpolygontypes, m.coastpolygons)]
    rios = [np.asarray(s) for s in m.drawrivers().get_segments()]
    plt.close(fig)
    return pols, rios


def mascara_tierra(proy, pols):
    L = Lienzo(proy)
    for nivel, valor in ((1, 255), (2, 0), (3, 255), (4, 0)):       # tierra, lagos, islas en lagos, lagunas en islas
        for t, p in pols:
            if t == nivel:
                L.poligono(p, valor)
    return L.matriz()


def rios_principales(proy):
    """Mascaras anchas alrededor de los rios con nombre de Natural Earth, para clasificar los tramos de WDBII."""
    clases = {"Río Negro": Lienzo(proy, ss=1), "Uruguay": Lienzo(proy, ss=1), "Paraná": Lienzo(proy, ss=1)}
    for f in natural_earth("ne_10m_rivers_lake_centerlines_scale_rank"):
        nombre = f["properties"].get("name")
        if nombre in clases and f["geometry"]:
            for ln in lineas_de(f["geometry"]):
                a = np.asarray(ln)
                if a[:, 0].max() < -70 or a[:, 0].min() > -45 or a[:, 1].min() > -20:   # el Rio Negro de la Patagonia y otros homonimos
                    continue
                if nombre == "Río Negro" and a[:, 1].min() < -36:
                    continue
                clases[nombre].linea(ln, 14)
    return {k: np.asarray(v.img) > 0 for k, v in clases.items()}


ANCHO_KM = {"Paraná": 2.4, "Uruguay": 1.3, "Río Negro": 0.55}     # anchos reales aproximados del cauce
ANCHO_MENOR_KM = 0.12                                              # arroyos y rios menores: no llegan al pixel


def dibujar_rios(proy, rios, tierra):
    """Devuelve (agua de rios 0..1, monte ribereño 0..1). El ancho sale de la clase del tramo, no del gusto."""
    princ = rios_principales(proy)
    agua, monte = Lienzo(proy), Lienzo(proy)
    n = proy.px
    for seg in rios:
        x, y, cosc = proy.adelante(seg[:, 1], seg[:, 0])
        dentro = (x >= 0) & (x < n) & (y >= 0) & (y < n)
        if not dentro.any():
            continue
        xi, yi = x[dentro].astype(int), y[dentro].astype(int)
        clase, mejor = None, 0.5
        for nombre, m in princ.items():
            frac = m[yi, xi].mean()
            if frac > mejor:
                clase, mejor = nombre, frac
        km = ANCHO_KM.get(clase, ANCHO_MENOR_KM)
        cobertura = min(1.0, km / proy.km_px)                      # un rio mas angosto que el pixel lo tiñe en parte
        agua.linea(seg, max(km, proy.km_px), int(255 * cobertura))
        monte.linea(seg, max(km + (3.0 if clase else 1.2), proy.km_px * 1.5), 255 if clase else 150)
    a = agua.matriz() * (tierra > 0.5)
    mo = ndimage.gaussian_filter(monte.matriz(), 0.8) * (tierra > 0.5)
    return a, mo


# ---------------------------------------------------------------- ciudades
def ciudades(proy, px=None):
    """Mancha urbana, densidad de poblacion, influencia suburbana, rutas y densidad de localidades chicas (0..1)."""
    n = px or proy.px
    esc = n / proy.px
    km_px = proy.km_px / esc
    U = Lienzo(proy, px=n)
    for f in natural_earth("ne_10m_urban_areas"):
        g = f["geometry"]
        if not g:
            continue
        pols = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for pol in pols:
            a = np.asarray(pol[0])
            if abs(a[0, 1] - NADIR[0]) > proy.radio * 1.5:
                continue
            U.poligono(pol[0], 255)
            for hueco in pol[1:]:
                U.poligono(hueco, 0)
    urbano = np.clip(ndimage.gaussian_filter(U.matriz(), 0.9), 0, 1)             # borde de la mancha sin escalones
    dens = np.zeros((n, n), np.float32)
    lejos = np.zeros((n, n), np.float32)
    chicos = np.zeros((n, n), np.float32)                    # localidades de menos de 200.000 habitantes
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    for f in natural_earth("ne_10m_populated_places_simple"):
        p = f["properties"]
        pob = max(p.get("pop_max") or 0, 1500)
        lon, lat = f["geometry"]["coordinates"]
        x, y, cosc = proy.adelante(np.array([lat]), np.array([lon]))
        x, y = float(x[0]) * esc, float(y[0]) * esc
        if not (-50 < x < n + 50 and -50 < y < n + 50):
            continue
        sig = 3.0 * (pob / 1e5) ** 0.30 / km_px                    # km -> px. Buenos Aires ~13 km, Montevideo ~7 km
        amp = min(1.0, 0.25 + 0.16 * math.log10(pob / 1e3))
        r = int(max(3, sig * 9))
        x0, x1, y0, y1 = max(0, int(x) - r), min(n, int(x) + r + 1), max(0, int(y) - r), min(n, int(y) + r + 1)
        if x0 >= x1 or y0 >= y1:
            continue
        d2 = (xx[y0:y1, x0:x1] - x) ** 2 + (yy[y0:y1, x0:x1] - y) ** 2
        dens[y0:y1, x0:x1] = np.maximum(dens[y0:y1, x0:x1], amp * np.exp(-d2 / (2 * max(sig, 0.6) ** 2)))
        lejos[y0:y1, x0:x1] = np.maximum(lejos[y0:y1, x0:x1], amp * np.exp(-d2 / (2 * (max(sig, 0.6) * 3.2) ** 2)))
        if pob < 2e5:
            chicos[y0:y1, x0:x1] = np.maximum(chicos[y0:y1, x0:x1], amp * np.exp(-d2 / (2 * max(sig, 0.6) ** 2)))
    R = Lienzo(proy, px=n)
    for f in natural_earth("ne_10m_roads"):
        g = f["geometry"]
        if not g or f["properties"].get("type") in ("Ferry Route", "Ferry, seasonal", "Track", "Unknown"):
            continue
        for ln in lineas_de(g):
            a = np.asarray(ln)
            if abs(a[0, 1] - NADIR[0]) > proy.radio * 1.4 or abs(a[0, 0] - NADIR[1]) > proy.radio * 2.2:
                continue
            R.linea(ln, km_px, 255)
    return urbano, dens, lejos, R.matriz(), chicos


def luces(proy, px, semilla):
    """Luces urbanas: manchas reales de Natural Earth moduladas por densidad, con corredores sobre las rutas."""
    urbano, dens, lejos, rutas, chicos = ciudades(proy, px)
    n = px
    km_px = proy.km_px * proy.px / n
    grano = ruido(n, max(4, int(n * km_px / 1.6)), 2, semilla)                 # manzanas y barrios (~1,6 km)
    barrios = ruido(n, max(4, int(n * km_px / 9)), 3, semilla + 1)             # zonas (~9 km)
    textura = np.clip(0.25 + 1.1 * grano, 0, 1) * np.clip(0.45 + 0.9 * barrios, 0, 1)
    centro = np.clip(dens * 1.35, 0, 1)
    ciudad = urbano * (0.22 + 0.78 * centro ** 1.5) * textura
    # localidades chicas sin mancha propia en los datos: un punto tenue del tamano de su densidad
    pueblos = np.clip(chicos - 0.18, 0, 1) * (urbano < 0.2) * 0.9 * np.clip(0.4 + grano, 0, 1)
    # corredores: tramos de ruta cerca de las ciudades, a manchones (no una linea continua)
    salpicado = (ruido(n, max(4, int(n * km_px / 2.5)), 1, semilla + 2) > 0.58).astype(np.float32)
    corredor = rutas * np.clip(lejos * 1.6 - 0.12, 0, 1) * salpicado * 0.55
    L = np.maximum.reduce([ciudad, pueblos, corredor])
    L = np.clip(0.85 * L + 0.30 * ndimage.gaussian_filter(L, 1.0) + 0.10 * ndimage.gaussian_filter(L, 3.0), 0, 1)
    return L, urbano


# ---------------------------------------------------------------- pintura
def pintar(proy, resolucion, muestrear, nubes, semilla):
    LAT, LON, rho = proy.atras()
    pols, rios = costas_y_rios(proy, resolucion)
    tierra = mascara_tierra(proy, pols)
    agua_rio, monte = dibujar_rios(proy, rios, tierra)
    col_t, col_a = muestrear(LAT, LON)
    n = proy.px
    # textura fina del terreno: Blue Marble da el tono a 7 km; esto suma la variacion de campos y montes
    fino = ruido(n, max(8, int(n * proy.km_px / 6)), 4, semilla)
    medio = ruido(n, max(8, int(n * proy.km_px / 40)), 3, semilla + 5)
    col_t = np.clip(col_t, 0, 1) ** 0.82 * 1.12                                  # Blue Marble es oscuro: se aclara el terreno
    col_t = col_t * (0.90 + 0.20 * fino)[..., None] * (0.94 + 0.12 * medio)[..., None]
    col_t = col_t * (1 - 0.38 * monte)[..., None] + np.array([0.05, 0.11, 0.05], np.float32) * (0.38 * monte)[..., None]
    urbano = ciudades(proy)[0]
    gris = np.array([0.42, 0.41, 0.39], np.float32)
    col_t = col_t * (1 - 0.45 * urbano)[..., None] + gris * (0.45 * urbano)[..., None]
    # aguas interiores (lagos, embalses, rios): mas oscuras que el mar, con el tinte del agua cercana
    interior = np.array([0.045, 0.085, 0.105], np.float32)
    lejos_mar = ndimage.gaussian_filter(tierra, 6) > 0.72                      # agua rodeada de tierra
    col_a = np.where(lejos_mar[..., None], 0.55 * col_a + 0.45 * interior, col_a)
    img = col_t * tierra[..., None] + col_a * (1 - tierra)[..., None]
    img = img * (1 - agua_rio)[..., None] + interior * agua_rio[..., None]
    if nubes:
        nb = ruido(n, 10, 6, semilla + 9)
        despejado = np.clip((rho * proy.radio - 8.5) / 6, 0, 1)               # cielo limpio sobre el Rio de la Plata
        cl = np.clip((nb - 0.55) * 3.4, 0, 1) * despejado
        img = img * (1 - 0.9 * cl)[..., None] + 0.95 * (0.9 * cl)[..., None]
    return np.clip(img, 0, 1), dict(tierra=tierra, rio=agua_rio, LAT=LAT, LON=LON)


def guardar_dia(a, nombre):
    Image.fromarray((a * 255).astype(np.uint8), "RGB").save(nombre)


def guardar_noche(luz, agua, nombre):
    """R: luces urbanas (raiz cuadrada, para conservar lo tenue). G: mascara de agua (mar, rios, lagos)."""
    n = luz.shape[0]
    if agua.shape[0] != n:
        agua = np.asarray(Image.fromarray((agua * 255).astype(np.uint8)).resize((n, n), Image.LANCZOS), np.float32) / 255
    rgb = np.dstack([np.sqrt(np.clip(luz, 0, 1)), np.clip(agua, 0, 1), np.zeros_like(luz)])
    Image.fromarray((rgb * 255).astype(np.uint8), "RGB").save(nombre)


def control(proy, dia, noche, nombre):
    """Vista de control con ciudades de referencia marcadas (verifica orientacion y posiciones)."""
    refs = {"Montevideo": (-34.90, -56.19), "Buenos Aires": (-34.61, -58.38), "Rivera": (-30.90, -55.55),
            "Salto": (-31.39, -57.96), "Paso de los Toros": (-32.81, -56.51), "Punta del Este": (-34.96, -54.95),
            "Mercedes": (-33.25, -58.03), "Porto Alegre": (-30.03, -51.23), "Rosario": (-32.95, -60.65)}
    im = Image.fromarray((dia * 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    for k, (la, lo) in refs.items():
        x, y, c = proy.adelante(np.array([la]), np.array([lo]))
        x, y = float(x[0]) * 1024 / proy.px, float(y[0]) * 1024 / proy.px
        if 0 < x < 1024 and 0 < y < 1024:
            d.ellipse((x - 3, y - 3, x + 3, y + 3), outline=(255, 60, 60))
            d.text((x + 5, y - 5), k, fill=(255, 255, 255))
    im.save(f"{SALIDA}/review/{nombre}_dia.png")
    nn = np.asarray(Image.fromarray((np.sqrt(noche) * 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS))
    Image.fromarray(nn).save(f"{SALIDA}/review/{nombre}_noche.png")


def main():
    muestrear = blue_marble()
    for nombre, radio, res, nubes, px_noche in (("Detalle", RADIO_DETALLE, "f", False, PX), ("Base", RADIO_BASE, "i", True, PX_NOCHE_BASE)):
        proy = Lambert(radio, PX)
        dia, extra = pintar(proy, res, muestrear, nubes, semilla=31 if nubes else 17)
        noche, _ = luces(proy, px_noche, semilla=77)
        agua = np.clip(1 - extra["tierra"] + extra["rio"], 0, 1)
        guardar_dia(dia, f"{SALIDA}/textures/T_Tierra_{nombre}_Dia.png")
        guardar_noche(noche, agua, f"{SALIDA}/textures/T_Tierra_{nombre}_Noche.png")
        # para Unity: las luces solas, como mapa de emision
        Image.fromarray((np.clip(noche, 0, 1) ** 0.8 * 255).astype(np.uint8), "L").save(f"{SALIDA}/textures/T_Tierra_{nombre}_Luces.png")
        control(proy, dia, noche, "tierra_" + nombre.lower())
        print(nombre, "ok ·", round(proy.km_px, 2), "km/px · tierra", round(float(extra["tierra"].mean()), 3), "· luces", round(float((noche > 0.05).mean()), 4))


if __name__ == "__main__":
    main()
