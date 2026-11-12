"""Modulo Tacuarembo: taller y mantenimiento de sistemas.

Detras del Nodo Montevideo (escotilla en +Y, punta -Y cerrada). Piso naranja y luz calida.
Estribor: banco de trabajo + tablero de sombras con herramientas.
Babor: rack de repuestos (TAC-B1) y rack de soporte vital (TAC-B2) con el filtro de CO2.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from kitlib import TEX, Part, collection, empty  # noqa: E402
from modulo import A, HW, HATCH, RW, octagon, quad  # noqa: E402
from colonia import shell, mount_matrix  # noqa: E402

TL = 3.0
SIGNS_T = [
    ("MÓDULO TACUAREMBÓ · TALLER", (190, 90, 20), (255, 255, 255)),
    ("↑  Hacia Nodo Montevideo", (28, 30, 34), (255, 255, 255)),
    ("Herramientas: amarrá cada una después de usarla", (0, 82, 147), (255, 255, 255)),
    ("Soporte vital: cortá la energía antes de abrir", (250, 200, 0), (20, 20, 20)),
    ("Cada herramienta tiene su lugar: si falta, se ve", (28, 30, 34), (255, 255, 255)),
]
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def write_atlas():
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (1024, 512), (16, 16, 18))
    d = ImageDraw.Draw(img)
    for i, (txt, bg, fg) in enumerate(SIGNS_T):
        y0 = i * 64
        d.rectangle((0, y0, 1023, y0 + 63), fill=bg)
        size = 40
        while d.textlength(txt, font=ImageFont.truetype(FB, size)) > 960 and size > 14:
            size -= 2
        d.text((512, y0 + 32), txt, font=ImageFont.truetype(FB, size), fill=fg, anchor="mm")
        d.rectangle((0, y0, 1023, y0 + 63), outline=fg, width=2)
    # etiquetas de rack 256 x 64 en y=320
    for k, t in enumerate(("TAC-B1 · REPUESTOS", "TAC-B2 · SOPORTE VITAL")):
        x0 = k * 256
        d.rectangle((x0, 320, x0 + 255, 383), fill=(240, 240, 236), outline=(30, 30, 30), width=3)
        d.text((x0 + 128, 352), t, font=ImageFont.truetype(FB, 19), fill=(20, 20, 20), anchor="mm")
    # pantalla de soporte vital 512 x 128 en (512, 320)
    x0, y0 = 512, 320
    d.rectangle((x0, y0, x0 + 511, y0 + 127), fill=(8, 14, 10))
    d.text((x0 + 14, y0 + 14), "SOPORTE VITAL", font=ImageFont.truetype(FB, 20), fill=(180, 230, 190))
    d.text((x0 + 14, y0 + 48), "O₂ 21,0 %   CO₂ 0,42 %", font=ImageFont.truetype(FB, 24), fill=(90, 240, 120))
    d.text((x0 + 14, y0 + 86), "Filtro CO₂: 12 %  →  CAMBIAR", font=ImageFont.truetype(FB, 24), fill=(255, 190, 40))
    p = os.path.join(TEX, "T_Artigas_Tacuarembo.png")
    img.save(p)
    return p


def img_mat(name, path, emis=0.0):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    if emis:
        nt.links.new(t.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emis
    return m


def uv_half(x0, y0, w, h):           # atlas de 1024 x 512
    return (x0 / 1024, 1 - (y0 + h) / 512, (x0 + w) / 1024, 1 - y0 / 512)


# ---------------------------------------------------------------- herramientas
def llave(mat, col):
    p = Part()
    p.box((0, 0, 0), (0.20, 0.012, 0.024), "acero", bevel=0.003)
    p.box((0.115, 0, 0.012), (0.035, 0.014, 0.05), "acero")              # mandibula fija
    p.box((0.115, 0, -0.022), (0.031, 0.011, 0.022), "acero")             # mandibula movil
    p.cyl((0.09, 0, -0.005), 0.007, 0.016, "gris", seg=8, axis="y")       # tornillo
    ob = p.finish("SM_Llave_Inglesa", mat, col, smooth_angle=40)
    empty("AGARRE_LLAVE", (-0.04, 0, 0), ob, col)
    return ob


def destornillador(mat, col):
    p = Part()
    p.cyl((0, 0, 0.05), 0.014, 0.10, "rojo_mango", seg=10)
    p.cyl((0, 0, 0.14), 0.003, 0.09, "acero", seg=6, radius2=0.0012)
    ob = p.finish("SM_Destornillador", mat, col, smooth_angle=50)
    empty("AGARRE_DESTORNILLADOR", (0, 0, 0.05), ob, col)
    return ob


def multimetro(mat, col):
    p = Part()
    p.box((0, 0, 0), (0.08, 0.035, 0.15), "baranda", bevel=0.006)
    p.box((0, -0.018, 0.04), (0.06, 0.004, 0.035), "pantalla_on")
    p.cyl((0, -0.019, -0.02), 0.016, 0.006, "oscuro", seg=12, axis="y")
    for x in (-0.02, 0.0, 0.02):
        p.cyl((x, -0.019, -0.058), 0.004, 0.006, "led_rojo" if x > 0 else "oscuro", seg=8, axis="y")
    ob = p.finish("SM_Multimetro", mat, col, smooth_angle=40)
    empty("PANTALLA_MULTIMETRO", (0, -0.021, 0.04), ob, col)
    return ob


def filtro_co2(mat, col):
    """Cartucho de filtro de CO2; eje en X, origen al centro."""
    p = Part()
    p.cyl((0, 0, 0), 0.085, 0.32, "panel", seg=16, axis="x")
    for x in (-0.165, 0.165):
        p.cyl((x, 0, 0), 0.088, 0.016, "gris", seg=16, axis="x")
    p.box((0, -0.0865, 0.0), (0.12, 0.004, 0.06), "etiqueta")
    p.torus_arc((-0.168, 0, 0), 0.035, 0.007, 90, 270, "baranda", seg=8, rseg=6, plane="xy")
    ob = p.finish("SM_Filtro_CO2", mat, col, smooth_angle=40)
    empty("AGARRE_FILTRO", (-0.21, 0, 0), ob, col)
    empty("ETIQUETA_FILTRO", (0, -0.089, 0), ob, col)
    return ob


# ---------------------------------------------------------------- equipos
def banco(mat, col):
    """Banco de trabajo en la pared (y=0), frente hacia -Y."""
    p = Part()
    p.box((0, -0.25, 0), (1.2, 0.5, 0.04), "gris", bevel=0.006)
    p.box((0, -0.25, 0.0205), (1.1, 0.42, 0.003), "velcro")
    for x in (-0.5, 0.5):                                                # mensulas
        p.poly_prism([(0, 0), (-0.38, 0), (0, -0.30)], 0.03, "acero", center=(x, 0, -0.02), axis="x")
    p.cyl((0, -0.52, 0.03), 0.014, 1.1, "baranda", seg=10, axis="x")      # baranda de borde
    for x in (-0.55, 0.55):
        p.box((x, -0.51, 0.015), (0.02, 0.03, 0.03), "gris")
    ob = p.finish("SM_Banco_Trabajo", mat, col, smooth_angle=40)
    for k, x in enumerate((-0.35, 0.0, 0.35)):
        empty(f"AMARRE_BANCO_{k + 1}", (x, -0.25, 0.03), ob, col)
    return ob


def tablero_sombras(mat, col):
    """Tablero de sombras (5S): una silueta por herramienta. Frente hacia -Y."""
    p = Part()
    p.box((0, -0.01, 0), (1.0, 0.02, 0.6), "panel", skip=("+y",))
    # siluetas oscuras
    p.box((-0.3, -0.021, 0.12), (0.21, 0.003, 0.03), "oscuro")             # llave
    p.box((-0.19, -0.0225, 0.12), (0.045, 0.003, 0.08), "oscuro")
    p.box((0.05, -0.021, 0.04), (0.03, 0.003, 0.20), "oscuro")              # destornillador
    p.box((0.3, -0.021, 0.04), (0.09, 0.003, 0.16), "oscuro")               # multimetro
    for x, z in ((-0.25, 0.12), (0.05, 0.04), (0.3, 0.04)):                 # elasticos de retencion
        p.box((x, -0.025, z + 0.06), (0.12, 0.006, 0.012), "correa")
    p.box((0, -0.022, -0.22), (0.9, 0.004, 0.06), "baranda")               # banda inferior
    ob = p.finish("SM_Tablero_Sombras", mat, col)
    empty("HERRAMIENTA_LLAVE", (-0.25, -0.04, 0.12), ob, col)
    empty("HERRAMIENTA_DESTORNILLADOR", (0.05, -0.04, -0.01), ob, col)
    empty("HERRAMIENTA_MULTIMETRO", (0.3, -0.04, 0.04), ob, col)
    return ob


def rack_soporte_vital(mat, col):
    """Rack de soporte vital, mismo formato que el rack de almacen (1,05 x 1,95 x 0,5).
    Frente en y=0 mirando a -Y, origen abajo al centro."""
    p = Part()
    D, W, H = 0.50, RW, 2 * HW
    p.box((0, D / 2, H / 2), (W, D, H), "panel", skip=("+y",))
    # rejilla del ventilador
    p.box((0, -0.004, 1.55), (0.6, 0.008, 0.34), "oscuro")
    for k in range(7):
        p.box((0, -0.01, 1.42 + k * 0.043), (0.56, 0.006, 0.012), "gris")
    # pantalla y valvulas
    p.box((-0.18, -0.004, 1.17), (0.52, 0.008, 0.14), "pantalla")
    for x in (0.24, 0.38):
        p.cyl((x, -0.02, 1.17), 0.02, 0.04, "acero", seg=10, axis="y")
        p.box((x, -0.045, 1.17), (0.12, 0.016, 0.022), "baranda")
    # hueco del filtro (la puerta va aparte)
    p.box((0, -0.004, 0.62), (0.56, 0.008, 0.42), "oscuro")
    p.box((0, -0.002, 0.2), (0.9, 0.006, 0.02), "led_verde")
    ob = p.finish("SM_Rack_Soporte_Vital", mat, col)
    empty("PANTALLA_SOPORTE_VITAL", (-0.18, -0.009, 1.17), ob, col)
    empty("VALVULA_O2", (0.24, -0.05, 1.17), ob, col)
    empty("VALVULA_N2", (0.38, -0.05, 1.17), ob, col)
    empty("FILTRO_SLOT", (0, 0.23, 0.62), ob, col, size=0.15)
    empty("PUERTA_FILTRO_BISAGRA", (-0.29, -0.008, 0.62), ob, col)
    empty("LUZ_ESTADO_RACK", (0, -0.01, 0.2), ob, col)
    # puerta del filtro (hija, pivote en la bisagra izquierda)
    q = Part()
    q.box((0.29, -0.01, 0), (0.58, 0.02, 0.44), "gris", bevel=0.004)
    q.box((0.50, -0.03, 0), (0.03, 0.02, 0.14), "baranda")
    q.box((0.29, -0.0205, 0.12), (0.30, 0.002, 0.05), "etiqueta")
    door = q.finish("SM_Puerta_Filtro", mat, col)
    door.parent = ob
    door.location = (-0.29, -0.008, 0.62)
    return ob


# ---------------------------------------------------------------- armado
def build(mat, P):
    col = collection("Modulo_Tacuarembo")
    lay = collection("Layout_Tacuarembo")
    path = write_atlas()
    sm = img_mat("M_Artigas_Senaletica_Tacuarembo", path)
    scr = img_mat("M_Artigas_Pantallas_Tacuarembo", path, emis=1.2)
    y0r, y1r = 0.45, 0.45 + 2 * RW
    cas = shell("SM_Modulo_Tacuarembo_Casco", 0.0, TL, A, HW, "piso_tacuarembo", mat, col,
                open_sides=("B",), open_range=(y0r, y1r), hatch_ends=(False, True), light="luz_calida")
    tools = {"llave": llave(mat, col), "dest": destornillador(mat, col), "multi": multimetro(mat, col)}
    fil = filtro_co2(mat, col)
    bn = banco(mat, col)
    tb = tablero_sombras(mat, col)
    rsv = rack_soporte_vital(mat, col)
    signs = {i: quad(f"SM_CartelT_{i}", 0.8, 0.05, uv_half(0, i * 64, 1024, 64), sm, col) for i in range(len(SIGNS_T))}
    lab = [quad(f"SM_Etiqueta_TAC_B{k + 1}", 0.24, 0.06, uv_half(k * 256, 320, 256, 64), sm, col) for k in range(2)]
    s_sv = quad("SM_Pantalla_Soporte_Vital", 0.50, 0.125, uv_half(512, 320, 512, 128), scr, col)

    def inst(src, name, mw):
        o = bpy.data.objects.new(name, src.data)
        o.matrix_world = mw
        lay.objects.link(o)
        return o

    T, Rz = Matrix.Translation, (lambda a: Matrix.Rotation(a, 4, "Z"))
    inst(cas, "Casco_Tacuarembo", Matrix())
    # racks en babor (mismo montaje que Rivera)
    n = Vector((-1, 0, 0))
    racks = {}
    for k, src in enumerate((bpy.data.objects["SM_Rack_Almacen"], rsv)):
        xl = Vector((0, 1, 0))
        yc = y0r + RW / 2 + k * RW
        org = n * A + Vector((0, yc, 0))
        m, zl = mount_matrix(n, xl, org)
        m, zl = mount_matrix(n, xl, org - zl * HW)
        racks[k] = inst(src, f"Rack_TAC-B{k + 1}", m)
        head = m @ Vector((-RW / 2 + 0.17, -0.004, 2 * HW - 0.04))
        inst(lab[k], f"Etiqueta_TAC-B{k + 1}", T(head) @ m.to_3x3().to_4x4())
    m2 = racks[1].matrix_world
    inst(bpy.data.objects["SM_Puerta_Filtro"], "Puerta_Filtro", m2 @ T((-0.29, -0.008, 0.62)))
    inst(s_sv, "Pantalla_Soporte_Vital", m2 @ T((-0.18, -0.0095, 1.17)))
    inst(fil, "Filtro_CO2_instalado", m2 @ T((0, 0.23, 0.62)) @ Rz(math.pi / 2))
    inst(signs[3], "Cartel_SoporteVital", m2 @ T((0.0, -0.006, 0.92)))
    # repuestos de ejemplo en el rack TAC-B1 (filtros de recambio)
    rk = bpy.data.objects["SM_Rack_Almacen"]
    bpy.context.view_layer.update()
    for e in rk.children:
        if e.name in ("SNAP_A1", "SNAP_B1", "SNAP_A2"):
            inst(fil, f"Filtro_Repuesto_{e.name[5:]}", racks[0].matrix_world @ T(e.matrix_local.translation) @ Rz(math.pi / 2))
    # estribor: banco + tablero + herramientas
    WE = lambda y, z: T((A, y, z)) @ Rz(-math.pi / 2)  # noqa: E731
    yb = 1.5
    inst(bn, "Banco_Trabajo", WE(yb, -0.25))
    inst(tb, "Tablero_Sombras", WE(yb, 0.38))
    inst(signs[4], "Cartel_5S", WE(yb, 0.74) @ T((0, -0.004, 0)))
    inst(signs[2], "Cartel_Herramientas", WE(yb, -0.62) @ T((0, -0.004, 0)))
    inst(tools["llave"], "Llave", WE(yb, 0.38) @ T((-0.25, -0.032, 0.12)) @ Matrix.Rotation(0, 4, "Y"))
    inst(tools["dest"], "Destornillador", WE(yb, 0.38) @ T((0.05, -0.04, -0.06)))
    # el multimetro quedo sobre el banco: su silueta en el tablero esta vacia
    inst(tools["multi"], "Multimetro_en_banco", WE(yb + 0.3, -0.25) @ T((0, -0.25, 0.04)) @ Matrix.Rotation(-math.pi / 2, 4, "X"))
    # mamparos
    inst(signs[0], "Cartel_Modulo", T((0, TL - 0.004, HATCH + 0.2)))
    inst(signs[1], "Cartel_HaciaNodo", T((0, TL - 0.004, -HATCH - 0.15)))
    inst(signs[0], "Cartel_Modulo_fondo", T((0, 0.004, 0.3)) @ Rz(math.pi))
    # barandas
    bar, bar50 = P["SM_Baranda_100"], P["SM_Baranda_050"]
    for sx in (-1, 1):
        for sz in (-1, 1):
            nrm = Vector((sx, 0, sz)).normalized()
            for i, y in enumerate((0.7, 2.3)):
                xax, zax = Vector((0, 1, 0)), -nrm
                side = xax.cross(nrm) * (0.09 if sz > 0 else 0.0)
                pos = Vector((sx * (A + HW) / 2, y, sz * (A + HW) / 2)) + side
                yax = zax.cross(xax)
                inst(bar, f"BarandaT_{sx}{sz}_{i}", Matrix(((xax.x, yax.x, zax.x, pos.x), (xax.y, yax.y, zax.y, pos.y),
                                                              (xax.z, yax.z, zax.z, pos.z), (0, 0, 0, 1))))
    for sx in (-1, 1):
        pos = Vector((sx * (HATCH + 0.16), TL, 0))
        xax, zax = Vector((0, 0, 1)), Vector((0, -1, 0))
        yax = zax.cross(xax)
        inst(bar50, f"BarandaT_Esc_{sx}", Matrix(((xax.x, yax.x, zax.x, pos.x), (xax.y, yax.y, zax.y, pos.y),
                                                  (xax.z, yax.z, zax.z, pos.z), (0, 0, 0, 1))))
    return {"lay": lay}
