import sys, bpy, shutil, os
# Scripts de exportación del paquete blender-agent-skills (MIT): ARTIGAS1_SKILLS apunta a su carpeta "blender".
import os as _os
SALIDA = _os.environ.get("ARTIGAS1_SALIDA", _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "salida"))
Q=os.environ.get("ARTIGAS1_SKILLS", "blender-agent-skills/blender")
sys.path.insert(0, f"{Q}/blender-export-pipelines/scripts")
import export_asset as ex
bpy.ops.wm.open_mainfile(filepath=SALIDA + "/Artigas1_Kit.blend")
for c in bpy.data.collections: c.hide_render=False; c.hide_viewport=False
E=SALIDA + "/export"
for d in ("Unity","Web"): shutil.rmtree(f"{E}/{d}", ignore_errors=True)
res=[]
U=lambda **k: res.append(ex.run(preset="unity", no_anim=True, **k))
U(collection="Props", batch=True, out=f"{E}/Unity/Props/x.fbx")
U(objects=["SM_Rack_Almacen","SM_Modulo_Rivera_Casco","SM_Escotilla_Puerta","SM_Anillo_Acople"], batch=True, out=f"{E}/Unity/Modulo_Rivera/x.fbx")
U(objects=[o.name for o in bpy.data.collections["Modulo_Rivera"].objects if o.name.startswith(("SM_Cartel","SM_Etiqueta"))], out=f"{E}/Unity/Modulo_Rivera/SM_Senaletica_Rivera.fbx")
U(objects=["SM_Modulo_Colonia_Casco","SM_Portal_RFID","SM_Panel_Presion","SM_Consola_Recepcion","SM_Red_Cuarentena"], batch=True, out=f"{E}/Unity/Modulo_Colonia/x.fbx")
U(objects=[o.name for o in bpy.data.collections["Modulo_Colonia"].objects if o.name.startswith(("SM_CartelC","SM_Pantalla","SM_Marca"))], out=f"{E}/Unity/Modulo_Colonia/SM_Senaletica_Colonia.fbx")
U(collection="Carguero_Charrua", batch=True, out=f"{E}/Unity/Carguero_Charrua/x.fbx")
U(objects=["SM_Nodo_Montevideo_Casco","SM_Panel_Balance","SM_Dock_Tablets","SM_Tablet_Muneca","SM_Reloj"], batch=True, out=f"{E}/Unity/Nodo_Montevideo/x.fbx")
U(objects=[o.name for o in bpy.data.collections["Nodo_Montevideo"].objects if o.name.startswith(("SM_CartelN","SM_Pantalla","SM_Esfera","SM_Placa"))], out=f"{E}/Unity/Nodo_Montevideo/SM_Senaletica_Nodo.fbx")
U(collection="Layout_Nodo", out=f"{E}/Unity/Layout/Layout_Nodo_Montevideo.fbx")
U(objects=["SM_Cupula_Faro_Casco","SM_Mate_0G","SM_Dispensador_Agua","SM_Toalla","SM_Esfera_Agua"], batch=True, out=f"{E}/Unity/Cupula_Faro/x.fbx")
U(objects=[o.name for o in bpy.data.collections["Cupula_Faro"].objects if o.name.startswith(("SM_CartelF","SM_Pantalla"))], out=f"{E}/Unity/Cupula_Faro/SM_Senaletica_Cupula.fbx")
U(collection="Layout_Cupula", out=f"{E}/Unity/Layout/Layout_Cupula_Faro.fbx")
U(objects=["Tierra","Tierra_Detalle"], out=f"{E}/Unity/Entorno/Tierra_Uruguay_al_nadir.fbx")
U(objects=["SM_Modulo_Tacuarembo_Casco","SM_Rack_Soporte_Vital","SM_Filtro_CO2","SM_Banco_Trabajo","SM_Tablero_Sombras","SM_Llave_Inglesa","SM_Destornillador","SM_Multimetro"], batch=True, out=f"{E}/Unity/Modulo_Tacuarembo/x.fbx")
U(objects=[o.name for o in bpy.data.collections["Modulo_Tacuarembo"].objects if o.name.startswith(("SM_CartelT","SM_Pantalla","SM_Etiqueta_TAC"))], out=f"{E}/Unity/Modulo_Tacuarembo/SM_Senaletica_Tacuarembo.fbx")
U(collection="Layout_Tacuarembo", out=f"{E}/Unity/Layout/Layout_Modulo_Tacuarembo.fbx")
U(collection="Identidad", out=f"{E}/Unity/Identidad/SM_Placas_Identidad.fbx")
U(collection="Layout_Rivera", out=f"{E}/Unity/Layout/Layout_Modulo_Rivera.fbx")
U(objects=[o.name for o in bpy.data.collections["Layout_Colonia"].objects]+[o.name for o in bpy.data.collections["Carga_Carguero"].objects], out=f"{E}/Unity/Layout/Layout_Colonia_y_Carguero.fbx")
U(collection="Layout_Estacion", out=f"{E}/Unity/Layout/Layout_Estacion_Completa.fbx")
res.append(ex.run(preset="gltf", objects=[o.name for o in bpy.data.collections["Layout_Estacion"].objects], out=f"{E}/Web/Artigas1_Estacion_preview.glb", no_anim=True))
props=[o.name for o in bpy.data.collections["Props"].objects if o.parent is None]
res.append(ex.run(preset="gltf", objects=props, out=f"{E}/Web/Artigas1_Props_preview.glb", no_anim=True))
shutil.copytree(SALIDA + "/textures", f"{E}/Unity/Textures")
n=0
for r in res:
    n+=len(r["files"])
    print("OK" if r["ok"] else "FAIL", [(os.path.basename(f["file"]), f["kb"]) for f in r["files"]], r["warnings"][:2])
    for f in r["files"]:
        if "summary" in f: print("   GLB", f["summary"])
print("TOTAL", n)
