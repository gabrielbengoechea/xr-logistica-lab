# Kit 3D de Artigas-1 (Blender)

Scripts de Python que generan todos los modelos del kit (v0.5) con Blender 5.x, sin modelado a mano: los FBX y texturas de `../Assets/Artigas1/` salen de acá. Para cambiar una medida, se cambia el script y se regenera todo.

| Script | Qué genera |
|---|---|
| `kitlib.py` | Paleta de colores (un material para todo el kit), helpers de piezas con bmesh |
| `props.py` | Barandas, bolsas BTC-1/BTC-2 (y variantes dañada y sin etiqueta), contenedor rígido, escáner, trinquete, correa, gancho, anclaje, LED |
| `modulo.py` | Módulo Rivera: casco, rack de almacén con sus huecos y puntos de enganche, escotilla, carteles |
| `colonia.py` | Módulo Colonia, portal RFID, panel de presión, consola, red de cuarentena, anillo de acople y bodega del carguero Charrúa |
| `nodo.py` | Nodo Montevideo: panel de balance, dock y tablet de muñeca, reloj, placa |
| `cupula.py` | Cúpula Faro, estación de mate y la Tierra orientada con el Río de la Plata en el nadir |
| `tacuarembo.py` | Taller: rack de soporte vital con filtro de CO₂, banco, tablero de sombras y herramientas |
| `identidad.py` | Placas institucionales y señalética logística (ESTACIÓN ARTIGAS-1, identificadores de módulo, seguridad) |
| `tierra.py` | Texturas de la Tierra con costas reales (`global-land-mask`, ~1 km) y nubes procedurales |
| `run_all2.py` | Arma todo y la estación completa en `salida/Artigas1_Kit.blend` |
| `export_web.py` | Exporta `estacion.glb` y `tierra.glb` al recorrido web |
| `export_all2.py` | Exporta FBX para Unity y GLB para la web (usa los scripts de exportación de blender-agent-skills) |

```bash
pip install bpy pillow numpy scipy global-land-mask   # bpy 5.x de pip
python3 tierra.py          # primero: texturas de la Tierra
python3 run_all2.py        # modelos y estación → salida/Artigas1_Kit.blend
export ARTIGAS1_SKILLS=/ruta/a/blender-agent-skills/blender
python3 export_web.py       # GLB del recorrido → web-dashboard/public/artigas1
python3 export_all2.py      # FBX para Unity → salida/export (copiar a Assets/Artigas1)
```

La carpeta de salida se cambia con `ARTIGAS1_SALIDA`. Convenciones: 1 unidad = 1 m, Z arriba en Blender (Y arriba en Unity y glTF), prefijo `SM_` para mallas y empties `SNAP_`, `ANCLA_`, `ETIQUETA_`, etc. como puntos de enganche (ver el README del proyecto Unity).
