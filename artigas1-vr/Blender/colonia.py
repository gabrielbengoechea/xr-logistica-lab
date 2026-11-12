"""Modulo Colonia (recepcion y acople) + bodega del carguero Charrua.

Misma seccion octogonal que Rivera. Colonia tiene paredes cerradas y equipos
de recepcion; el carguero tiene dos bahias de estiba (babor y estribor).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from kitlib import PID, TEX, Part, collection, empty  # noqa: E402
from modulo import A, HW, HATCH, HCH, TUN, octagon, quad  # noqa: E402

CY0, CY1 = 0.0, 3.4          # Colonia
GY1 = 2.6                    # bodega del carguero (0 = mamparo con escotilla)
GA, GH = 1.15, 0.85          # apotema y media altura de la bodega
COLLAR = 0.06                # anillo de acople entre modulos

SIGNS_C = [
    ("MÓDULO COLONIA · RECEPCIÓN", (0, 56, 148), (255, 255, 255)),
    ("↑  Hacia Módulo Rivera", (28, 30, 34), (255, 255, 255)),
    ("↑  Carguero Charrúa · Puerto de acople", (28, 30, 34), (255, 255, 255)),
    ("Portal RFID: pasá la carga de a una", (28, 30, 34), (255, 255, 255)),
    ("Cuarentena: faltante · sobrante · dañada · ilegible", (250, 200, 0), (20, 20, 20)),
    ("Verificá la presión antes de abrir", (0, 82, 147), (255, 255, 255)),
    ("Zona de preparación: amarrá antes de soltar", (0, 82, 147), (255, 255, 255)),
    ("CARGUERO CHARRÚA · CR-01", (245, 245, 242), (0, 56, 148)),
]
SH = 96


# ---------------------------------------------------------------- atlas
def write_atlas():
    from PIL import Image, ImageDraw, ImageFont
    fb = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    fr = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
    img = Image.new("RGB", (1024, 1024), (20, 22, 26))
    d = ImageDraw.Draw(img)
    for i, (txt, bg, fg) in enumerate(SIGNS_C):
        y0 = i * SH
        d.rectangle((0, y0, 1023, y0 + SH - 1), fill=bg)
        size = 58
        while True:
            f = ImageFont.truetype(fb, size)
            if d.textlength(txt, font=f) < 950 or size < 20:
                break
            size -= 2
        d.text((512, y0 + SH / 2), txt, font=f, fill=fg, anchor="mm")
        d.rectangle((0, y0, 1023, y0 + SH - 1), outline=fg, width=3)
    # pantallas (franja inferior 1024 x 256)
    y0 = 768
    # consola: manifiesto 512 x 256
    d.rectangle((0, y0, 511, y0 + 255), fill=(8, 18, 28))
    d.rectangle((0, y0, 511, y0 + 30), fill=(0, 56, 148))
    d.text((10, y0 + 15), "MANIFIESTO · CR-01 CHARRÚA", font=ImageFont.truetype(fb, 18), fill=(255, 255, 255), anchor="lm")
    fm = ImageFont.truetype(fr, 15)
    rows = [("BTC1-0001", "Alimentos", "OK"), ("BTC1-0002", "Alimentos", "OK"),
            ("BTC2-0003", "Repuestos", "--"), ("BTC1-0004", "Médico", "--"),
            ("BTC1-0005", "Higiene", "--"), ("CR-0006", "Químicos", "--"),
            ("BTC2-0007", "Experimento", "--"), ("BTC1-0008", "Alimentos", "--")]
    d.text((10, y0 + 44), "CÓDIGO      CATEGORÍA     ESTADO", font=fm, fill=(120, 170, 220))
    for k, (c, cat, st) in enumerate(rows):
        col = (90, 220, 120) if st == "OK" else (200, 200, 200)
        d.text((10, y0 + 66 + k * 22), f"{c:<11} {cat:<13} {st}", font=fm, fill=col)
    d.text((500, y0 + 246), "Recibidas 2 / 24", font=ImageFont.truetype(fb, 14), fill=(255, 200, 60), anchor="rb")
    # panel de presion 256 x 128
    x0 = 512
    d.rectangle((x0, y0, x0 + 255, y0 + 127), fill=(6, 20, 10))
    d.text((x0 + 128, y0 + 20), "PRESIÓN ESCOTILLA", font=ImageFont.truetype(fb, 16), fill=(180, 230, 190), anchor="mm")
    d.text((x0 + 128, y0 + 60), "101,3 kPa", font=ImageFont.truetype(fb, 34), fill=(90, 240, 120), anchor="mm")
    d.text((x0 + 128, y0 + 100), "ΔP 0,1 kPa · OK", font=ImageFont.truetype(fb, 18), fill=(90, 240, 120), anchor="mm")
    # display del portal RFID 256 x 128
    x0 = 768
    d.rectangle((x0, y0, x0 + 255, y0 + 127), fill=(8, 18, 28))
    d.text((x0 + 128, y0 + 24), "PORTAL RFID", font=ImageFont.truetype(fb, 18), fill=(120, 190, 240), anchor="mm")
    d.text((x0 + 128, y0 + 72), "Leídas 2 / 24", font=ImageFont.truetype(fb, 30), fill=(255, 255, 255), anchor="mm")
    # marca de piso zona de preparacion 512 x 128
    x0, y1 = 512, y0 + 128
    d.rectangle((x0, y1, x0 + 511, y1 + 127), fill=(250, 200, 0))
    for k in range(-4, 12):
        d.polygon([(x0 + k * 48, y1 + 127), (x0 + k * 48 + 24, y1 + 127), (x0 + k * 48 + 64, y1), (x0 + k * 48 + 40, y1)], fill=(20, 20, 20))
    d.rectangle((x0 + 60, y1 + 30, x0 + 451, y1 + 97), fill=(250, 200, 0))
    d.text((x0 + 256, y1 + 64), "ZONA DE PREPARACIÓN", font=ImageFont.truetype(fb, 30), fill=(20, 20, 20), anchor="mm")
    p = os.path.join(TEX, "T_Artigas_Senaletica_Colonia.png")
    img.save(p)
    return p


def uv_px(x0, y0, w, h):
    return (x0 / 1024, 1 - (y0 + h) / 1024, (x0 + w) / 1024, 1 - y0 / 1024)


def atlas_material(path):
    m = bpy.data.materials.new("M_Artigas_Senaletica_Colonia")
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(t.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.6
    return m


# ---------------------------------------------------------------- helpers
def ring_prism(p, outer, inner, y_front, y_back, color, back=False):
    """Marco octogonal con agujero (x,z) entre y_front y y_back."""
    bm = bmesh.new()
    of = [bm.verts.new((x, y_front, z)) for x, z in outer]
    inf = [bm.verts.new((x, y_front, z)) for x, z in inner]
    ob_ = [bm.verts.new((x, y_back, z)) for x, z in outer]
    ib = [bm.verts.new((x, y_back, z)) for x, z in inner]
    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((of[i], of[j], inf[j], inf[i]))          # frente
        bm.faces.new((of[j], of[i], ob_[i], ob_[j]))          # lado exterior
        bm.faces.new((inf[i], inf[j], ib[j], ib[i]))          # lado interior
        if back:
            bm.faces.new((ob_[j], ob_[i], ib[i], ib[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    p._merge(bm, color, (0, 0, 0), None)


def shell(name, y0, y1, apo, half, floor, mat, col, open_sides=(), open_range=None,
          hatch_ends=(True, True), lights=True, seams=True, light="luz"):
    """Casco octogonal visto desde adentro. open_sides: lados sin pared en open_range."""
    bm = bmesh.new()
    oct_ = octagon(apo, half)
    side_of = {0: "esq_TE", 1: "E", 2: "esq_EP", 3: "P", 4: "esq_PB", 5: "B", 6: "esq_BT", 7: "T"}
    ys = [y0, y1] if not open_range else [y0, open_range[0], open_range[1], y1]
    rings = [[bm.verts.new((x, y, z)) for x, z in oct_] for y in ys]
    for s in range(len(ys) - 1):
        for i in range(8):
            kind = side_of[i]
            if open_range and s == 1 and kind in open_sides:
                continue
            j = (i + 1) % 8
            f = bm.faces.new((rings[s][i], rings[s][j], rings[s + 1][j], rings[s + 1][i]))
            f.material_index = PID[floor if kind in ("P", "esq_EP", "esq_PB") else "panel"]
    inner = octagon(HATCH, HATCH - HCH)
    for k, (y, out_dir) in enumerate(((y0, -1), (y1, 1))):
        ro = rings[0] if out_dir < 0 else rings[-1]
        if hatch_ends[k]:
            ri = [bm.verts.new((x, y, z)) for x, z in inner]
            for i in range(8):
                j = (i + 1) % 8
                bm.faces.new((ro[i], ro[j], ri[j], ri[i])).material_index = PID["panel"]
            rt = [bm.verts.new((x, y + out_dir * TUN, z)) for x, z in inner]
            for i in range(8):
                j = (i + 1) % 8
                bm.faces.new((ri[i], ri[j], rt[j], rt[i])).material_index = PID["gris"]
        else:
            bm.faces.new(ro).material_index = PID["panel"]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mid = (y0 + y1) / 2
    for f in bm.faces:
        c = f.calc_center_median()
        if abs(f.normal.y) > 0.9:
            want = 1 if c.y < mid else -1
            if f.normal.y * want < 0:
                f.normal_flip()
        elif f.normal.dot(Vector((-c.x, 0, -c.z))) < 0:
            f.normal_flip()
    p = Part()
    p.bm.free()
    p.bm = bm
    L = y1 - y0
    if lights:
        for sx in (-1, 1):
            c = Vector((sx * (apo + half) / 2, mid, (apo + half) / 2))
            nrm = Vector((sx, 0, 1)).normalized()
            p.box(c - nrm * 0.006, (0.10, L - 0.6, 0.014), light,
                  rot=Matrix.Rotation(sx * math.pi / 4, 4, "Y"), skip=("+z",))
    if seams:      # juntas de panel en las paredes cerradas
        k = 1
        while y0 + k * 0.85 < y1 - 0.2:
            y = y0 + k * 0.85
            for side, nrm in (("E", (1, 0, 0)), ("B", (-1, 0, 0)), ("T", (0, 0, 1))):
                if side in open_sides and open_range and open_range[0] < y < open_range[1]:
                    continue
                n = Vector(nrm)
                size = (0.012, 0.02, 2 * half - 0.04) if side != "T" else (2 * half - 0.04, 0.02, 0.012)
                p.box(n * (apo - 0.003), size, "gris")
            k += 1
    return p.finish(name, mat, col)


def mount_matrix(n, xl, origin):
    zl = xl.cross(n)
    return Matrix(((xl.x, n.x, zl.x, origin.x), (xl.y, n.y, zl.y, origin.y),
                   (xl.z, n.z, zl.z, origin.z), (0, 0, 0, 1))), zl


# ---------------------------------------------------------------- equipos
def portal_rfid(mat, col):
    p = Part()
    outer = octagon(0.74, 0.74 - 0.2)
    inner = octagon(HATCH + 0.02, HATCH + 0.02 - HCH)
    ring_prism(p, outer, inner, -0.10, 0.0, "panel")
    for sx in (-1, 1):
        p.box((sx * 0.66, -0.103, 0.0), (0.07, 0.008, 0.6), "oscuro")
    p.box((0, -0.103, 0.665), (0.44, 0.008, 0.03), "led_verde")
    ob = p.finish("SM_Portal_RFID", mat, col)
    empty("RFID_VOLUMEN", (0, -0.25, 0), ob, col, size=0.3)
    empty("PANTALLA_RFID", (0, -0.105, -0.665), ob, col)
    empty("LUZ_RFID", (0, -0.105, 0.665), ob, col)
    return ob


def panel_presion(mat, col):
    p = Part()
    p.box((0, -0.02, 0), (0.30, 0.04, 0.44), "gris", skip=("+y",))
    p.box((0, -0.0415, 0.12), (0.26, 0.007, 0.14), "pantalla")
    p.cyl((0, -0.055, -0.06), 0.032, 0.02, "led_ambar", seg=16, axis="y")
    p.cyl((0, -0.044, -0.06), 0.045, 0.012, "oscuro", seg=16, axis="y")
    p.cyl((0, -0.06, -0.16), 0.012, 0.044, "acero", seg=8, axis="y")       # eje de la valvula
    p.box((0, -0.08, -0.16), (0.14, 0.018, 0.022), "baranda")             # manija de la valvula
    ob = p.finish("SM_Panel_Presion", mat, col, smooth_angle=40)
    empty("PANTALLA_PRESION", (0, -0.046, 0.12), ob, col)
    empty("BOTON_ABRIR", (0, -0.06, -0.06), ob, col)
    empty("VALVULA_IGUALAR", (0, -0.08, -0.16), ob, col)
    return ob


def consola(mat, col):
    p = Part()
    p.box((0, -0.03, 0.30), (0.08, 0.06, 0.08), "gris", skip=("+y",))      # soporte de pared
    p.box((0, -0.10, 0.30), (0.04, 0.10, 0.04), "acero")
    p.box((0, -0.17, 0.30), (0.60, 0.04, 0.36), "oscuro", bevel=0.008)   # monitor
    p.box((0, -0.19, 0.30), (0.54, 0.004, 0.28), "pantalla")
    p.box((0, -0.04, -0.02), (0.56, 0.08, 0.03), "gris", skip=("+y",))     # bandeja teclado
    p.box((0, -0.18, -0.02), (0.56, 0.22, 0.02), "gris")
    p.box((0, -0.18, -0.006), (0.46, 0.15, 0.01), "oscuro")              # teclado
    p.cyl((-0.285, -0.18, -0.02), 0.012, 0.20, "baranda", seg=8, axis="y")  # asa lateral
    ob = p.finish("SM_Consola_Recepcion", mat, col, smooth_angle=40)
    empty("PANTALLA_MANIFIESTO", (0, -0.193, 0.30), ob, col)
    return ob


def red_cuarentena(mat, col):
    """Jaula con red, frente hacia -Y, apoyada en la pared (y=0). 1,0 x 0,5 x 0,9 m."""
    p = Part()
    W, D, H = 1.0, 0.5, 0.9
    t = 0.02
    for x in (-W / 2, W / 2):                       # marco
        for z in (-H / 2, H / 2):
            p.box((x, -D / 2, z), (t, D, t), "baranda")
        p.box((x, -D, 0), (t, t, H), "baranda")
    for z in (-H / 2, H / 2):
        p.box((0, -D, z), (W, t, t), "baranda")
    s = 0.006
    for k in range(1, 10):                           # red frontal (abertura en la franja de arriba)
        x = -W / 2 + k * W / 10
        p.box((x, -D, -0.08), (s, s, H - 0.16 - 0.14), "velcro")
    for k in range(1, 7):
        z = -H / 2 + k * (H - 0.14) / 7
        p.box((0, -D, z), (W, s, s), "velcro")
    for x in (-W / 2, W / 2):                        # redes laterales
        for k in range(1, 5):
            p.box((x, -D / 2, -H / 2 + k * H / 5), (s, D, s), "velcro")
            p.box((x, -k * D / 5, 0), (s, s, H), "velcro")
    ob = p.finish("SM_Red_Cuarentena", mat, col)
    empty("CUARENTENA_ENTRADA", (0, -D - 0.05, H / 2 - 0.07), ob, col, size=0.15)
    empty("CUARENTENA_VOLUMEN", (0, -D / 2, 0), ob, col, size=0.4)
    return ob


def anillo_acople(mat, col):
    """Anillo entre dos tuneles de escotilla; deja lugar a la tapa (0,58)."""
    p = Part()
    ci = octagon(0.62, 0.62 - 0.17)
    ti = octagon(HATCH, HATCH - HCH)
    bm = bmesh.new()
    a = [bm.verts.new((x, 0.0, z)) for x, z in ti]
    b = [bm.verts.new((x, 0.0, z)) for x, z in ci]
    c = [bm.verts.new((x, COLLAR, z)) for x, z in ci]
    d = [bm.verts.new((x, COLLAR, z)) for x, z in ti]
    for i in range(8):
        j = (i + 1) % 8
        bm.faces.new((a[i], a[j], b[j], b[i]))
        bm.faces.new((b[i], b[j], c[j], c[i]))
        bm.faces.new((c[i], c[j], d[j], d[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        cc = f.calc_center_median()
        if abs(f.normal.y) < 0.9 and f.normal.dot(Vector((-cc.x, 0, -cc.z))) < 0:
            f.normal_flip()
        elif abs(f.normal.y) > 0.9:
            want = 1 if cc.y < COLLAR / 2 else -1
            if f.normal.y * want < 0:
                f.normal_flip()
    p._merge(bm, "gris", (0, 0, 0), None)
    return p.finish("SM_Anillo_Acople", mat, col)


def bahia_estiba(mat, col):
    """Bahia del carguero: 4 columnas x 3 niveles. Frente en y=0 mirando a -Y."""
    p = Part()
    D, T = 0.55, 0.02
    cw = 0.46
    W = 4 * cw + 5 * T
    H = 2 * GH
    ch = (H - 4 * T) / 3
    p.box((0, D - 0.01, GH), (W, 0.02, H), "gris")
    xs = [-W / 2 + T / 2 + k * (cw + T) for k in range(5)]
    for x in xs:
        p.box((x, (D - 0.02) / 2, GH), (T, D - 0.02, H), "rack", skip=("+y",))
    zs = [T / 2 + k * (ch + T) for k in range(4)]
    for z in zs:
        for k in range(4):
            xc = -W / 2 + T + cw / 2 + k * (cw + T)
            p.box((xc, (D - 0.02) / 2, z), (cw, D - 0.02, T), "rack", skip=("+x", "-x", "+y"))
    ob = p.finish("SM_Carguero_Bahia", mat, col, weld=False)
    for c in range(4):
        xc = -W / 2 + T + cw / 2 + c * (cw + T)
        for n in range(3):
            zc = T + n * (ch + T) + ch / 2
            empty(f"ESTIBA_C{c + 1}_N{n + 1}", (xc, D / 2 - 0.03, zc), ob, col, size=0.1)
            for sx in (-1, 1):
                empty(f"ANCLA_C{c + 1}_N{n + 1}_{'izq' if sx < 0 else 'der'}",
                      (xc + sx * (cw / 2 - 0.03), -0.003, zc), ob, col, size=0.03)
    return ob, W, ch


def marcas_zona(mat_sign, col):
    """Marca de piso 1,6 x 0,4 m (franja amarilla y negra con texto)."""
    return quad("SM_Marca_Zona_Preparacion", 1.6, 0.4, uv_px(512, 896, 512, 128), mat_sign, col)


# ---------------------------------------------------------------- armado
def build(mat, P, rivera_door):
    col = collection("Modulo_Colonia")
    lay = collection("Layout_Colonia")
    gcol = collection("Carguero_Charrua")
    sm = atlas_material(write_atlas())

    cas = shell("SM_Modulo_Colonia_Casco", CY0, CY1, A, HW, "piso_colonia", mat, col)
    portal = portal_rfid(mat, col)
    panel = panel_presion(mat, col)
    cons = consola(mat, col)
    red = red_cuarentena(mat, col)
    anillo = anillo_acople(mat, col)
    zona = marcas_zona(sm, col)
    signs = {i: quad(f"SM_CartelC_{i}", 0.8, 0.075, uv_px(0, i * SH, 1024, SH), sm, col)
             for i in range(len(SIGNS_C))}
    scr_cons = quad("SM_Pantalla_Manifiesto", 0.52, 0.26, uv_px(0, 768, 512, 256), sm, col)
    scr_pres = quad("SM_Pantalla_Presion", 0.24, 0.12, uv_px(512, 768, 256, 128), sm, col)
    scr_rfid = quad("SM_Pantalla_RFID", 0.24, 0.12, uv_px(768, 768, 256, 128), sm, col)
    for s in (scr_cons, scr_pres, scr_rfid):    # las pantallas brillan
        s.data.materials.clear()
    m_scr = bpy.data.materials.new("M_Artigas_Pantallas")
    nt = m_scr.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(os.path.join(TEX, "T_Artigas_Senaletica_Colonia.png"), check_existing=True)
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(t.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.2
    for s in (scr_cons, scr_pres, scr_rfid):
        s.data.materials.append(m_scr)

    # bodega del carguero
    gcas = shell("SM_Carguero_Bodega_Casco", 0.0, GY1, GA, GH, "panel", mat, gcol,
                 open_sides=("E", "B"), open_range=(0.33, 0.33 + 4 * 0.46 + 5 * 0.02),
                 hatch_ends=(True, False), seams=False)
    bahia, BW, ch = bahia_estiba(mat, gcol)
    gsign = signs[7]

    def inst(src, name, mw, c=lay):
        o = bpy.data.objects.new(name, src.data)
        o.matrix_world = mw
        c.objects.link(o)
        return o

    def Rz(a):
        return Matrix.Rotation(a, 4, "Z")

    # --- Colonia
    inst(cas, "Casco_Colonia", Matrix())
    inst(portal, "Portal_RFID", Matrix.Translation((0, CY1, 0)))
    inst(scr_rfid, "Pantalla_RFID", Matrix.Translation((0, CY1 - 0.106, -0.665)))
    inst(panel, "Panel_Presion", Matrix.Translation((0.96, CY1, -0.05)))
    inst(scr_pres, "Pantalla_Presion", Matrix.Translation((0.96, CY1 - 0.046, 0.07)))
    # consola en estribor (mirando al eje)
    m_e = Matrix.Translation((A, 1.25, 0.0)) @ Rz(-math.pi / 2)
    inst(cons, "Consola_Recepcion", m_e)
    inst(scr_cons, "Pantalla_Manifiesto", m_e @ Matrix.Translation((0, -0.1935, 0.30)))
    # red de cuarentena en babor
    m_b = Matrix.Translation((-A, 1.3, -0.35)) @ Rz(math.pi / 2)
    inst(red, "Red_Cuarentena", m_b)
    inst(signs[4], "Cartel_Cuarentena", m_b @ Matrix.Translation((0, -0.004, 0.62)))
    # zona de preparacion en el piso, con 6 anclajes
    zc = Vector((0.0, 2.35, -A + 0.002))
    inst(zona, "Marca_Zona", Matrix.Translation(zc + Vector((0, -0.62, 0))) @ Matrix.Rotation(-math.pi / 2, 4, "X"))
    anc = P["SM_Punto_Anclaje"]
    for i, (x, y) in enumerate([(-0.6, -0.35), (0, -0.35), (0.6, -0.35), (-0.6, 0.35), (0, 0.35), (0.6, 0.35)]):
        inst(anc, f"Anclaje_Zona_{i + 1}", Matrix.Translation(zc + Vector((x, y, 0))))
    inst(signs[6], "Cartel_Zona", Matrix.Translation((A - 0.004, 2.35, -0.55)) @ Rz(-math.pi / 2))
    # barandas de esquina
    bar = P["SM_Baranda_100"]
    for sx in (-1, 1):
        for sz in (-1, 1):
            nrm = Vector((sx, 0, sz)).normalized()
            c = Vector((sx * (A + HW) / 2, 0, sz * (A + HW) / 2))
            for i, y in enumerate((0.75, 1.85, 2.85)):
                xax, zax = Vector((0, 1, 0)), -nrm
                side = xax.cross(nrm) * (0.09 if sz > 0 else 0.0)
                pos = c + Vector((0, y, 0)) + side
                yax = zax.cross(xax)
                inst(bar, f"BarandaC_{sx}{sz}_{i}", Matrix(((xax.x, yax.x, zax.x, pos.x), (xax.y, yax.y, zax.y, pos.y),
                                                              (xax.z, yax.z, zax.z, pos.z), (0, 0, 0, 1))))
    bar50 = P["SM_Baranda_050"]
    for sx, y, s in ((-1, CY0, 1), (1, CY0, 1), (-1, CY1, -1)):
        x = sx * (HATCH + 0.16) if y == CY0 else -1.0
        pos = Vector((x, y, 0))
        xax, zax = Vector((0, 0, 1)), Vector((0, s, 0))
        yax = zax.cross(xax)
        inst(bar50, f"BarandaC_Escotilla_{sx}_{y}", Matrix(((xax.x, yax.x, zax.x, pos.x), (xax.y, yax.y, zax.y, pos.y),
                                                             (xax.z, yax.z, zax.z, pos.z), (0, 0, 0, 1))))
    # carteles en mamparos
    def wall_sign(i, y, z, facing):
        inst(signs[i], f"CartelC_{i}_{y}", Matrix.Translation((0, y, z)) @ (Rz(math.pi) if facing > 0 else Matrix()))
    wall_sign(0, CY0 + 0.004, HATCH + 0.22, 1)
    wall_sign(1, CY0 + 0.004, -HATCH - 0.17, 1)
    wall_sign(2, CY1 - 0.004, 0.85, -1)
    wall_sign(5, CY1 - 0.004, -0.86, -1)
    wall_sign(3, CY1 - 0.004, -0.96, -1)
    # tapa hacia el carguero (cerrada, dentro del anillo)
    h = HATCH + 0.03
    inst(rivera_door, "Escotilla_HaciaCarguero", Matrix.Translation((-h, CY1 + TUN + 0.026, 0)))
    inst(anillo, "Anillo_Acople_Carguero", Matrix.Translation((0, CY1 + TUN, 0)))

    # --- Carguero (en el layout de Colonia, acoplado)
    gy = CY1 + TUN + COLLAR + TUN
    G = Matrix.Translation((0, gy, 0))
    inst(gcas, "Casco_Carguero", G)
    bahias = {}
    for code, n in (("E", Vector((1, 0, 0))), ("B", Vector((-1, 0, 0)))):
        xl = Vector((0, 1, 0)) if code == "B" else Vector((0, -1, 0))
        org = n * GA + Vector((0, 0.33 + BW / 2, 0))
        m, zl = mount_matrix(n, xl, org)
        org = org - zl * GH
        m, zl = mount_matrix(n, xl, org)
        bahias[code] = inst(bahia, f"Bahia_{code}", G @ m)
    inst(gsign, "Cartel_Carguero", G @ Matrix.Translation((0, GY1 - 0.004, 0.55)))
    for sx in (-1, 1):
        for sz in (-1, 1):
            nrm = Vector((sx, 0, sz)).normalized()
            c = Vector((sx * (GA + GH) / 2, 0, sz * (GA + GH) / 2))
            xax, zax = Vector((0, 1, 0)), -nrm
            side = xax.cross(nrm) * (0.09 if sz > 0 else 0.0)
            pos = c + Vector((0, 1.3, 0)) + side
            yax = zax.cross(xax)
            inst(bar, f"BarandaG_{sx}{sz}", G @ Matrix(((xax.x, yax.x, zax.x, pos.x), (xax.y, yax.y, zax.y, pos.y),
                                                        (xax.z, yax.z, zax.z, pos.z), (0, 0, 0, 1))))
    return {"casco": cas, "carguero": gcas, "bahia": bahia, "bahias": bahias, "gy": gy, "lay": lay,
            "anillo": anillo, "ch": ch}
