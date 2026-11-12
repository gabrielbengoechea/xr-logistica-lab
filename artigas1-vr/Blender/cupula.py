"""Cupula Faro: mirador al nadir debajo del Nodo Montevideo, con la estacion de mate.

Origen en el borde superior del tunel (donde apoya el anillo de acople), Z hacia abajo
es la Tierra. Octogonal: 7 ventanas laterales + 1 panel de equipos + ventana central.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from kitlib import PID, TEX, Part, collection, empty  # noqa: E402
from modulo import HATCH, HCH, octagon, quad  # noqa: E402
from colonia import uv_px  # noqa: E402

T22 = math.tan(math.radians(22.5))
ZT = -0.30          # techo de la cupula (fin del tunel)
ZB = -1.05          # piso de la cupula (ventana central)
R1, R2 = 1.25, 0.72  # apotema arriba y abajo
RW = 0.40           # apotema de la ventana central
FR = 0.09           # ancho de marco
REV = 0.10          # profundidad del marco (hacia afuera)
PANEL = 1           # cara lateral sin ventana: panel de equipos (estribor)
EARTH_R = 1000.0    # radio de la Tierra en Unity (escala angular real a 400 km: altura 63 m)
EARTH_ALT = EARTH_R * 400 / 6371
NADIR = (-35.2, -55.9)  # justo al sureste de Montevideo: costa, Rio de la Plata y Punta del Este a la vista
DET = (-45.0, -25.0, -66.0, -46.0)   # parche de detalle (lat0, lat1, lon0, lon1)

SIGNS = [
    ("CÚPULA FARO · OBSERVACIÓN", (0, 56, 148), (255, 255, 255)),
    ("↑  Hacia Nodo Montevideo", (28, 30, 34), (255, 255, 255)),
    ("Estación de infusión: cerrá la válvula antes de soltar", (0, 82, 147), (255, 255, 255)),
    ("Abajo: Río de la Plata y costa uruguaya", (28, 30, 34), (255, 255, 255)),
]


def reg_oct(apo):
    return octagon(apo, apo * T22)


# ---------------------------------------------------------------- texturas
def write_atlas():
    from PIL import Image, ImageDraw, ImageFont
    fb = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    img = Image.new("RGB", (1024, 512), (20, 20, 24))
    d = ImageDraw.Draw(img)
    for i, (txt, bg, fg) in enumerate(SIGNS):
        y0 = i * 64
        d.rectangle((0, y0, 1023, y0 + 63), fill=bg)
        size = 40
        while d.textlength(txt, font=ImageFont.truetype(fb, size)) > 960 and size > 14:
            size -= 2
        d.text((512, y0 + 32), txt, font=ImageFont.truetype(fb, size), fill=fg, anchor="mm")
        d.rectangle((0, y0, 1023, y0 + 63), outline=fg, width=2)
    # display del dispensador 256 x 64 en (0, 256)
    d.rectangle((0, 256, 255, 319), fill=(6, 14, 8))
    d.text((128, 288), "AGUA 75 °C · LISTA", font=ImageFont.truetype(fb, 22), fill=(90, 240, 120), anchor="mm")
    p = os.path.join(TEX, "T_Artigas_Cupula.png")
    img.save(p)
    return p


def write_stars():
    import numpy as np
    from PIL import Image
    rng = np.random.default_rng(3)
    W, H = 2048, 1024
    a = np.zeros((H, W, 3), np.float32)
    n = 9000
    ys = (np.arccos(rng.uniform(-1, 1, n)) / math.pi * H).astype(int).clip(0, H - 1)
    xs = rng.integers(0, W, n)
    b = rng.power(6, n)
    tint = rng.uniform(0.85, 1.0, (n, 3))
    a[ys, xs] = (b[:, None] * tint)
    p = os.path.join(TEX, "T_Estrellas_2K.png")
    Image.fromarray((a.clip(0, 1) * 255).astype(np.uint8)).save(p)
    return p


def img_material(name, path, emis=0.0, rough=0.6):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    if emis:
        nt.links.new(t.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emis
    bsdf.inputs["Roughness"].default_value = rough
    return m


# ---------------------------------------------------------------- casco
def framed_opening(bm, outer, inner_scale_fn, normal, panel=False):
    """Cara con marco y abertura. outer: 4 Vector en orden; devuelve vertices del vidrio."""
    c = sum(outer, Vector()) / len(outer)
    inner = [inner_scale_fn(v, c) for v in outer]
    ov = [bm.verts.new(v) for v in outer]
    if panel:
        f = bm.faces.new(ov)
        f.material_index = PID["panel"]
        return None
    iv = [bm.verts.new(v) for v in inner]
    rv = [bm.verts.new(v + normal * REV) for v in inner]
    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ov[i], ov[j], iv[j], iv[i])).material_index = PID["panel"]
        bm.faces.new((iv[i], iv[j], rv[j], rv[i])).material_index = PID["gris"]
    return [v.co.copy() for v in rv]


def casco(mat, col):
    bm = bmesh.new()
    hatch = octagon(HATCH, HATCH - HCH)
    top = reg_oct(R1)
    bot = reg_oct(R2)
    # tunel desde el anillo hasta el techo
    a = [bm.verts.new((x, z, 0.0)) for x, z in hatch]
    b = [bm.verts.new((x, z, ZT)) for x, z in hatch]
    for i in range(8):
        j = (i + 1) % 8
        bm.faces.new((a[i], a[j], b[j], b[i])).material_index = PID["gris"]
    # techo: anillo entre la escotilla y el octogono superior
    t = [bm.verts.new((x, z, ZT)) for x, z in top]
    for i in range(8):
        j = (i + 1) % 8
        bm.faces.new((b[i], b[j], t[j], t[i])).material_index = PID["panel"]
    glass = []
    center = Vector((0, 0, (ZT + ZB) / 2))
    for i in range(8):
        j = (i + 1) % 8
        p0, p1 = Vector((top[i][0], top[i][1], ZT)), Vector((top[j][0], top[j][1], ZT))
        q1, q0 = Vector((bot[j][0], bot[j][1], ZB)), Vector((bot[i][0], bot[i][1], ZB))
        quad_ = [p0, p1, q1, q0]
        nrm = (p1 - p0).cross(q0 - p0).normalized()
        mid = sum(quad_, Vector()) / 4
        if nrm.dot(mid - center) < 0:
            nrm = -nrm

        def shrink(v, c):
            d = c - v
            return v + d.normalized() * min(FR * 1.6, d.length * 0.4)
        g = framed_opening(bm, quad_, shrink, nrm, panel=(i == PANEL))
        if g:
            glass.append(g)
    # piso con ventana central
    bv = [bm.verts.new((x, z, ZB)) for x, z in bot]
    wv = [bm.verts.new((x, z, ZB)) for x, z in reg_oct(RW)]
    rv = [bm.verts.new((x, z, ZB - REV)) for x, z in reg_oct(RW)]
    for i in range(8):
        j = (i + 1) % 8
        bm.faces.new((bv[i], bv[j], wv[j], wv[i])).material_index = PID["panel"]
        bm.faces.new((wv[i], wv[j], rv[j], rv[i])).material_index = PID["gris"]
    glass.append([v.co.copy() for v in rv])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # malla conectada y con orientacion consistente: si en promedio mira hacia afuera, se da vuelta entera
    score = sum(f.normal.dot(center - f.calc_center_median()) * f.calc_area() for f in bm.faces
                if f.material_index == PID["panel"])
    if score < 0:
        for f in bm.faces:
            f.normal_flip()
    p = Part()
    p.bm.free()
    p.bm = bm
    # tira de luz alrededor del techo (cálida, para que no encandile frente a la Tierra)
    for i in range(8):
        if i % 2:
            continue
        x, y = top[i]
        x2, y2 = top[(i + 1) % 8]
        m = Vector(((x + x2) / 2 * 0.86, (y + y2) / 2 * 0.86, ZT - 0.006))
        ang = math.atan2(m.y, m.x) + math.pi / 2
        p.box(m, (0.5, 0.06, 0.012), "luz", rot=Matrix.Rotation(ang, 4, "Z"), skip=("+z",))
    ob = p.finish("SM_Cupula_Faro_Casco", mat, col)
    # vidrios (material aparte, transparente en Unity)
    gm = bpy.data.materials.new("M_Artigas_Vidrio")
    gm.diffuse_color = (0.6, 0.75, 0.85, 0.15)
    bsdf = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.7, 0.85, 0.95, 1)
    bsdf.inputs["Alpha"].default_value = 0.12
    bsdf.inputs["Roughness"].default_value = 0.02
    gm.surface_render_method = "BLENDED"
    gme = bpy.data.meshes.new("SM_Cupula_Vidrios")
    verts, faces = [], []
    for g in glass:
        k = len(verts)
        verts += [tuple(v) for v in g]
        faces.append(tuple(range(k, k + len(g))))
    gme.from_pydata(verts, [], faces)
    for poly in gme.polygons:          # que miren hacia adentro
        c = Vector(poly.center)
        if Vector(poly.normal).dot(center - c) < 0:
            poly.flip()
    gme.update()
    gme.uv_layers.new(name="UVMap")
    gme.materials.append(gm)
    go = bpy.data.objects.new("SM_Cupula_Vidrios", gme)
    col.objects.link(go)
    go.parent = ob
    return ob, top, bot


# ---------------------------------------------------------------- estacion de mate
def lathe(p, profile, color, seg=16, center=(0, 0, 0)):
    """Solido de revolucion alrededor de Z. profile: [(r, z), ...] de abajo hacia arriba."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg), z))
                      for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            m = (k + 1) % seg
            bm.faces.new((a[k], a[m], b[m], b[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    p._merge(bm, color, center, None)


def mate(mat, col):
    """Mate para microgravedad: calabaza con tapa sellada, valvula y bombilla. Origen en la base."""
    p = Part()
    prof = [(0.022, 0.0), (0.036, 0.012), (0.044, 0.035), (0.043, 0.055), (0.034, 0.075),
            (0.026, 0.088), (0.027, 0.098)]
    lathe(p, prof, "calabaza", seg=16)
    lathe(p, [(0.031, 0.094), (0.031, 0.107)], "acero", seg=16)                 # virola
    lathe(p, [(0.0295, 0.105), (0.024, 0.116)], "cuero", seg=16)               # tapa sellada
    tilt = Matrix.Rotation(math.radians(12), 4, "Y")
    p.cyl((0.0, 0.0, 0.10), 0.0035, 0.16, "acero", seg=8, rot=tilt)              # bombilla
    p.box((0.0, 0, 0.0), (0.016, 0.008, 0.016), "acero", rot=Matrix.Translation((0.0166, 0, 0.18)) @ tilt)           # boquilla aplanada
    p.cyl((0.0125, 0, 0.13), 0.007, 0.012, "led_ambar", seg=8, axis="x")         # valvula de cierre
    ob = p.finish("SM_Mate_0G", mat, col, smooth_angle=50, weld=False)
    empty("AGARRE_MATE", (0, 0, 0.045), ob, col)
    empty("BOQUILLA", (0.018, 0, 0.18), ob, col)
    empty("VALVULA", (0.0125, 0, 0.13), ob, col)
    return ob


def dispensador(mat, col):
    """Dispensador de agua caliente; frente hacia -Y, apoyado en y=0."""
    p = Part()
    p.box((0, -0.05, 0), (0.22, 0.10, 0.32), "gris", skip=("+y",), bevel=0.01)
    p.box((0, -0.101, 0.10), (0.16, 0.004, 0.045), "pantalla")
    p.cyl((0, -0.115, -0.03), 0.012, 0.03, "acero", seg=10, axis="y")           # boquilla
    p.cyl((0.07, -0.106, 0.03), 0.016, 0.012, "led_rojo", seg=12, axis="y")     # boton
    p.torus_arc((0, -0.10, -0.10), 0.05, 0.008, 180, 360, "baranda", seg=8, rseg=6, plane="xy")  # soporte del mate
    ob = p.finish("SM_Dispensador_Agua", mat, col, smooth_angle=40)
    empty("PANTALLA_DISPENSADOR", (0, -0.104, 0.10), ob, col)
    empty("BOQUILLA_AGUA", (0, -0.13, -0.03), ob, col)
    empty("BOTON_SERVIR", (0.07, -0.112, 0.03), ob, col)
    empty("MATE_SOPORTE", (0, -0.15, -0.10), ob, col)
    return ob


def toalla(mat, col):
    p = Part()
    p.box((0, -0.006, 0), (0.30, 0.012, 0.20), "tela", bevel=0.004)
    p.box((0, -0.014, 0.07), (0.32, 0.006, 0.03), "velcro")
    return p.finish("SM_Toalla", mat, col, smooth_angle=40)


def esfera_agua(mat, col):
    p = Part()
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.035)
    p._merge(bm, "agua", (0, 0, 0), None)
    return p.finish("SM_Esfera_Agua", mat, col, smooth_angle=80)


def tierra(col):
    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=48, radius=EARTH_R, calc_uvs=True)
    me = bpy.data.meshes.new("SM_Tierra")
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    m = img_material("M_Tierra", os.path.join(TEX, "T_Tierra_4K.png"), emis=0.0, rough=0.8)
    me.materials.append(m)
    ob = bpy.data.objects.new("SM_Tierra", me)
    col.objects.link(ob)
    return ob


def geo_dir(lat, lon):
    """Direccion en el espacio local de la esfera UV de Blender (lon 0 en +X, +90 en +Y)."""
    la, lo = math.radians(lat), math.radians(lon)
    return Vector((math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)))


def tierra_matrix():
    """Rotacion que pone NADIR arriba (+Z, hacia la estacion) y el norte hacia +Y."""
    q = geo_dir(*NADIR).rotation_difference(Vector((0, 0, 1)))
    n2 = q @ geo_dir(NADIR[0] + 2, NADIR[1])
    rz = Matrix.Rotation(math.atan2(n2.x, n2.y), 4, "Z")
    return rz @ q.to_matrix().to_4x4()


def tierra_detalle(col, n=56):
    """Casquete esferico 0,2 m por encima de la Tierra con la textura de 1 km/px."""
    lat0, lat1, lon0, lon1 = DET
    me = bpy.data.meshes.new("SM_Tierra_Detalle")
    verts, faces = [], []
    for i in range(n + 1):
        for j in range(n + 1):
            lat = lat0 + (lat1 - lat0) * i / n
            lon = lon0 + (lon1 - lon0) * j / n
            verts.append(tuple(geo_dir(lat, lon) * (EARTH_R + 0.2)))
    for i in range(n):
        for j in range(n):
            a = i * (n + 1) + j
            faces.append((a, a + 1, a + n + 2, a + n + 1))
    me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        poly.use_smooth = True
        for li, vi in zip(poly.loop_indices, poly.vertices):
            i, j = divmod(vi, n + 1)
            uvl.data[li].uv = (j / n, i / n)
    for poly in me.polygons:
        if Vector(poly.normal).dot(Vector(poly.center)) < 0:
            poly.flip()
    me.update()
    m = img_material("M_Tierra_Detalle", os.path.join(TEX, "T_Tierra_Detalle_Uruguay.png"), rough=0.8)
    nt = m.node_tree
    bsdf = next(nd for nd in nt.nodes if nd.type == "BSDF_PRINCIPLED")
    tex = next(nd for nd in nt.nodes if nd.type == "TEX_IMAGE")
    tex.extension = "EXTEND"
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    m.surface_render_method = "BLENDED"
    me.materials.append(m)
    ob = bpy.data.objects.new("SM_Tierra_Detalle", me)
    col.objects.link(ob)
    return ob


# ---------------------------------------------------------------- armado
def build(mat, P):
    col = collection("Cupula_Faro")
    lay = collection("Layout_Cupula")
    sm = img_material("M_Artigas_Senaletica_Cupula", write_atlas())
    scr = img_material("M_Artigas_Pantallas_Cupula", os.path.join(TEX, "T_Artigas_Cupula.png"), emis=1.2)
    write_stars()
    cas, top, bot = casco(mat, col)
    mt = mate(mat, col)
    dsp = dispensador(mat, col)
    tw = toalla(mat, col)
    ag = esfera_agua(mat, col)
    ea = tierra(col)
    ed = tierra_detalle(col)
    signs = {i: quad(f"SM_CartelF_{i}", 0.8, 0.05, uv_px(0, i * 64, 1024, 64), sm, col) for i in range(len(SIGNS))}
    for s in signs.values():          # el atlas de la cupula es 1024 x 512
        uvd = s.data.uv_layers.active.data
        for l in uvd:
            l.uv.y = 1 - (1 - l.uv.y) * 2
    s_dsp = quad("SM_Pantalla_Dispensador", 0.16, 0.04, (0, 1 - 320 / 512, 0.25, 1 - 256 / 512), scr, col)

    def inst(src, name, mw):
        o = bpy.data.objects.new(name, src.data)
        o.matrix_world = mw
        lay.objects.link(o)
        return o

    inst(cas, "Casco_Cupula", Matrix())
    inst(bpy.data.objects["SM_Cupula_Vidrios"], "Vidrios_Cupula", Matrix())
    # panel de equipos (cara PANEL): marco local con frente -Y apoyado en la cara
    i, j = PANEL, (PANEL + 1) % 8
    p0 = Vector((top[i][0], top[i][1], ZT)); p1 = Vector((top[j][0], top[j][1], ZT))
    q0 = Vector((bot[i][0], bot[i][1], ZB)); q1 = Vector((bot[j][0], bot[j][1], ZB))
    c = (p0 + p1 + q0 + q1) / 4
    xax = (p0 - p1).normalized()
    up = ((p0 + p1) / 2 - (q0 + q1) / 2).normalized()
    out = xax.cross(up).normalized()
    if out.dot(c - Vector((0, 0, (ZT + ZB) / 2))) < 0:
        xax = -xax
        out = -out
    yax = out                          # local +Y hacia la pared (afuera)
    zax = xax.cross(yax)
    if zax.dot(up) < 0:
        xax, zax = -xax, -zax
    def on_panel(dx, dz, dy=0.0):
        pos = c + xax * dx + zax * dz - yax * dy
        return Matrix(((xax.x, yax.x, zax.x, pos.x), (xax.y, yax.y, zax.y, pos.y),
                       (xax.z, yax.z, zax.z, pos.z), (0, 0, 0, 1)))
    inst(dsp, "Dispensador_Agua", on_panel(-0.12, 0.02))
    inst(s_dsp, "Pantalla_Dispensador", on_panel(-0.12, 0.12, 0.106))
    mm = on_panel(-0.12, -0.08, 0.15)
    inst(mt, "Mate", mm @ Matrix.Translation((0, 0, -0.03)))
    inst(tw, "Toalla", on_panel(0.24, -0.02))
    inst(signs[2], "Cartel_Infusion", on_panel(0.0, 0.26, 0.004))
    inst(ag, "Esfera_Agua_ejemplo", on_panel(0.05, -0.12, 0.35))
    # carteles en el techo y junto a la ventana central
    inst(signs[0], "Cartel_Cupula", Matrix.Translation((0, -0.82, ZT - 0.004)) @ Matrix.Rotation(math.pi / 2, 4, "X"))
    inst(signs[1], "Cartel_HaciaNodo", Matrix.Translation((0, 0.82, ZT - 0.004)) @ Matrix.Rotation(math.pi / 2, 4, "X") @ Matrix.Rotation(math.pi, 4, "Z"))
    inst(signs[3], "Cartel_RioDeLaPlata", Matrix.Translation((0, -0.56, ZB + 0.004)) @ Matrix.Rotation(-math.pi / 2, 4, "X"))
    # barandas radiales en el techo
    bar = P["SM_Baranda_050"]
    for k in range(8):
        if k == PANEL:
            continue
        a = (k + 0.5) * math.pi / 4
        pos = Vector((math.cos(a) * 0.92, math.sin(a) * 0.92, ZT))
        xax2 = Vector((-math.sin(a), math.cos(a), 0))
        zax2 = Vector((0, 0, -1))
        yax2 = zax2.cross(xax2)
        inst(bar, f"BarandaF_{k}", Matrix(((xax2.x, yax2.x, zax2.x, pos.x), (xax2.y, yax2.y, zax2.y, pos.y),
                                             (xax2.z, yax2.z, zax2.z, pos.z), (0, 0, 0, 1))))
    # la Tierra (en otra coleccion: no va en el FBX del modulo)
    tierra_col = collection("Layout_Tierra")
    M = Matrix.Translation((0, 0, ZB - EARTH_ALT - EARTH_R)) @ tierra_matrix()
    te = bpy.data.objects.new("Tierra", ea.data)
    te.matrix_world = M
    tierra_col.objects.link(te)
    td = bpy.data.objects.new("Tierra_Detalle", ed.data)
    td.matrix_world = M
    tierra_col.objects.link(td)
    return {"lay": lay, "tierra": te, "tierra_det": td}
