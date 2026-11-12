"""Exporta lo que usa el recorrido web (web-dashboard/public/artigas1): la estacion armada (GLB) y las
texturas de la Tierra (WebP).
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
# La Tierra del recorrido no es una malla: el shader calcula la esfera y solo necesita las cuatro texturas.
from PIL import Image  # noqa: E402
for nombre, calidad in (("Base_Dia", 86), ("Detalle_Dia", 90), ("Base_Noche", 90), ("Detalle_Noche", 92)):
    destino = f"{O}/tierra_{nombre.lower()}.webp"
    Image.open(f"{SALIDA}/textures/T_Tierra_{nombre}.png").save(destino, quality=calidad, method=6)
    print("OK", os.path.basename(destino), os.path.getsize(destino) // 1024)
for r in (r1,):
    for f in r["files"]:
        print("OK", os.path.basename(f["file"]), f["kb"], f.get("summary"))
