"""Genera todo el kit v0.2: props, Modulo Rivera, Modulo Colonia, carguero y estacion armada."""
import sys, random, math
import os as _os
SALIDA = _os.environ.get("ARTIGAS1_SALIDA", _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "salida"))
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
import bpy
from mathutils import Matrix, Vector
import kitlib, props, modulo, colonia, nodo, cupula, tacuarembo
kitlib.new_scene()
mat = kitlib.palette_material(kitlib.write_palette_textures())
obs = props.build(mat)
P = {o.name: o for o in obs}
riv = modulo.build(mat, P)
col = colonia.build(mat, P, bpy.data.objects["SM_Escotilla_Puerta"])
nod = nodo.build(mat, P, bpy.data.objects["SM_Escotilla_Puerta"])
cup = cupula.build(mat, P)
tac = tacuarembo.build(mat, P)
sc = bpy.context.scene

def link(src, name, mw, c):
    o = bpy.data.objects.new(name, src.data); o.matrix_world = mw; c.objects.link(o); return o

# ---- carga estibada en el carguero (24 posiciones, con 3 discrepancias plantadas)
bpy.context.view_layer.update()
carga = bpy.data.collections.new("Carga_Carguero"); sc.collection.children.link(carga)
bah = bpy.data.objects["SM_Carguero_Bahia"]
est = sorted([c for c in bah.children if c.name.startswith("ESTIBA_")], key=lambda e: e.name)
random.seed(11)
plan = []
for code, b in col["bahias"].items():
    for e in est:
        plan.append((code, b, e))
especiales = {("E", "ESTIBA_C1_N3"): "SM_BTC_1_Danada", ("B", "ESTIBA_C2_N2"): "SM_BTC_1_SinEtiqueta"}
vacio = ("B", "ESTIBA_C4_N1")   # faltante: el manifiesto la lista pero no viene
for code, b, e in plan:
    if (code, e.name) == vacio: continue
    src = especiales.get((code, e.name)) or ("SM_BTC_2" if random.random() < 0.3 else "SM_BTC_1")
    link(bpy.data.objects[src], f"Carga_{code}_{e.name[7:]}_{src[3:]}", b.matrix_world @ Matrix.Translation(e.matrix_local.translation), carga)


# ---- carga de ejemplo en los racks de Rivera (solo para la vista previa)
demo = bpy.data.collections.new("Demo_Carga"); sc.collection.children.link(demo)
rk = bpy.data.objects["SM_Rack_Almacen"]
snaps = [c for c in rk.children if c.name.startswith("SNAP_")]
random.seed(4)
for o in sorted(bpy.data.collections["Layout_Rivera"].objects, key=lambda o: o.name):
    if not o.name.startswith("Rack_"): continue
    for e in snaps:
        r = random.random()
        src = "SM_BTC_1" if r < 0.45 else "SM_BTC_2" if r < 0.65 else None
        if src:
            link(bpy.data.objects[src], f"Demo_{o.name[5:]}_{e.name[5:]}", o.matrix_world @ Matrix.Translation(e.matrix_local.translation), demo)

# ---- estacion armada: Rivera + anillo + Colonia (+ carguero)
est_col = bpy.data.collections.new("Layout_Estacion"); sc.collection.children.link(est_col)
for o in bpy.data.collections["Layout_Rivera"].objects:
    mw = o.matrix_world.copy()
    if o.name == "Escotilla_HaciaNodo":     # en la estacion armada va cerrada, dentro del anillo
        mw = Matrix.Translation((-(modulo.HATCH + 0.03), modulo.Y0 - modulo.TUN - 0.026, 0))
    link(o, "R_" + o.name, mw, est_col)
yN = modulo.Y0 - modulo.TUN - colonia.COLLAR - modulo.TUN - nodo.NL
link(bpy.data.objects["SM_Anillo_Acople"], "Anillo_Nodo_Rivera", Matrix.Translation((0, modulo.Y0 - modulo.TUN - colonia.COLLAR, 0)), est_col)
N = Matrix.Translation((0, yN, 0))
for o in nod["lay"].objects:
    link(o, "N_" + o.name, N @ o.matrix_world, est_col)
yT = yN - modulo.TUN - colonia.COLLAR - modulo.TUN - tacuarembo.TL
link(bpy.data.objects["SM_Anillo_Acople"], "Anillo_Tacuarembo_Nodo", Matrix.Translation((0, yN - modulo.TUN - colonia.COLLAR, 0)), est_col)
TT = Matrix.Translation((0, yT, 0))
for o in tac["lay"].objects:
    link(o, "T_" + o.name, TT @ o.matrix_world, est_col)
zC = -modulo.A - modulo.TUN
link(bpy.data.objects["SM_Anillo_Acople"], "Anillo_Nodo_Cupula", N @ Matrix.Translation((0, nodo.YC, zC)) @ Matrix.Rotation(-math.pi / 2, 4, "X"), est_col)
CU = N @ Matrix.Translation((0, nodo.YC, zC - colonia.COLLAR))
for o in cup["lay"].objects:
    link(o, "F_" + o.name, CU @ o.matrix_world, est_col)
tierra_est = bpy.data.collections.new("Tierra_Estacion"); sc.collection.children.link(tierra_est)
link(cup["tierra"], "Tierra_Estacion", CU @ cup["tierra"].matrix_world, tierra_est)
link(cup["tierra_det"], "Tierra_Detalle_Estacion", CU @ cup["tierra_det"].matrix_world, tierra_est)
for o in demo.objects:
    link(o, "R_" + o.name, o.matrix_world.copy(), est_col)
yC = modulo.Y1 + modulo.TUN + colonia.COLLAR + modulo.TUN
link(bpy.data.objects["SM_Anillo_Acople"], "Anillo_Rivera_Colonia", Matrix.Translation((0, modulo.Y1 + modulo.TUN, 0)), est_col)
C = Matrix.Translation((0, yC, 0))
for o in list(col["lay"].objects) + list(carga.objects):
    link(o, "C_" + o.name, C @ o.matrix_world, est_col)
for c in ("Props", "Modulo_Rivera", "Modulo_Colonia", "Carguero_Charrua", "Nodo_Montevideo", "Cupula_Faro", "Layout_Tierra", "Modulo_Tacuarembo"):
    bpy.data.collections[c].hide_render = True
x = 0
for ob in obs:
    if ob.parent: continue
    ob.location = (x, -4, 0); x += max(ob.dimensions.x, 0.15) + 0.25
bpy.ops.wm.save_as_mainfile(filepath=SALIDA + "/Artigas1_Kit.blend")
t = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons) if o.type == "MESH" else 0
for c in ("Layout_Tacuarembo", "Layout_Cupula", "Layout_Nodo", "Layout_Rivera", "Layout_Colonia", "Carga_Carguero", "Layout_Estacion"):
    obj = bpy.data.collections[c].objects
    print(c, len(obj), "objetos", sum(t(o) for o in obj), "tris")
print("Tacuarembo en y =", round(yT, 3), "Nodo en y =", round(yN, 3), "Colonia en y =", round(yC, 3), "carguero en y =", round(yC + col["gy"], 3), "niveles carguero", round(col["ch"], 3))
for n in ("SM_Modulo_Colonia_Casco", "SM_Portal_RFID", "SM_Panel_Presion", "SM_Consola_Recepcion", "SM_Red_Cuarentena", "SM_Anillo_Acople", "SM_Carguero_Bodega_Casco", "SM_Carguero_Bahia", "SM_BTC_1_Danada", "SM_BTC_1_SinEtiqueta", "SM_Nodo_Montevideo_Casco", "SM_Panel_Balance", "SM_Dock_Tablets", "SM_Tablet_Muneca", "SM_Reloj", "SM_Cupula_Faro_Casco", "SM_Cupula_Vidrios", "SM_Mate_0G", "SM_Dispensador_Agua", "SM_Toalla", "SM_Esfera_Agua", "SM_Tierra", "SM_Tierra_Detalle", "SM_Modulo_Tacuarembo_Casco", "SM_Rack_Soporte_Vital", "SM_Puerta_Filtro", "SM_Filtro_CO2", "SM_Banco_Trabajo", "SM_Tablero_Sombras", "SM_Llave_Inglesa", "SM_Destornillador", "SM_Multimetro"):
    o = bpy.data.objects[n]; print(n, tuple(round(v, 3) for v in o.dimensions), t(o))
