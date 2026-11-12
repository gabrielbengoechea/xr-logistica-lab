"""Kit de props de carga y herramientas de Artigas-1.

Convenciones: 1 unidad = 1 m, Z arriba, frente hacia -Y.
Cargas con origen en el centro (objetos que flotan en 0G).
Barandas, anclajes y racks con origen en la cara de montaje.
"""
import math
import sys

import bpy
from mathutils import Matrix

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from kitlib import Part, collection, empty  # noqa: E402


def baranda(name, L, mat, col):
    p = Part()
    xs = (-(L / 2 - 0.06), L / 2 - 0.06)
    for x in xs:
        p.box((x, 0, 0.004), (0.05, 0.05, 0.008), "gris", skip=("-z",))
        p.cyl((x, 0, 0.036), 0.011, 0.056, "baranda", seg=8, caps=False)
    p.cyl((0, 0, 0.064), 0.016, L, "baranda", seg=12, axis="x")
    ob = p.finish(name, mat, col, smooth_angle=40)
    empty(f"AGARRE_{name}", (0, 0, 0.064), ob, col)
    return ob


def btc(name, h, mat, col, handles_top=1, label=True, dano=False):
    W, D = 0.42, 0.50
    p = Part()
    p.box((0, 0, 0), (W, D, h), "tela", bevel=0.025, seg=2)
    # bolsillo de etiqueta al frente (-Y) y franjas de velcro arriba
    if label and not dano:
        p.box((0, -D / 2 - 0.001, h * 0.05), (0.20, 0.006, 0.10 if h < 0.3 else 0.14), "etiqueta")
    if dano:   # etiqueta torcida y despegada + rasgón
        p.box((-0.03, -D / 2 - 0.003, h * 0.02), (0.20, 0.004, 0.10), "etiqueta",
              rot=Matrix.Rotation(math.radians(-14), 4, "Y"))
        p.box((-0.215, 0.08, 0.0), (0.012, 0.16, 0.05), "oscuro",
              rot=Matrix.Rotation(math.radians(20), 4, "X"))
    for x in (-0.14, 0.14):
        p.box((x, 0, h / 2 + 0.001), (0.03, D - 0.08, 0.006), "velcro")
    # asa frontal (para sacarla del rack) y asas superiores
    p.torus_arc((0, -D / 2 + 0.004, h * 0.32 if h > 0.3 else 0.085), 0.05, 0.008, 180, 360,
                "tela_osc", seg=8, rseg=6, plane="xy")
    tops = [0.0] if handles_top == 1 else [-0.12, 0.12]
    for y in tops:
        p.torus_arc((0, y, h / 2 - 0.004), 0.06, 0.008, 0, 180, "tela_osc", seg=8, rseg=6)
    if dano:   # abolladura en la esquina superior derecha
        from mathutils import Vector
        c = Vector((W / 2, -0.06, h / 2))
        for v in p.bm.verts:
            d = (v.co - c).length
            if d < 0.2:
                f = (1 - d / 0.2) ** 2
                v.co.x -= 0.07 * f
                v.co.z -= 0.05 * f
    ob = p.finish(name, mat, col, smooth_angle=35)
    if label:
        empty(f"ETIQUETA_{name}", (0, -D / 2 - 0.005, h * 0.05), ob, col, rot=(math.pi / 2, 0, 0))
    return ob


def contenedor(name, mat, col):
    X, Y, Z = 0.60, 0.40, 0.40
    p = Part()
    p.box((0, 0, 0), (X, Y, Z), "polimero", bevel=0.012, seg=2)
    for z in (-0.12, 0.0):                                               # nervaduras de refuerzo
        p.box((0, 0, z), (X + 0.008, Y + 0.008, 0.02), "polimero")
    p.box((0, 0, 0.10), (X + 0.006, Y + 0.006, 0.012), "oscuro")         # junta de tapa
    for x in (-0.18, 0.18):                                              # cierres
        for y in (-Y / 2 - 0.005, Y / 2 + 0.005):
            p.box((x, y, 0.10), (0.04, 0.014, 0.06), "acero")
    p.torus_arc((X / 2, 0, 0.05), 0.05, 0.009, -90, 90, "goma", seg=8, rseg=6, plane="xy")
    p.torus_arc((-X / 2, 0, 0.05), 0.05, 0.009, 90, 270, "goma", seg=8, rseg=6, plane="xy")
    p.box((0, -Y / 2 - 0.001, -0.06), (0.22, 0.006, 0.12), "etiqueta")
    ob = p.finish(name, mat, col, smooth_angle=35)
    empty(f"ETIQUETA_{name}", (0, -Y / 2 - 0.005, -0.06), ob, col, rot=(math.pi / 2, 0, 0))
    return ob


def escaner(name, mat, col):
    p = Part()
    tilt = Matrix.Rotation(math.radians(-15), 4, "X")
    p.box((0, 0.015, 0.045), (0.034, 0.045, 0.115), "oscuro", bevel=0.006, seg=1, rot=tilt)
    p.box((0, -0.035, 0.115), (0.062, 0.17, 0.05), "gris", bevel=0.008, seg=1)
    p.box((0, -0.03, 0.141), (0.046, 0.08, 0.004), "pantalla_on")
    p.box((0, -0.121, 0.115), (0.042, 0.006, 0.026), "led_rojo")
    p.box((0, -0.012, 0.075), (0.012, 0.016, 0.03), "acero")             # gatillo
    ob = p.finish(name, mat, col, smooth_angle=35)
    empty(f"AGARRE_{name}", (0, 0.01, 0.04), ob, col)
    empty(f"RAYO_{name}", (0, -0.126, 0.115), ob, col, rot=(math.pi / 2, 0, 0))
    return ob


def trinquete(mat, col):
    p = Part()
    p.box((0, 0, 0.003), (0.05, 0.12, 0.006), "acero")
    for x in (-0.022, 0.022):
        p.box((x, 0.0, 0.022), (0.004, 0.08, 0.034), "acero", skip=("-z",))
    p.cyl((0, 0.01, 0.025), 0.012, 0.043, "acero", seg=12, axis="x")
    p.torus_arc((0, -0.073, 0.006), 0.015, 0.0052, 90, 270, "acero", seg=8, rseg=6, plane="xy")
    base = p.finish("SM_Trinquete_Base", mat, col, smooth_angle=40)
    q = Part()                                     # palanca, pivote en el eje del carrete
    for x in (-0.027, 0.027):
        q.box((x, 0.045, 0.0), (0.004, 0.09, 0.02), "acero")
    q.cyl((0, 0.09, 0.0), 0.011, 0.062, "goma", seg=10, axis="x")
    lev = q.finish("SM_Trinquete_Palanca", mat, col, smooth_angle=40)
    lev.parent = base
    lev.location = (0, 0.01, 0.025)
    empty("CORREA_ENTRA", (0, 0.06, 0.02), base, col)
    return base, lev


def correa(name, L, mat, col, segs=20):
    import bmesh
    p = Part()
    w, t = 0.025, 0.003
    bm = bmesh.new()
    rings = []
    for i in range(segs + 1):
        y = L * i / segs
        rings.append([bm.verts.new((sx * w / 2, y, sz * t / 2))
                      for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for i in range(segs):
        for j in range(4):
            k = (j + 1) % 4
            bm.faces.new((rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    p._merge(bm, "correa", (0, 0, 0), None)
    return p.finish(name, mat, col)


def gancho(name, mat, col):
    p = Part()
    p.torus_arc((0, 0, 0), 0.018, 0.004, 180, 360, "acero", seg=8, rseg=6)
    p.cyl((-0.018, 0, 0.02), 0.004, 0.04, "acero", seg=6)
    p.torus_arc((-0.018, 0, 0.049), 0.009, 0.004, 120, 420, "acero", seg=8, rseg=6)
    return p.finish(name, mat, col, smooth_angle=50)


def punto_anclaje(name, mat, col):
    p = Part()
    p.box((0, 0, 0.003), (0.05, 0.05, 0.006), "gris", skip=("-z",))
    p.torus_arc((0, 0, 0.006), 0.016, 0.0035, 0, 180, "acero", seg=8, rseg=6)
    ob = p.finish(name, mat, col, smooth_angle=50)
    empty(f"ENGANCHE_{name}", (0, 0, 0.022), ob, col)
    return ob


def correas_hueco(name, mat, col, w=0.44, h=0.40):
    """Dos correas verticales con hebilla que retienen la carga en un hueco, a los lados de la etiqueta.
    Frente hacia -Y; las correas van 3 cm por delante del frente del rack."""
    p = Part()
    y = -0.032
    for sx in (-1, 1):
        x = sx * 0.155
        p.box((x, y, 0), (0.028, 0.004, h), "correa")
        p.box((x, y - 0.007, 0.11), (0.042, 0.012, 0.05), "acero", bevel=0.003)   # hebilla de trinquete
        p.box((x, y - 0.014, 0.11), (0.024, 0.004, 0.02), "oscuro")
        for sz in (-1, 1):                                                        # ganchos a los anclajes del rack
            p.box((x, y / 2, sz * h / 2), (0.022, abs(y) + 0.004, 0.022), "acero")
    return p.finish(name, mat, col, smooth_angle=40)


def indicador(name, mat, col):
    p = Part()
    p.box((0, 0, 0), (0.06, 0.008, 0.012), "led_verde", skip=("+y",))
    return p.finish(name, mat, col)


def build(mat):
    col = collection("Props")
    out = [
        baranda("SM_Baranda_050", 0.5, mat, col),
        baranda("SM_Baranda_100", 1.0, mat, col),
        btc("SM_BTC_1", 0.25, mat, col, 1),
        btc("SM_BTC_2", 0.48, mat, col, 2),
        btc("SM_BTC_1_Danada", 0.25, mat, col, 1, dano=True),
        btc("SM_BTC_1_SinEtiqueta", 0.25, mat, col, 1, label=False),
        contenedor("SM_Contenedor_Rigido", mat, col),
        escaner("SM_Escaner", mat, col),
        *trinquete(mat, col),
        correa("SM_Correa_100", 1.0, mat, col),
        correas_hueco("SM_Correas_Hueco", mat, col),
        gancho("SM_Correa_Gancho", mat, col),
        punto_anclaje("SM_Punto_Anclaje", mat, col),
        indicador("SM_Indicador_Hueco", mat, col),
    ]
    return out
