"""Herramientas comunes del kit Artigas-1 (Blender 5.x, bpy).

Cada pieza se arma con bmesh. El color de cada cara se guarda como
indice de paleta (material_index temporal) y al final se convierte en
UV que apunta al centro de una celda de la textura de paleta.
Resultado: 1 material para todo el kit -> pocos draw calls en Quest 2.
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

# Carpeta de salida (texturas, .blend, export). Por defecto, Blender/salida al lado de estos scripts.
OUT = os.environ.get("ARTIGAS1_SALIDA", os.path.join(os.path.dirname(os.path.abspath(__file__)), "salida"))
TEX = os.path.join(OUT, "textures")

# ---------------------------------------------------------------- paleta
GRID = 8          # 8 x 8 celdas
CELL = 32         # px por celda -> textura 256 x 256
# nombre: (rgb lineal-ish en sRGB 0-1, metalico, rugosidad, emision rgb o None)
PALETTE = {
    "panel":      ((0.84, 0.84, 0.82), 0.0, 0.60, None),
    "gris":       ((0.58, 0.59, 0.60), 0.0, 0.55, None),
    "oscuro":     ((0.16, 0.17, 0.19), 0.0, 0.50, None),
    "aluminio":   ((0.72, 0.74, 0.76), 0.0, 0.40, None),   # aluminio pintado
    "baranda":    ((0.86, 0.66, 0.10), 0.0, 0.45, None),
    "tela":       ((0.86, 0.83, 0.74), 0.0, 0.90, None),
    "tela_osc":   ((0.62, 0.59, 0.52), 0.0, 0.90, None),
    "azul":       ((0.00, 0.22, 0.58), 0.0, 0.50, None),
    "celeste":    ((0.40, 0.65, 0.88), 0.0, 0.50, None),
    "led_verde":  ((0.10, 0.75, 0.30), 0.0, 0.40, (0.10, 0.90, 0.35)),
    "led_ambar":  ((1.00, 0.60, 0.05), 0.0, 0.40, (1.00, 0.55, 0.05)),
    "led_rojo":   ((0.85, 0.05, 0.05), 0.0, 0.40, (1.00, 0.05, 0.05)),
    "pantalla":   ((0.03, 0.03, 0.04), 0.0, 0.20, None),
    "pantalla_on": ((0.20, 0.80, 0.90), 0.0, 0.20, (0.20, 0.80, 0.95)),
    "correa":     ((0.90, 0.38, 0.06), 0.0, 0.85, None),
    "velcro":     ((0.36, 0.36, 0.34), 0.0, 0.95, None),
    "etiqueta":   ((0.95, 0.95, 0.93), 0.0, 0.70, None),
    "piso_rivera": ((0.24, 0.46, 0.30), 0.0, 0.60, None),
    "piso_colonia": ((0.12, 0.30, 0.62), 0.0, 0.60, None),
    "luz":        ((0.95, 0.95, 0.90), 0.0, 0.30, (1.00, 0.97, 0.90)),
    "goma":       ((0.08, 0.08, 0.08), 0.0, 0.90, None),
    "acero":      ((0.55, 0.56, 0.58), 0.6, 0.40, None),
    "calabaza":   ((0.45, 0.28, 0.12), 0.0, 0.60, None),
    "cuero":      ((0.24, 0.14, 0.07), 0.0, 0.70, None),
    "agua":       ((0.55, 0.78, 0.95), 0.0, 0.05, None),
    "piso_tacuarembo": ((0.80, 0.40, 0.10), 0.0, 0.60, None),
    "luz_calida": ((1.00, 0.86, 0.66), 0.0, 0.30, (1.00, 0.80, 0.55)),
    "rojo_mango": ((0.70, 0.08, 0.06), 0.0, 0.50, None),
}
NAMES = list(PALETTE)
PID = {n: i for i, n in enumerate(NAMES)}


def cell_uv(pid):
    cx, cy = pid % GRID, pid // GRID
    return ((cx + 0.5) / GRID, 1.0 - (cy + 0.5) / GRID)


def write_palette_textures():
    from PIL import Image
    os.makedirs(TEX, exist_ok=True)
    size = GRID * CELL
    base = Image.new("RGB", (size, size), (128, 128, 128))
    emis = Image.new("RGB", (size, size), (0, 0, 0))
    unity_ms = Image.new("RGBA", (size, size), (0, 0, 0, 128))   # R metal, A smooth
    gltf_mr = Image.new("RGB", (size, size), (255, 128, 0))       # G rough, B metal
    for n, (rgb, met, rough, em) in PALETTE.items():
        i = PID[n]
        x0, y0 = (i % GRID) * CELL, (i // GRID) * CELL
        box = (x0, y0, x0 + CELL, y0 + CELL)
        c = tuple(int(round(v * 255)) for v in rgb)
        base.paste(c, box)
        if em:
            emis.paste(tuple(int(round(v * 255)) for v in em), box)
        unity_ms.paste((int(met * 255), 0, 0, int((1 - rough) * 255)), box)
        gltf_mr.paste((255, int(rough * 255), int(met * 255)), box)
    paths = {
        "base": os.path.join(TEX, "T_Artigas_Paleta_BaseColor.png"),
        "emis": os.path.join(TEX, "T_Artigas_Paleta_Emision.png"),
        "unity_ms": os.path.join(TEX, "T_Artigas_Paleta_MetallicSmoothness.png"),
        "gltf_mr": os.path.join(TEX, "T_Artigas_Paleta_MetallicRoughness.png"),
    }
    base.save(paths["base"]); emis.save(paths["emis"])
    unity_ms.save(paths["unity_ms"]); gltf_mr.save(paths["gltf_mr"])
    return paths


def palette_material(paths):
    m = bpy.data.materials.get("M_Artigas_Paleta") or bpy.data.materials.new("M_Artigas_Paleta")
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    def img(path, noncolor):
        im = bpy.data.images.load(path, check_existing=True)
        if noncolor:
            im.colorspace_settings.name = "Non-Color"
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = im
        t.interpolation = "Closest"
        return t

    tb = img(paths["base"], False)
    nt.links.new(tb.outputs["Color"], bsdf.inputs["Base Color"])
    te = img(paths["emis"], False)
    nt.links.new(te.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 2.0
    tm = img(paths["gltf_mr"], True)
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(tm.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
    nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
    return m


# ---------------------------------------------------------------- piezas
class Part:
    """Acumula geometria en un bmesh; cada cara lleva un indice de paleta."""

    def __init__(self):
        self.bm = bmesh.new()

    def _tag(self, faces, color):
        pid = PID[color]
        for f in faces:
            f.material_index = pid

    def box(self, center, size, color, skip=(), bevel=0.0, seg=1, rot=None):
        """Caja. skip: caras a omitir ('+x','-x','+y','-y','+z','-z')."""
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        bmesh.ops.scale(tmp, vec=Vector(size), verts=tmp.verts)
        if skip:
            kill = []
            for f in tmp.faces:
                n = f.normal
                for s in skip:
                    ax = "xyz".index(s[1])
                    sign = 1 if s[0] == "+" else -1
                    if n[ax] * sign > 0.9:
                        kill.append(f)
            bmesh.ops.delete(tmp, geom=kill, context="FACES_ONLY")
            loose = [e for e in tmp.edges if not e.link_faces]
            bmesh.ops.delete(tmp, geom=loose, context="EDGES")
        if bevel > 0:
            bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=bevel, segments=seg,
                            affect="EDGES", profile=0.5, clamp_overlap=True)
        self._merge(tmp, color, center, rot)

    def cyl(self, center, radius, depth, color, seg=12, axis="z", radius2=None, caps=True, rot=None):
        tmp = bmesh.new()
        bmesh.ops.create_cone(tmp, cap_ends=caps, cap_tris=False, segments=seg,
                              radius1=radius, radius2=radius if radius2 is None else radius2,
                              depth=depth)
        r = {"z": Matrix(), "x": Matrix.Rotation(math.pi / 2, 4, "Y"),
             "y": Matrix.Rotation(math.pi / 2, 4, "X")}[axis]
        bmesh.ops.transform(tmp, matrix=r, verts=tmp.verts)
        self._merge(tmp, color, center, rot)

    def torus_arc(self, center, R, r, a0, a1, color, seg=10, rseg=8, plane="xz"):
        """Arco de tubo (asas, ganchos). Angulos en grados, en el plano dado."""
        tmp = bmesh.new()
        rings = []
        for i in range(seg + 1):
            a = math.radians(a0 + (a1 - a0) * i / seg)
            c = Vector((R * math.cos(a), 0, R * math.sin(a)))
            radial = Vector((math.cos(a), 0, math.sin(a)))
            side = Vector((0, 1, 0))
            ring = []
            for j in range(rseg):
                b = 2 * math.pi * j / rseg
                ring.append(tmp.verts.new(c + radial * (r * math.cos(b)) + side * (r * math.sin(b))))
            rings.append(ring)
        for i in range(seg):
            for j in range(rseg):
                k = (j + 1) % rseg
                tmp.faces.new((rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]))
        for ring, flip in ((rings[0], True), (rings[-1], False)):
            f = tmp.faces.new(ring)
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
        if plane == "yz":
            bmesh.ops.transform(tmp, matrix=Matrix.Rotation(math.pi / 2, 4, "Z"), verts=tmp.verts)
        elif plane == "xy":
            bmesh.ops.transform(tmp, matrix=Matrix.Rotation(-math.pi / 2, 4, "X"), verts=tmp.verts)
        self._merge(tmp, color, center, None)

    def poly_prism(self, pts2d, depth, color, center=(0, 0, 0), axis="y"):
        """Extruye un poligono 2D (x,z) a lo largo de y (o x)."""
        tmp = bmesh.new()
        vs = [tmp.verts.new((x, -depth / 2, z)) for x, z in pts2d]
        f = tmp.faces.new(vs)
        ext = bmesh.ops.extrude_face_region(tmp, geom=[f])
        nv = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.translate(tmp, vec=(0, depth, 0), verts=nv)
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
        if axis == "x":
            bmesh.ops.transform(tmp, matrix=Matrix.Rotation(math.pi / 2, 4, "Z"), verts=tmp.verts)
        self._merge(tmp, color, center, None)

    def _merge(self, tmp, color, center, rot):
        for f in tmp.faces:
            f.material_index = PID[color]
        if rot is not None:
            bmesh.ops.transform(tmp, matrix=rot, verts=tmp.verts)
        bmesh.ops.translate(tmp, vec=Vector(center), verts=tmp.verts)
        me = bpy.data.meshes.new("_tmp")
        tmp.to_mesh(me)
        tmp.free()
        self.bm.from_mesh(me)   # agrega a lo ya acumulado
        bpy.data.meshes.remove(me)

    def recolor_faces(self, test, color):
        """Pinta las caras cuyo centro cumple test(centro, normal)."""
        for f in self.bm.faces:
            if test(f.calc_center_median(), f.normal):
                f.material_index = PID[color]

    def finish(self, name, material, collection=None, smooth_angle=None, weld=True):
        me = bpy.data.meshes.new(name)
        if weld:
            bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        uv = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            u = cell_uv(poly.material_index)
            for li in poly.loop_indices:
                uv.data[li].uv = u
            poly.material_index = 0
        me.materials.append(material)
        ob = bpy.data.objects.new(name, me)
        (collection or bpy.context.scene.collection).objects.link(ob)
        if smooth_angle:
            for p in me.polygons:
                p.use_smooth = True
            with bpy.context.temp_override(object=ob, active_object=ob,
                                           selected_objects=[ob], selected_editable_objects=[ob]):
                bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
        return ob


def empty(name, loc, parent, collection, size=0.05, rot=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "ARROWS"
    e.empty_display_size = size
    e.location = loc
    e.rotation_euler = rot
    e.parent = parent
    collection.objects.link(e)
    return e


def new_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)
    s = bpy.context.scene
    s.unit_settings.system = "METRIC"
    s.unit_settings.scale_length = 1.0
    return s


def collection(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    return c
