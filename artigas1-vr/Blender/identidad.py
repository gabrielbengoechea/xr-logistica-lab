"""Identidad visual de la Estacion Artigas-1: placas institucionales y senaletica logistica.

Un atlas de 1024 x 1024 con 32 celdas de 512 x 64 y un material propio. Las placas se colocan sobre
mamparos y paredes de la estacion armada (coordenadas de la estacion: eje Y, Z arriba).
"""
import math
import os
import sys

import bpy
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import TEX, collection  # noqa: E402
from modulo import A, quad  # noqa: E402

FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
AZUL, CELESTE, GRAFITO, BLANCO = (0, 56, 148), (116, 172, 223), (28, 30, 34), (245, 245, 242)
AMARILLO, ROJO, NEGRO = (250, 200, 0), (190, 30, 30), (20, 20, 20)
# clave: (texto, fondo, color del texto)
PLACAS = {
    "estacion": ("ESTACIÓN ARTIGAS-1", BLANCO, AZUL),
    "uruguay": ("URUGUAY · ESTACIÓN LOGÍSTICA ORBITAL", AZUL, BLANCO),
    "deposito": ("DEPÓSITO LOGÍSTICO", GRAFITO, BLANCO),
    "almacenamiento": ("ALMACENAMIENTO", GRAFITO, BLANCO),
    "carga": ("CARGA · DESCARGA", GRAFITO, BLANCO),
    "equipamiento": ("EQUIPAMIENTO", GRAFITO, BLANCO),
    "herramientas": ("HERRAMIENTAS", GRAFITO, BLANCO),
    "inventario": ("INVENTARIO", GRAFITO, BLANCO),
    "critico": ("MATERIAL CRÍTICO", AMARILLO, NEGRO),
    "seguridad": ("ZONA DE SEGURIDAD", AMARILLO, NEGRO),
    "restringido": ("ACCESO RESTRINGIDO", ROJO, BLANCO),
    "escotilla": ("ESCOTILLA", GRAFITO, BLANCO),
    "observacion": ("MÓDULO DE OBSERVACIÓN", GRAFITO, BLANCO),
    "tac": ("A1-TAC · TACUAREMBÓ", BLANCO, AZUL),
    "mvd": ("A1-MVD · NODO MONTEVIDEO", BLANCO, AZUL),
    "riv": ("A1-RIV · RIVERA", BLANCO, AZUL),
    "col": ("A1-COL · COLONIA", BLANCO, AZUL),
    "far": ("A1-FAR · CÚPULA FARO", BLANCO, AZUL),
    "cr01": ("CR-01 · CARGUERO CHARRÚA", BLANCO, AZUL),
}
CLAVES = list(PLACAS)
W, H = 0.40, 0.05          # tamano de una placa en metros (8:1, como la celda)


def write_atlas():
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (1024, 1024), GRAFITO)
    d = ImageDraw.Draw(img)
    for i, k in enumerate(CLAVES):
        txt, bg, fg = PLACAS[k]
        x0, y0 = (i % 2) * 512, (i // 2) * 64
        d.rectangle((x0, y0, x0 + 511, y0 + 63), fill=bg)
        x_txt = x0 + 256
        if bg == BLANCO:                       # placas institucionales: franjas celestes a la izquierda
            for s in range(4):
                d.rectangle((x0 + 8, y0 + 9 + s * 12, x0 + 40, y0 + 15 + s * 12), fill=CELESTE)
            x_txt = x0 + 276
        if bg == AMARILLO:                     # seguridad: bandas negras en los extremos
            for xx in (x0 + 6, x0 + 478):
                for s in range(-2, 4):
                    d.polygon([(xx + s * 12, y0 + 58), (xx + s * 12 + 6, y0 + 58), (xx + s * 12 + 28, y0 + 6), (xx + s * 12 + 22, y0 + 6)], fill=NEGRO)
            d.rectangle((x0 + 40, y0 + 4, x0 + 472, y0 + 59), fill=AMARILLO)
        size = 34
        ancho = 400 if bg == AMARILLO else 440
        while d.textlength(txt, font=ImageFont.truetype(FB, size)) > ancho and size > 12:
            size -= 1
        d.text((x_txt, y0 + 32), txt, font=ImageFont.truetype(FB, size), fill=fg, anchor="mm")
        d.rectangle((x0, y0, x0 + 511, y0 + 63), outline=fg, width=3)
    p = os.path.join(TEX, "T_Artigas_Identidad.png")
    img.save(p)
    return p


def material(path):
    m = bpy.data.materials.new("M_Artigas_Identidad")
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.5          # vinilo industrial
    return m


def build():
    """Crea una malla por placa en la coleccion Identidad. Devuelve {clave: objeto}."""
    col = collection("Identidad")
    mat = material(write_atlas())
    placas = {}
    for i, k in enumerate(CLAVES):
        c, r = i % 2, i // 2
        uv = (c * 0.5, 1 - (r + 1) / 16, (c + 1) * 0.5, 1 - r / 16)
        placas[k] = quad(f"SM_Placa_{k}", W, H, uv, mat, col)
    return placas


def colocar(placas, link, destino, T, N, R, C, G, CU, largos):
    """Coloca las placas en la estacion armada. T, N, R, C, G, CU: matrices de cada modulo;
    largos: {modulo: (y_inicio, y_fin)} en coordenadas locales."""
    Tr, Rz, Rx = Matrix.Translation, (lambda a: Matrix.Rotation(a, 4, "Z")), (lambda a: Matrix.Rotation(a, 4, "X"))
    n = [0]

    def pon(clave, M, escala=1.0):
        n[0] += 1
        link(placas[clave], f"Placa_{clave}_{n[0]}", M @ Matrix.Diagonal((escala, 1, escala, 1)), destino)

    def mamparo(Mod, y, mira, clave, x, z, escala=1.0):     # mira = +1: la placa mira hacia +Y
        pon(clave, Mod @ Tr((x, y + mira * 0.004, z)) @ (Rz(math.pi) if mira > 0 else Matrix()), escala)

    def pared(Mod, lado, y, z, clave, escala=1.0):          # lado = +1 estribor, -1 babor
        pon(clave, Mod @ Tr((lado * (A - 0.004), y, z)) @ Rz(-lado * math.pi / 2), escala)

    X = 0.96
    # --- Tacuarembo (taller)
    y0, y1 = largos["T"]
    mamparo(T, y0, 1, "estacion", 0, 0.05, 1.8)
    mamparo(T, y0, 1, "uruguay", 0, -0.06)
    mamparo(T, y0, 1, "tac", 0, -0.14)
    mamparo(T, y0, 1, "equipamiento", -0.6, -0.5)
    mamparo(T, y0, 1, "herramientas", 0.6, -0.5)
    mamparo(T, y1, -1, "escotilla", X, -0.32)
    pared(T, -1, y1 - 0.22, 0.30, "critico")
    pared(T, -1, y1 - 0.22, 0.22, "restringido")
    # --- Nodo Montevideo
    y0, y1 = largos["N"]
    for y, mira in ((y0, 1), (y1, -1)):
        mamparo(N, y, mira, "estacion", -X * mira, 0.32)
        mamparo(N, y, mira, "mvd", -X * mira, 0.25)
        mamparo(N, y, mira, "escotilla", X * mira, -0.32)
    pared(N, 1, (y0 + y1) / 2 + 0.86, 0.0, "restringido")
    pared(N, 1, (y0 + y1) / 2 - 0.86, 0.0, "escotilla")
    # --- Rivera (almacen)
    y0, y1 = largos["R"]
    for y, mira in ((y0, 1), (y1, -1)):
        mamparo(R, y, mira, "deposito", -X * mira, 0.33)
        mamparo(R, y, mira, "almacenamiento", -X * mira, 0.26)
        mamparo(R, y, mira, "inventario", X * mira, 0.33)
        mamparo(R, y, mira, "riv", X * mira, 0.26)
        mamparo(R, y, mira, "escotilla", X * mira, -0.32)
    # --- Colonia (recepcion)
    y0, y1 = largos["C"]
    mamparo(C, y0, 1, "estacion", -X, 0.33)
    mamparo(C, y0, 1, "col", -X, 0.26)
    mamparo(C, y0, 1, "carga", X, 0.33)
    mamparo(C, y0, 1, "escotilla", X, -0.32)
    pared(C, 1, 2.35, -0.64, "seguridad")
    pared(C, -1, 1.3, 0.34, "critico")
    pared(C, 1, 0.45, 0.30, "estacion", 1.6)
    # --- Carguero Charrua
    y0, y1 = largos["G"]
    mamparo(G, y1, -1, "cr01", 0, 0.42)
    mamparo(G, y1, -1, "carga", 0, 0.34)
    mamparo(G, y1, -1, "seguridad", 0, -0.45)
    # --- Cupula Faro (placas en el techo, a los lados de la escotilla)
    from cupula import ZT
    for ang, clave in ((math.pi / 2, "observacion"), (-math.pi / 2, "far")):
        pon(clave, CU @ Rz(ang) @ Tr((0, -0.98, ZT - 0.004)) @ Rx(math.pi / 2))
    return n[0]
