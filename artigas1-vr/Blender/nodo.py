"""Nodo Montevideo: nudo central de Artigas-1 y sala de operaciones del turno.

Escotillas: +Y hacia Rivera, -Y hacia Tacuarembo (taller), piso (P) hacia la
Cupula Faro y estribor (E) hacia un acople futuro. Pared de babor (B):
panel de balance (minijuego B), dock de tablets, reloj y placa.
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
from colonia import uv_px  # noqa: E402

NL = 2.4                       # largo del nodo
YC = NL / 2
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SIGNS_N = [  # filas de 1024 x 64 desde y=512
    ("NODO MONTEVIDEO · CENTRO DE OPERACIONES", (0, 56, 148), (255, 255, 255)),
    ("↑  Hacia Módulo Rivera · Almacén", (28, 30, 34), (255, 255, 255)),
    ("↑  Hacia Módulo Tacuarembó · Taller", (28, 30, 34), (255, 255, 255)),
    ("↓  Cúpula Faro · Observación", (28, 30, 34), (255, 255, 255)),
    ("Puerto de acople 2 · cerrado", (250, 200, 0), (20, 20, 20)),
    ("Balance: mantené el centro de masa dentro del círculo", (0, 82, 147), (255, 255, 255)),
]
RH = 64


def write_atlas():
    from PIL import Image, ImageDraw, ImageFont
    F = lambda s, b=True: ImageFont.truetype(FB if b else FR, s)  # noqa: E731
    img = Image.new("RGB", (1024, 1024), (10, 16, 24))
    d = ImageDraw.Draw(img)
    # ---- pantalla de balance 1024 x 512 (vista de la estacion desde arriba)
    d.rectangle((0, 0, 1023, 511), fill=(6, 14, 24))
    d.rectangle((0, 0, 1023, 44), fill=(0, 56, 148))
    d.text((16, 22), "BALANCE DE LA ESTACIÓN · CENTRO DE MASA", font=F(24), fill=(255, 255, 255), anchor="lm")
    d.text((1008, 22), "Turno 03 · 14:20 UYT", font=F(18, False), fill=(200, 220, 255), anchor="rm")
    cy = 260
    mods = [("TACUAREMBÓ", 70, 200, (120, 120, 120)), ("NODO MVD", 210, 330, (0, 90, 180)),
            ("RIVERA", 340, 560, (40, 140, 80)), ("COLONIA", 570, 720, (0, 70, 160)),
            ("CHARRÚA", 730, 850, (150, 150, 150))]
    for name, x0, x1, c in mods:
        d.rounded_rectangle((x0, cy - 45, x1, cy + 45), radius=10, outline=c, width=4, fill=(14, 26, 40))
        d.text(((x0 + x1) / 2, cy), name, font=F(16), fill=(230, 230, 230), anchor="mm")
    d.ellipse((240, cy + 60, 300, cy + 120), outline=(110, 170, 230), width=3)
    d.text((270, cy + 135), "CÚPULA", font=F(13), fill=(150, 190, 230), anchor="mm")
    cmx, tol = 455, 70           # tolerancia
    d.ellipse((cmx - tol, cy - tol, cmx + tol, cy + tol), outline=(90, 240, 120), width=3)
    d.line((cmx - tol - 10, cy, cmx + tol + 10, cy), fill=(60, 120, 80), width=1)
    d.line((cmx, cy - tol - 10, cmx, cy + tol + 10), fill=(60, 120, 80), width=1)
    px, py = cmx + 24, cy - 12
    d.ellipse((px - 11, py - 11, px + 11, py + 11), fill=(255, 210, 40))
    d.text((px + 16, py - 18), "CM", font=F(16), fill=(255, 210, 40))
    d.text((24, 400), "Desvío 0,27 m · Tolerancia 0,30 m", font=F(24), fill=(90, 240, 120))
    d.text((24, 436), "Última carga: BTC2-0003 → RIV-E2-A3 (+18 kg)", font=F(19, False), fill=(210, 210, 210))
    d.text((24, 468), "Reglas: químicos lejos de alimentos · A cerca del pasillo", font=F(17, False), fill=(160, 180, 200))
    d.text((1000, 400), "Propelente de control", font=F(18, False), fill=(210, 210, 210), anchor="ra")
    d.rectangle((760, 430, 1000, 456), outline=(200, 200, 200), width=2)
    d.rectangle((763, 433, 763 + int(234 * 0.96), 453), fill=(90, 200, 240))
    d.text((1000, 470), "96 %", font=F(20), fill=(90, 200, 240), anchor="ra")
    # ---- carteles
    for i, (txt, bg, fg) in enumerate(SIGNS_N):
        y0 = 512 + i * RH
        d.rectangle((0, y0, 1023, y0 + RH - 1), fill=bg)
        size = 40
        while d.textlength(txt, font=F(size)) > 960 and size > 16:
            size -= 2
        d.text((512, y0 + RH / 2), txt, font=F(size), fill=fg, anchor="mm")
        d.rectangle((0, y0, 1023, y0 + RH - 1), outline=fg, width=2)
    # ---- reloj (128 x 128) en (0, 896)
    x0, y0 = 0, 896
    d.rectangle((x0, y0, x0 + 127, y0 + 127), fill=(20, 20, 22))
    d.ellipse((x0 + 4, y0 + 4, x0 + 123, y0 + 123), fill=(245, 245, 240), outline=(0, 56, 148), width=5)
    for k in range(12):
        a = math.radians(k * 30)
        r0, r1 = (44, 54) if k % 3 else (38, 54)
        d.line((x0 + 64 + r0 * math.sin(a), y0 + 64 - r0 * math.cos(a), x0 + 64 + r1 * math.sin(a), y0 + 64 - r1 * math.cos(a)), fill=(20, 20, 20), width=3 if k % 3 else 5)
    d.text((x0 + 64, y0 + 84), "MONTEVIDEO", font=F(10), fill=(0, 56, 148), anchor="mm")
    d.text((x0 + 64, y0 + 96), "UTC−3", font=F(10, False), fill=(60, 60, 60), anchor="mm")
    # ---- placa (512 x 128) en (128, 896)
    x0 = 128
    d.rectangle((x0, y0, x0 + 511, y0 + 127), fill=(190, 160, 90))
    d.rectangle((x0 + 6, y0 + 6, x0 + 505, y0 + 121), outline=(90, 70, 30), width=3)
    d.text((x0 + 256, y0 + 34), "ESTACIÓN ORBITAL ARTIGAS-1", font=F(30), fill=(50, 35, 10), anchor="mm")
    d.text((x0 + 256, y0 + 70), "Nodo Montevideo", font=F(22, False), fill=(50, 35, 10), anchor="mm")
    d.text((x0 + 256, y0 + 100), "Primera estación logística de Uruguay", font=F(18, False), fill=(50, 35, 10), anchor="mm")
    # ---- pantalla de tablet (256 x 128) en (640, 896)
    x0 = 640
    d.rectangle((x0, y0, x0 + 255, y0 + 127), fill=(8, 18, 28))
    d.rectangle((x0, y0, x0 + 255, y0 + 22), fill=(0, 56, 148))
    d.text((x0 + 8, y0 + 11), "TURNO 03 · TAREAS", font=F(13), fill=(255, 255, 255), anchor="lm")
    for k, (t, ok) in enumerate((("1 Briefing", True), ("2 Recepción", True), ("3 Almacenar", False), ("4 Picking", False))):
        d.text((x0 + 10, y0 + 32 + k * 22), ("✓ " if ok else "○ ") + t, font=F(14, False), fill=(90, 230, 120) if ok else (220, 220, 220))
    p = os.path.join(TEX, "T_Artigas_Nodo.png")
    img.save(p)
    return p


def materials(path):
    def mk(name, emis):
        m = bpy.data.materials.new(name)
        nt = m.node_tree
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(path, check_existing=True)
        nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
        if emis:
            nt.links.new(t.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = emis
        bsdf.inputs["Roughness"].default_value = 0.5
        return m
    return mk("M_Artigas_Senaletica_Nodo", 0.0), mk("M_Artigas_Pantallas_Nodo", 1.2)


# ---------------------------------------------------------------- casco
def casco(mat, col):
    bm = bmesh.new()
    V = lambda p: bm.verts.new(p)  # noqa: E731
    oct_ = octagon(A, HW)
    r0 = [V((x, 0.0, z)) for x, z in oct_]
    r1 = [V((x, NL, z)) for x, z in oct_]
    side_of = {0: "esq", 1: "E", 2: "esq_P", 3: "P", 4: "esq_P", 5: "B", 6: "esq", 7: "T"}
    faces = []
    for i in range(8):
        j = (i + 1) % 8
        if side_of[i] in ("E", "P"):
            continue
        f = bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
        f.material_index = PID["piso_colonia" if side_of[i] == "esq_P" else "panel"]
    inner = octagon(HATCH, HATCH - HCH)
    # paredes con escotilla: punto(u, v) en el plano de la pared
    walls = {
        "E": (lambda u, v, d=0.0: Vector((A + d, YC + u, v)), (1, 2)),
        "P": (lambda u, v, d=0.0: Vector((v, YC + u, -A - d)), (3, 4)),
    }
    for code, (pt, (ia, ib)) in walls.items():
        U, W = NL / 2, HW
        h, a = HATCH - HCH, HATCH
        outer = [(h, W), (U, h), (U, -h), (h, -W), (-h, -W), (-U, -h), (-U, h), (-h, W)]
        inn = [(h, a), (a, h), (a, -h), (h, -a), (-h, -a), (-a, -h), (-a, h), (-h, a)]
        ov = [V(pt(u, v)) for u, v in outer]
        iv = [V(pt(u, v)) for u, v in inn]
        tv = [V(pt(u, v, TUN)) for u, v in inn]
        col_ = "piso_colonia" if code == "P" else "panel"
        for k in range(8):
            m = (k + 1) % 8
            bm.faces.new((ov[k], ov[m], iv[m], iv[k])).material_index = PID[col_]
            bm.faces.new((iv[k], iv[m], tv[m], tv[k])).material_index = PID["gris"]
        for cu, cv, a_, b_ in ((U, W, 0, 1), (U, -W, 2, 3), (-U, -W, 4, 5), (-U, W, 6, 7)):
            bm.faces.new((V(pt(cu, cv)), ov[b_], ov[a_])).material_index = PID[col_]
    for y, out_dir in ((0.0, -1), (NL, 1)):
        ro = r0 if out_dir < 0 else r1
        ri = [V((x, y, z)) for x, z in inner]
        rt = [V((x, y + out_dir * TUN, z)) for x, z in inner]
        for i in range(8):
            j = (i + 1) % 8
            bm.faces.new((ro[i], ro[j], ri[j], ri[i])).material_index = PID["panel"]
            bm.faces.new((ri[i], ri[j], rt[j], rt[i])).material_index = PID["gris"]
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:            # todas las normales hacia el centro del nodo (o del tunel)
        c = f.calc_center_median()
        if f.material_index == PID["gris"]:       # tunel: hacia su propio eje
            if abs(c.y - YC) > NL / 2 + 0.01:
                ax = Vector((-c.x, 0, -c.z))
            elif c.x > A:
                ax = Vector((0, YC - c.y, -c.z))
            else:
                ax = Vector((-c.x, YC - c.y, 0))
            if f.normal.dot(ax) < 0:
                f.normal_flip()
        elif f.normal.dot(Vector((0, YC, 0)) - c) < 0:
            f.normal_flip()
    p = Part()
    p.bm.free()
    p.bm = bm
    for sx in (-1, 1):            # luces en las esquinas superiores
        c = Vector((sx * (A + HW) / 2, YC, (A + HW) / 2))
        nrm = Vector((sx, 0, 1)).normalized()
        p.box(c - nrm * 0.006, (0.10, NL - 0.6, 0.014), "luz",
              rot=Matrix.Rotation(sx * math.pi / 4, 4, "Y"), skip=("+z",))
    return p.finish("SM_Nodo_Montevideo_Casco", mat, col, weld=False)


# ---------------------------------------------------------------- equipos
def panel_balance(mat, col):
    p = Part()
    p.box((0, -0.025, 0), (1.30, 0.05, 0.84), "gris", skip=("+y",), bevel=0.01)
    p.box((0, -0.0515, 0.06), (1.22, 0.007, 0.62), "pantalla")
    for k, c in enumerate(("led_verde", "led_ambar", "led_rojo")):
        x = -0.2 + k * 0.2
        p.cyl((x, -0.06, -0.33), 0.028, 0.03, c, seg=16, axis="y")
    ob = p.finish("SM_Panel_Balance", mat, col, smooth_angle=40)
    empty("PANTALLA_BALANCE", (0, -0.056, 0.06), ob, col)
    for k, n in enumerate(("CONFIRMAR", "RECALCULAR", "ALARMA")):
        empty(f"BOTON_{n}", (-0.2 + k * 0.2, -0.076, -0.33), ob, col)
    return ob


def dock_tablets(mat, col):
    p = Part()
    p.box((0, -0.03, 0), (0.52, 0.06, 0.20), "gris", skip=("+y",), bevel=0.008)
    for x in (-0.13, 0.13):
        p.box((x, -0.062, 0.02), (0.20, 0.006, 0.14), "oscuro")
        p.box((x, -0.062, -0.075), (0.05, 0.008, 0.012), "led_verde")
    ob = p.finish("SM_Dock_Tablets", mat, col, smooth_angle=40)
    for k, x in enumerate((-0.13, 0.13)):
        empty(f"DOCK_{k + 1}", (x, -0.08, 0.02), ob, col)
    return ob


def tablet_muneca(mat, col):
    """Tablet de antebrazo; origen en el eje del antebrazo, pantalla hacia +Z."""
    p = Part()
    p.box((0, 0, 0.055), (0.17, 0.11, 0.014), "oscuro", bevel=0.006)
    p.box((0, 0, 0.0625), (0.15, 0.09, 0.004), "pantalla_on")
    for y in (-0.035, 0.035):
        p.torus_arc((0, y, 0.025), 0.055, 0.009, 150, 390, "velcro", seg=10, rseg=4, plane="xz")
    ob = p.finish("SM_Tablet_Muneca", mat, col, smooth_angle=40)
    empty("PANTALLA_TABLET", (0, 0, 0.065), ob, col)
    return ob


def reloj(mat, col):
    p = Part()
    p.cyl((0, -0.02, 0), 0.14, 0.04, "azul", seg=24, axis="y")
    ob = p.finish("SM_Reloj", mat, col, smooth_angle=30)
    h = Part()
    h.box((0, -0.004, 0.03), (0.012, 0.004, 0.07), "oscuro")
    hh = h.finish("SM_Reloj_Aguja_Hora", mat, col)
    m = Part()
    m.box((0, -0.004, 0.045), (0.008, 0.004, 0.10), "oscuro")
    mm = m.finish("SM_Reloj_Aguja_Minutos", mat, col)
    for a in (hh, mm):
        a.parent = ob
        a.location = (0, -0.045, 0)
    return ob


# ---------------------------------------------------------------- armado
def build(mat, P, door):
    col = collection("Nodo_Montevideo")
    lay = collection("Layout_Nodo")
    sm, scr = materials(write_atlas())
    cas = casco(mat, col)
    pb = panel_balance(mat, col)
    dk = dock_tablets(mat, col)
    tab = tablet_muneca(mat, col)
    rl = reloj(mat, col)
    signs = {i: quad(f"SM_CartelN_{i}", 0.8, 0.05, uv_px(0, 512 + i * RH, 1024, RH), sm, col)
             for i in range(len(SIGNS_N))}
    s_bal = quad("SM_Pantalla_Balance", 1.20, 0.60, uv_px(0, 0, 1024, 512), scr, col)
    s_clk = quad("SM_Esfera_Reloj", 0.24, 0.24, uv_px(0, 896, 128, 128), sm, col)
    s_plk = quad("SM_Placa_Estacion", 0.48, 0.12, uv_px(128, 896, 512, 128), sm, col)
    s_tab = quad("SM_Pantalla_Tablet", 0.15, 0.075, uv_px(640, 896, 256, 128), scr, col)

    def inst(src, name, mw):
        o = bpy.data.objects.new(name, src.data)
        o.matrix_world = mw
        lay.objects.link(o)
        return o

    Rz = lambda a: Matrix.Rotation(a, 4, "Z")  # noqa: E731
    T = Matrix.Translation
    inst(cas, "Casco_Nodo", Matrix())
    # pared de babor: equipos mirando a +X (frente local -Y -> +X con Rz(+90))
    WB = lambda y, z: T((-A, y, z)) @ Rz(math.pi / 2)  # noqa: E731
    inst(pb, "Panel_Balance", WB(YC, 0.12))
    inst(s_bal, "Pantalla_Balance", WB(YC, 0.18) @ T((0, -0.0565, 0)))
    inst(signs[5], "Cartel_Balance", WB(YC, 0.62) @ T((0, -0.004, 0)))
    inst(dk, "Dock_Tablets", WB(YC, -0.55))
    for k, x in enumerate((-0.13, 0.13)):
        t = inst(tab, f"Tablet_{k + 1}", WB(YC, -0.55) @ T((x, -0.11, 0.02)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
        inst(s_tab, f"Pantalla_Tablet_{k + 1}", t.matrix_world @ T((0, 0, 0.0652)) @ Matrix.Rotation(-math.pi / 2, 4, "X"))
    clk = inst(rl, "Reloj", WB(2.05, 0.55))
    inst(s_clk, "Esfera_Reloj", WB(2.05, 0.55) @ T((0, -0.0405, 0)))
    for a, ang in (("SM_Reloj_Aguja_Hora", 70), ("SM_Reloj_Aguja_Minutos", 120)):   # 14:20
        inst(bpy.data.objects[a], a[3:], WB(2.05, 0.55) @ T((0, -0.045, 0)) @ Matrix.Rotation(math.radians(ang), 4, "Y"))
    inst(s_plk, "Placa", WB(0.33, 0.55) @ T((0, -0.004, 0)))
    # escotillas y carteles
    h = HATCH + 0.03
    inst(door, "Escotilla_HaciaTacuarembo", T((-h, -TUN - 0.026, 0)))
    inst(door, "Escotilla_Acople2", T((A + TUN + 0.026, YC + h, 0)) @ Rz(-math.pi / 2))
    inst(door, "Escotilla_HaciaCupula", T((-h, YC, -A - TUN - 0.026)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
    inst(signs[0], "Cartel_Nodo_ini", T((0, 0.004, HATCH + 0.2)) @ Rz(math.pi))
    inst(signs[0], "Cartel_Nodo_fin", T((0, NL - 0.004, HATCH + 0.2)))
    inst(signs[2], "Cartel_HaciaTacuarembo", T((0, 0.004, -HATCH - 0.15)) @ Rz(math.pi))
    inst(signs[1], "Cartel_HaciaRivera", T((0, NL - 0.004, -HATCH - 0.15)))
    inst(signs[4], "Cartel_Acople2", T((A - 0.004, YC, HATCH + 0.18)) @ Rz(-math.pi / 2))
    inst(signs[3], "Cartel_Cupula", T((0.76, YC, -A + 0.004)) @ Rz(-math.pi / 2) @ Matrix.Rotation(-math.pi / 2, 4, "X"))
    # barandas: esquinas a lo largo y junto a cada escotilla
    bar, bar50 = P["SM_Baranda_100"], P["SM_Baranda_050"]
    for sx in (-1, 1):
        for sz in (-1, 1):
            nrm = Vector((sx, 0, sz)).normalized()
            xax, zax = Vector((0, 1, 0)), -nrm
            side = xax.cross(nrm) * (0.09 if sz > 0 else 0.0)
            pos = Vector((sx * (A + HW) / 2, YC, sz * (A + HW) / 2)) + side
            yax = zax.cross(xax)
            inst(bar, f"BarandaN_{sx}{sz}", Matrix(((xax.x, yax.x, zax.x, pos.x), (xax.y, yax.y, zax.y, pos.y),
                                                     (xax.z, yax.z, zax.z, pos.z), (0, 0, 0, 1))))
    for y, s in ((0.0, 1), (NL, -1)):
        for sx in (-1, 1):
            pos = Vector((sx * (HATCH + 0.16), y, 0))
            xax, zax = Vector((0, 0, 1)), Vector((0, s, 0))
            yax = zax.cross(xax)
            inst(bar50, f"BarandaN_Esc_{y}_{sx}", Matrix(((xax.x, yax.x, zax.x, pos.x), (xax.y, yax.y, zax.y, pos.y),
                                                          (xax.z, yax.z, zax.z, pos.z), (0, 0, 0, 1))))
    for sx in (-1, 1):                      # verticales a los lados del panel de balance
        pos = Vector((-A, YC + sx * 0.78, 0.12))
        xax, zax = Vector((0, 0, 1)), Vector((1, 0, 0))
        yax = zax.cross(xax)
        inst(bar50, f"BarandaN_Balance_{sx}", Matrix(((xax.x, yax.x, zax.x, pos.x), (xax.y, yax.y, zax.y, pos.y),
                                                      (xax.z, yax.z, zax.z, pos.z), (0, 0, 0, 1))))
    return {"casco": cas, "lay": lay}
