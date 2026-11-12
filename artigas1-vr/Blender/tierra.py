"""Texturas de la Tierra con costas reales (global-land-mask, ~1 km):
- T_Tierra_4K.png: global equirectangular 4096 x 2048.
- T_Tierra_Detalle_Uruguay.png: parche 2048 x 2048 (lat -45..-25, lon -66..-46), ~1 km/px,
  con borde transparente para fundirse con la global."""
import numpy as np
from PIL import Image
from global_land_mask import globe
from scipy import ndimage

import os as _os
SALIDA = _os.environ.get("ARTIGAS1_SALIDA", _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "salida"))
_os.makedirs(SALIDA + "/textures", exist_ok=True)
_os.makedirs(SALIDA + "/review", exist_ok=True)
GW, GH = 4096, 2048
DET = dict(lat0=-45.0, lat1=-25.0, lon0=-66.0, lon1=-46.0, W=2048, H=2048)


def gnoise(octaves, base, seed):
    r = np.random.default_rng(seed)
    acc = np.zeros((GH, GW), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        n = base * 2 ** o
        g = r.random((max(2, n // 2), n)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((GW, GH), Image.BICUBIC)
        acc += amp * np.asarray(im, np.float32) / 255; tot += amp; amp *= 0.5
    return acc / tot


N1, N2, NC = gnoise(6, 6, 1), gnoise(5, 10, 2), gnoise(7, 6, 3)


def sample(arr, LAT, LON):
    y = (90 - LAT) / 180 * GH - 0.5
    x = (LON + 180) / 360 * GW - 0.5
    return ndimage.map_coordinates(arr, [y, x], order=1, mode="wrap")


def paint(LAT, LON, px_km, fine=0.0, seed=9):
    land = globe.is_land(LAT, LON)
    n1, n2, nc = sample(N1, LAT, LON), sample(N2, LAT, LON), sample(NC, LAT, LON)
    if fine:
        r = np.random.default_rng(seed)
        h, w = LAT.shape
        f = np.zeros_like(n2); amp = 1.0; tot = 0
        for o in range(4):
            n = 32 * 2 ** o
            g = r.random((n, n)).astype(np.float32)
            f += amp * np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255
            tot += amp; amp *= 0.5
        n2 = n2 * (1 - fine) + (f / tot) * fine
    alat = np.abs(LAT)
    green = np.array([0.17, 0.27, 0.15]); dry = np.array([0.58, 0.50, 0.36]); pampa = np.array([0.34, 0.38, 0.23])
    tundra = np.array([0.42, 0.42, 0.36]); ice = np.array([0.93, 0.95, 0.97])
    t_dry = np.clip(1 - np.abs(alat - 25) / 12, 0, 1) * np.clip(n1 * 1.6 - 0.3, 0, 1)
    col = green * (1 - t_dry[..., None]) + dry * t_dry[..., None]
    pam = (np.clip(1 - np.abs(alat - 34) / 8, 0, 1) * np.clip((LON + 70) / 8, 0, 1) * np.clip((-44 - LON) / 8, 0, 1))[..., None]
    col = col * (1 - pam * 0.7) + pampa * pam * 0.7
    t_tun = np.clip((alat - 55) / 12, 0, 1)[..., None]
    col = col * (1 - t_tun) + tundra * t_tun
    # parches de campo y monte: mezcla hacia un ocre y un verde oscuro segun el ruido fino
    ocre = np.array([0.46, 0.42, 0.28]); monte = np.array([0.12, 0.20, 0.12])
    k1 = np.clip((n2 - 0.52) * 4, 0, 1)[..., None]; k2 = np.clip((0.44 - n2) * 4, 0, 1)[..., None]
    col = col * (1 - 0.55 * k1) + ocre * 0.55 * k1
    col = col * (1 - 0.5 * k2) + monte * 0.5 * k2
    col *= (0.85 + 0.3 * n1)[..., None]
    t_ice = np.maximum(np.clip((alat - 66) / 4, 0, 1), (LAT < -62) * 1.0)
    col = col * (1 - t_ice[..., None]) + ice * t_ice[..., None]
    dist = ndimage.distance_transform_edt(~land) * px_km           # km hasta la costa
    shallow = np.clip(1 - dist / 250, 0, 1) ** 2
    deep = np.array([0.015, 0.06, 0.17]); shal = np.array([0.07, 0.24, 0.36])
    oc = deep * (1 - shallow[..., None]) + shal * shallow[..., None]
    oc *= (0.9 + 0.2 * n2)[..., None]
    rdlp = np.exp(-(((LAT + 34.9) / 0.9) ** 2 + ((LON + 57.4) / 1.5) ** 2)) * np.clip(1 - dist / 400, 0, 1)
    sed = np.array([0.45, 0.38, 0.24])
    oc = oc * (1 - rdlp[..., None] * 0.85) + sed * rdlp[..., None] * 0.85
    polar = (t_ice * (LAT < -70))[..., None]
    oc = oc * (1 - polar) + ice * polar
    img = np.where(land[..., None], col, oc)
    band = 0.45 + 0.25 * np.cos(np.radians(LAT) * 6) ** 2
    cl = np.clip((nc - (1 - band * 0.62)) * 3.2, 0, 1)
    clear = np.exp(-(((LAT + 34) / 6) ** 2 + ((LON + 56) / 9) ** 2))
    cl *= (1 - 0.85 * clear)
    img = img * (1 - cl[..., None] * 0.92) + 0.97 * cl[..., None] * 0.92
    return np.clip(img, 0, 1) ** (1 / 1.1)


lat = 90 - (np.arange(GH) + 0.5) * 180 / GH
lon = -180 + (np.arange(GW) + 0.5) * 360 / GW
LON, LAT = np.meshgrid(lon, lat)
g = paint(LAT, LON, px_km=40075 / GW)
gi = Image.fromarray((g * 255).astype(np.uint8))
gi.save(SALIDA + "/textures/T_Tierra_4K.png")
gi.resize((1024, 512)).save(SALIDA + "/review/tierra_global.png")

d = DET
lat = d["lat1"] - (np.arange(d["H"]) + 0.5) * (d["lat1"] - d["lat0"]) / d["H"]
lon = d["lon0"] + (np.arange(d["W"]) + 0.5) * (d["lon1"] - d["lon0"]) / d["W"]
LON, LAT = np.meshgrid(lon, lat)
px = (d["lat1"] - d["lat0"]) * 111.0 / d["H"]
det = paint(LAT, LON, px_km=px, fine=0.35)
# alfa: borde que se funde (8 % del ancho)
u = np.minimum(np.arange(d["W"]), d["W"] - 1 - np.arange(d["W"])) / (0.08 * d["W"])
v = np.minimum(np.arange(d["H"]), d["H"] - 1 - np.arange(d["H"])) / (0.08 * d["H"])
alpha = np.clip(np.minimum(v[:, None], u[None, :]), 0, 1)
rgba = np.dstack([det, alpha])
di = Image.fromarray((rgba * 255).astype(np.uint8), "RGBA")
di.save(SALIDA + "/textures/T_Tierra_Detalle_Uruguay.png")
di.convert("RGB").resize((800, 800)).save(SALIDA + "/review/tierra_detalle.png")
print("ok")
