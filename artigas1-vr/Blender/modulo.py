"""Modulo Rivera (almacen) de la estacion Artigas-1.

Eje del modulo = Y. Seccion octogonal: 4 paredes de racks (piso, techo,
babor, estribor) a 1,2 m del eje y 4 esquinas en chanfle con barandas y luces.
Racks de 1,05 m a lo largo del eje, 4 por pared (16 en total).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from kitlib import PID, TEX, Part, cell_uv, collection, empty  # noqa: E402

A = 1.2            # apotema: distancia del eje a la cara de los racks
HW = 0.975         # media altura de la cara del rack (1,95 m)
RW = 1.05          # ancho de rack a lo largo del eje
NR = 4             # racks por pared
END = 0.45         # zona sin racks en cada punta
Y0, Y1 = -END, NR * RW + END
HATCH = 0.55       # media abertura de escotilla
HCH = 0.15         # chanfle de la escotilla
TUN = 0.2          # profundidad del tunel de escotilla

WALLS = {          # codigo: normal hacia afuera
    "E": Vector((1, 0, 0)),    # estribor
    "T": Vector((0, 0, 1)),    # techo
    "B": Vector((-1, 0, 0)),   # babor
    "P": Vector((0, 0, -1)),   # piso
}

SIGNS = [  # (texto, fondo, color de texto) -> filas del atlas de senaletica
    ("MÓDULO RIVERA · ALMACÉN", (36, 92, 58), (255, 255, 255)),
    ("↑  Hacia Nodo Montevideo", (28, 30, 34), (255, 255, 255)),
    ("↑  Hacia Módulo Colonia", (28, 30, 34), (255, 255, 255)),
    ("Agarrate de la baranda", (0, 82, 147), (255, 255, 255)),
    ("Trancá la carga: mínimo 2 correas", (0, 82, 147), (255, 255, 255)),
    ("Etiqueta siempre hacia el pasillo", (28, 30, 34), (255, 255, 255)),
    ("Escotilla: cerrala al pasar", (0, 82, 147), (255, 255, 255)),
    ("ESTACIÓN ARTIGAS-1", (245, 245, 242), (0, 56, 148)),
]
SIGN_ROWS, SIGN_H = 8, 96            # 8 filas de 1024 x 96 px
RACK_IDS = [f"RIV-{w}{i}" for w in "ETBP" for i in range(1, NR + 1)]


def octagon(apo, half):
    """Vertices (x, z) de un octogono de lados largos en los ejes."""
    return [(half, apo), (apo, half), (apo, -half), (half, -apo),
            (-half, -apo), (-apo, -half), (-apo, half), (-half, apo)]


# ---------------------------------------------------------------- texturas
def write_sign_atlas():
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (1024, 1024), (40, 40, 40))
    d = ImageDraw.Draw(img)
    fb = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    for i, (txt, bg, fg) in enumerate(SIGNS):
        y0 = i * SIGN_H
        d.rectangle((0, y0, 1023, y0 + SIGN_H - 1), fill=bg)
        if i == 7:   # franjas celestes del cartel de la estacion
            for k in range(4):
                d.rectangle((0, y0 + 6 + k * 22, 70, y0 + 16 + k * 22), fill=(116, 172, 223))
        size = 58
        while True:
            f = ImageFont.truetype(fb, size)
            w = d.textlength(txt, font=f)
            if w < 940 or size < 20:
                break
            size -= 2
        d.text((512, y0 + SIGN_H / 2), txt, font=f, fill=fg, anchor="mm")
        d.rectangle((0, y0, 1023, y0 + SIGN_H - 1), outline=(255, 255, 255) if bg != (245, 245, 242) else (0, 56, 148), width=3)
    # etiquetas de rack: 16 celdas de 256 x 64 en la franja inferior
    f = ImageFont.truetype(fb, 40)
    for i, rid in enumerate(RACK_IDS):
        x0, y0 = (i % 4) * 256, 768 + (i // 4) * 64
        d.rectangle((x0, y0, x0 + 255, y0 + 63), fill=(240, 240, 236), outline=(30, 30, 30), width=3)
        d.text((x0 + 128, y0 + 32), rid, font=f, fill=(20, 20, 20), anchor="mm")
    p = os.path.join(TEX, "T_Artigas_Senaletica.png")
    img.save(p)
    return p


def sign_material(path):
    m = bpy.data.materials.new("M_Artigas_Senaletica")
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.6
    return m


def quad(name, w, h, uv_rect, mat, col):
    """Cartel plano en XZ mirando a -Y, origen al centro."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([(-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2)],
                   [], [(0, 1, 2, 3)])
    u0, v0, u1, v1 = uv_rect
    uv = me.uv_layers.new(name="UVMap")
    for li, c in zip(range(4), ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
        uv.data[li].uv = c
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


def sign_uv(i):
    return (0.0, 1 - (i + 1) * SIGN_H / 1024, 1.0, 1 - i * SIGN_H / 1024)


def rack_uv(i):
    x0, y0 = (i % 4) * 256, 768 + (i // 4) * 64
    return (x0 / 1024, 1 - (y0 + 64) / 1024, (x0 + 256) / 1024, 1 - y0 / 1024)


# ---------------------------------------------------------------- rack
def rack(mat, col):
    """Rack de almacen: 2 columnas (A, B) x 4 niveles. Frente en y=0 mirando a -Y."""
    p = Part()
    D, T = 0.50, 0.02
    HEAD = 0.08                       # cabezal superior con la etiqueta del rack
    H = 2 * HW
    p.box((0, D - 0.01, HW), (RW, 0.02, H), "gris")                        # fondo
    for x in (-RW / 2 + T / 2, RW / 2 - T / 2):                           # laterales
        p.box((x, (D - 0.02) / 2, HW), (T, D - 0.02, H), "rack", skip=("+y",))
    inner = RW - 2 * T
    p.box((0, (D - 0.02) / 2, H - HEAD / 2), (inner, D - 0.02, HEAD), "rack", skip=("+x", "-x", "+y"))
    p.box((0, (D - 0.02) / 2, T / 2), (inner, D - 0.02, T), "rack", skip=("+x", "-x", "+y"))
    usable = H - HEAD - T
    row = (usable - 3 * T) / 4
    zc = []
    z = T
    for k in range(4):
        zc.append(z + row / 2)
        z += row
        if k < 3:
            p.box((0, (D - 0.02) / 2, z + T / 2), (inner, D - 0.02, T), "rack",
                  skip=("+x", "-x", "+y"))
            z += T
    zb = [T] + [T + (k + 1) * row + k * T + T for k in range(3)]       # base de cada nivel
    for k in range(4):                                                    # divisor central
        p.box((0, (D - 0.02) / 2, zb[k] + row / 2), (T, D - 0.02, row), "rack",
              skip=("+z", "-z", "+y"))
    # etiquetas e-ink de cada hueco (en blanco: el texto va en Unity) sobre el frente del estante
    xs = {"A": -(T / 2 + (inner / 2 - T / 2) / 2), "B": (T / 2 + (inner / 2 - T / 2) / 2)}
    for k in range(4):
        for c, x in xs.items():
            p.box((x - 0.12, -0.002, zb[k] - T / 2), (0.10, 0.006, 0.014), "etiqueta")
    ob = p.finish("SM_Rack_Almacen", mat, col, smooth_angle=None, weld=False)
    w = inner / 2 - T / 2
    for k in range(4):
        for c, x in xs.items():
            name = f"{c}{k + 1}"
            empty(f"SNAP_{name}", (x, D / 2 - 0.02, zb[k] + row / 2), ob, col, size=0.1)
            empty(f"INDICADOR_{name}", (x + 0.08, -0.004, zb[k] - T / 2), ob, col)
            empty(f"ETIQUETA_{name}", (x - 0.12, -0.006, zb[k] - T / 2), ob, col, rot=(math.pi / 2, 0, 0))
            for sx in (-1, 1):
                for sz, tag in ((0, "inf"), (1, "sup")):
                    empty(f"ANCLA_{name}_{'izq' if sx < 0 else 'der'}_{tag}",
                          (x + sx * (w / 2 - 0.03), -0.003, zb[k] + 0.04 + sz * (row - 0.08)),
                          ob, col, size=0.03)
    empty("ETIQUETA_RACK", (-RW / 2 + 0.17, -0.004, H - HEAD / 2), ob, col)
    return ob, zc


# ---------------------------------------------------------------- casco
def casco(mat, col):
    bm = bmesh.new()
    oct_ = octagon(A, HW)

    def ring(y, pts):
        return [bm.verts.new((x, y, z)) for x, z in pts]

    def tag(f, color):
        f.material_index = PID[color]

    # tramos: punta inicial, zona de racks, punta final
    ys = [Y0, 0.0, NR * RW, Y1]
    rings = [ring(y, oct_) for y in ys]
    sides = ["T_E", "E", "E_P", "P", "P_B", "B", "B_T", "T"]  # lado i va de v[i] a v[i+1]
    side_of = {0: "esq_TE", 1: "E", 2: "esq_EP", 3: "P", 4: "esq_PB", 5: "B", 6: "esq_BT", 7: "T"}
    for s in range(3):
        for i in range(8):
            j = (i + 1) % 8
            kind = side_of[i]
            if s == 1 and not kind.startswith("esq"):
                continue                       # aqui van los racks
            f = bm.faces.new((rings[s][i], rings[s][j], rings[s + 1][j], rings[s + 1][i]))
            if kind == "P":
                tag(f, "piso_rivera")
            elif kind in ("esq_EP", "esq_PB"):
                tag(f, "piso_rivera")
            else:
                tag(f, "panel")
    # mamparos con abertura de escotilla + tunel
    inner = octagon(HATCH, HATCH - HCH)
    for y, out_dir in ((Y0, -1), (Y1, 1)):
        ro = rings[0] if out_dir < 0 else rings[3]
        ri = ring(y, inner)
        for i in range(8):
            j = (i + 1) % 8
            f = bm.faces.new((ro[i], ro[j], ri[j], ri[i]))
            tag(f, "panel")
        rt = ring(y + out_dir * TUN, inner)
        for i in range(8):
            j = (i + 1) % 8
            f = bm.faces.new((ri[i], ri[j], rt[j], rt[i]))
            tag(f, "gris")
    # normales hacia el interior (hacia el eje)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        c = f.calc_center_median()
        to_axis = Vector((-c.x, 0, -c.z))
        if abs(f.normal.y) > 0.9:            # mamparos: normal hacia el centro del modulo
            want = 1 if c.y < 2 else -1
            if f.normal.y * want < 0:
                f.normal_flip()
        elif f.normal.dot(to_axis) < 0:
            f.normal_flip()
    p = Part()
    p.bm.free()
    p.bm = bm
    # tiras de luz en las esquinas superiores y franjas de color en el piso
    for sx in (-1, 1):
        c = Vector((sx * (A + HW) / 2, (Y0 + Y1) / 2, (A + HW) / 2)) * 1.0
        c.y = (Y0 + Y1) / 2
        nrm = Vector((sx, 0, 1)).normalized()
        rot = Matrix.Rotation(sx * math.pi / 4, 4, "Y")
        p.box(c - nrm * 0.006, (0.10, NR * RW - 0.2, 0.014), "luz", rot=rot, skip=("+z",))
    ob = p.finish("SM_Modulo_Rivera_Casco", mat, col)
    return ob


def puerta(mat, col):
    """Tapa de escotilla con bisagra a la izquierda (origen en la bisagra)."""
    p = Part()
    h = HATCH + 0.03
    pts = octagon(h, h - HCH)
    pts2 = [(x, z) for x, z in pts]
    p.poly_prism(pts2, 0.05, "gris")
    p.box((0, -0.03, 0), (0.30, 0.012, 0.30), "pantalla")                 # ventanilla
    p.box((0, -0.04, -0.25), (0.20, 0.03, 0.03), "baranda")                # manija
    p.box((0.40, -0.03, 0.0), (0.06, 0.012, 0.06), "led_verde")            # piloto
    ob = p.finish("SM_Escotilla_Puerta", mat, col, smooth_angle=None)
    me = ob.data
    me.transform(Matrix.Translation((h, 0, 0)))                           # bisagra en x=0
    return ob


def build(mat, props):
    col = collection("Modulo_Rivera")
    lay = collection("Layout_Rivera")
    sign_mat = sign_material(write_sign_atlas())
    rk, zc = rack(mat, col)
    cas = casco(mat, col)
    door = puerta(mat, col)
    signs = {}
    for i, (txt, _, _) in enumerate(SIGNS):
        nm = "SM_Cartel_" + ["Modulo", "HaciaNodo", "HaciaColonia", "Baranda", "Trinca",
                             "Etiqueta", "Escotilla", "Estacion"][i]
        signs[i] = quad(nm, 0.80, 0.075, sign_uv(i), sign_mat, col)
    rack_labels = [quad(f"SM_Etiqueta_{rid.replace('-', '_')}", 0.24, 0.06, rack_uv(i), sign_mat, col)
                   for i, rid in enumerate(RACK_IDS)]

    # ------------------------------------------------ armado del modulo (instancias)
    def inst(src, name, mw):
        o = bpy.data.objects.new(name, src.data)
        o.matrix_world = mw
        lay.objects.link(o)
        return o

    inst(cas, "Casco", Matrix())
    k = 0
    for code, n in WALLS.items():
        xl = Vector((0, 1, 0)) if code == "B" else Vector((0, -1, 0))
        zl = xl.cross(n)
        for i in range(NR):
            yc = RW / 2 + i * RW
            org = n * A - zl * HW + Vector((0, yc, 0))
            m = Matrix((
                (xl.x, n.x, zl.x, org.x),
                (xl.y, n.y, zl.y, org.y),
                (xl.z, n.z, zl.z, org.z),
                (0, 0, 0, 1)))
            inst(rk, f"Rack_RIV-{code}{i + 1}", m)
            lab = rack_labels[k]
            head = m @ Vector((-RW / 2 + 0.17, -0.004, 2 * HW - 0.04))
            inst(lab, f"Etiqueta_RIV-{code}{i + 1}", Matrix.Translation(head) @ m.to_3x3().to_4x4())
            k += 1
    # barandas en las 4 esquinas, a lo largo del eje
    bar = props["SM_Baranda_100"]
    for sx in (-1, 1):
        for sz in (-1, 1):
            nrm = Vector((sx, 0, sz)).normalized()
            dist = (A + HW) / 2 * math.sqrt(2) / math.sqrt(2)
            c = Vector((sx * (A + HW) / 2, 0, sz * (A + HW) / 2))
            off = 0.06 if sz > 0 else 0.0
            for i in range(NR):
                y = RW / 2 + i * RW
                along = Vector((0, 1, 0))
                side = along.cross(nrm) * (0.09 if sz > 0 else 0.0)
                zax = -nrm
                xax = along
                yax = zax.cross(xax)
                pos = c + Vector((0, y, 0)) + side
                m = Matrix(((xax.x, yax.x, zax.x, pos.x), (xax.y, yax.y, zax.y, pos.y),
                            (xax.z, yax.z, zax.z, pos.z), (0, 0, 0, 1)))
                inst(bar, f"Baranda_{'E' if sx > 0 else 'B'}{'T' if sz > 0 else 'P'}_{i + 1}", m)
    # barandas verticales junto a cada escotilla
    bar50 = props["SM_Baranda_050"]
    for y, s in ((Y0, 1), (Y1, -1)):
        for sx in (-1, 1):
            pos = Vector((sx * (HATCH + 0.16), y, 0))
            xax, zax = Vector((0, 0, 1)), Vector((0, s, 0))
            yax = zax.cross(xax)
            m = Matrix(((xax.x, yax.x, zax.x, pos.x), (xax.y, yax.y, zax.y, pos.y),
                        (xax.z, yax.z, zax.z, pos.z), (0, 0, 0, 1)))
            inst(bar50, f"Baranda_Escotilla_{'ini' if s > 0 else 'fin'}_{sx}", m)
    # puertas: hacia el Nodo abierta, hacia Colonia cerrada
    h = HATCH + 0.03
    d1 = inst(door, "Escotilla_HaciaNodo", Matrix.Translation((-h, Y0 - TUN - 0.026, 0)) @ Matrix.Rotation(math.radians(-100), 4, "Z"))
    d2 = inst(door, "Escotilla_HaciaColonia", Matrix.Translation((-h, Y1 + TUN + 0.026, 0)))

    # carteles (mirando al interior)
    def place_sign(i, pos, facing_y):
        rot = Matrix() if facing_y > 0 else Matrix.Rotation(math.pi, 4, "Z")
        # el quad mira a -Y: en el mamparo inicial (y=Y0) debe mirar a +Y
        rot = Matrix.Rotation(math.pi, 4, "Z") if facing_y > 0 else Matrix()
        inst(signs[i], f"Cartel_{i}_{round(pos.y, 2)}", Matrix.Translation(pos) @ rot)

    place_sign(0, Vector((0, Y1 - 0.004, HATCH + 0.22)), -1)
    place_sign(0, Vector((0, Y0 + 0.004, HATCH + 0.22)), 1)
    place_sign(1, Vector((0, Y0 + 0.004, -HATCH - 0.17)), 1)
    place_sign(2, Vector((0, Y1 - 0.004, -HATCH - 0.17)), -1)
    place_sign(7, Vector((0, Y0 + 0.004, HATCH + 0.33)), 1)
    place_sign(7, Vector((0, Y1 - 0.004, HATCH + 0.33)), -1)
    # carteles de seguridad bajo la escotilla
    for i, z in ((3, -HATCH - 0.27), (5, -HATCH - 0.37)):
        place_sign(i, Vector((0, Y0 + 0.004, z)), 1)
    for i, z in ((4, -HATCH - 0.27), (6, -HATCH - 0.37)):
        place_sign(i, Vector((0, Y1 - 0.004, z)), -1)
    return {"rack": rk, "casco": cas, "puerta": door, "rows": zc}
