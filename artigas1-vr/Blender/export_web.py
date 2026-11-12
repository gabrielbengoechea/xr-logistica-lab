"""Exporta los GLB del recorrido web (web-dashboard/public/artigas1): la estacion armada y la Tierra.
Requiere haber corrido run_all2.py. ARTIGAS1_SKILLS apunta a la carpeta "blender" de blender-agent-skills."""
import os
import sys

import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.environ.get("ARTIGAS1_SALIDA", os.path.join(AQUI, "salida"))
Q = os.environ.get("ARTIGAS1_SKILLS", "blender-agent-skills/blender")
O = os.environ.get("ARTIGAS1_WEB", os.path.normpath(os.path.join(AQUI, "../../web-dashboard/public/artigas1")))
sys.path.insert(0, f"{Q}/blender-export-pipelines/scripts")
import export_asset as ex  # noqa: E402

bpy.ops.wm.open_mainfile(filepath=SALIDA + "/Artigas1_Kit.blend")
for c in bpy.data.collections:
    c.hide_render = False
    c.hide_viewport = False
est = [o.name for o in bpy.data.collections["Layout_Estacion"].objects]
r1 = ex.run(preset="gltf", objects=est, out=f"{O}/estacion.glb", no_anim=True,
            set=["export_image_format=WEBP", "export_image_quality=88"])
img = bpy.data.images.load(SALIDA + "/textures/T_Tierra_2K.png")     # para la web alcanza la Tierra de 2K
for n in bpy.data.materials["M_Tierra"].node_tree.nodes:
    if n.type == "TEX_IMAGE":
        n.image = img
r2 = ex.run(preset="gltf", objects=["Tierra_Estacion", "Tierra_Detalle_Estacion"], out=f"{O}/tierra.glb", no_anim=True,
            set=["export_image_format=WEBP", "export_image_quality=85"])
for r in (r1, r2):
    for f in r["files"]:
        print("OK", os.path.basename(f["file"]), f["kb"], f.get("summary"))
