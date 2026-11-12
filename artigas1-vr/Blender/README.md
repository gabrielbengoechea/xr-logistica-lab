# Kit 3D de Artigas-1 (Blender)

Scripts de Python que generan todos los modelos del kit (v0.5) con Blender 5.x, sin modelado a mano: los FBX y texturas de `../Assets/Artigas1/` salen de acá. Para cambiar una medida, se cambia el script y se regenera todo.

| Script | Qué genera |
|---|---|
| `kitlib.py` | Paleta de colores (un material para todo el kit), helpers de piezas con bmesh |
| `props.py` | Barandas, bolsas BTC-1/BTC-2 (y variantes dañada y sin etiqueta), contenedor rígido, escáner, trinquete, correa, gancho, anclaje, LED |
| `modulo.py` | Módulo Rivera: casco, rack de almacén con sus huecos y puntos de enganche, escotilla, carteles |
| `colonia.py` | Módulo Colonia, portal RFID, panel de presión, consola, red de cuarentena, anillo de acople y bodega del carguero Charrúa |
| `nodo.py` | Nodo Montevideo: panel de balance, dock y tablet de muñeca, reloj, placa |
| `cupula.py` | Cúpula Faro, estación de mate y los casquetes de la Tierra para Unity, con el Río de la Plata en el nadir |
| `tacuarembo.py` | Taller: rack de soporte vital con filtro de CO₂, banco, tablero de sombras y herramientas |
| `identidad.py` | Placas institucionales y señalética logística (ESTACIÓN ARTIGAS-1, identificadores de módulo, seguridad) |
| `ambientacion.py` | Equipamiento que hace habitada la estación: cables y bandejas, paneles de control, tableros, rejillas, bolsas y redes, mecanismos de escotilla, pantallas de sistemas y los objetos sueltos que flotan |
| `tierra.py` | Texturas de la Tierra con geografía real: terreno de día y luces urbanas de noche, en dos capas centradas en el nadir (ver abajo) |
| `run_all2.py` | Arma todo y la estación completa en `salida/Artigas1_Kit.blend` |
| `export_web.py` | Exporta `estacion.glb` y las cuatro texturas de la Tierra (WebP) al recorrido web |
| `export_all2.py` | Exporta FBX para Unity y GLB para la web (usa los scripts de exportación de blender-agent-skills) |

```bash
pip install bpy pillow numpy scipy global-land-mask basemap basemap-data-hires   # bpy 5.x de pip
python3 tierra.py          # primero: texturas de la Tierra (baja ~100 MB de Natural Earth a geo/ la primera vez)
python3 run_all2.py        # modelos y estación → salida/Artigas1_Kit.blend
export ARTIGAS1_SKILLS=/ruta/a/blender-agent-skills/blender
python3 export_web.py       # GLB del recorrido → web-dashboard/public/artigas1
python3 export_all2.py      # FBX para Unity → salida/export (copiar a Assets/Artigas1)
```

La carpeta de salida se cambia con `ARTIGAS1_SALIDA`. Convenciones: 1 unidad = 1 m, Z arriba en Blender (Y arriba en Unity y glTF), prefijo `SM_` para mallas y empties `SNAP_`, `ANCLA_`, `ETIQUETA_`, etc. como puntos de enganche (ver el README del proyecto Unity).

## La Tierra: de dónde sale cada cosa

`tierra.py` no dibuja nada a mano. Proyecta datos públicos en una proyección azimutal de Lambert centrada en el nadir de la estación (35,2° S, 55,9° O), que es la misma cuenta que hace el shader del recorrido (`js/entorno.js`).

| Qué | Fuente |
|---|---|
| Costas, Río de la Plata, Laguna Merín, embalse de Rincón del Bonete | GSHHG, resolución completa (paquete `basemap-data-hires`) |
| Ríos (Uruguay, Negro, Paraná y afluentes) | WDBII (mismo paquete); los nombres y el ancho de cada cauce se asignan con Natural Earth 1:10m |
| Color del terreno y del agua | NASA Blue Marble Next Generation (`bmng.jpg` de `basemap-data`) |
| Manchas urbanas, localidades y rutas (luces de noche) | Natural Earth 1:10m |

Hay dos capas de 2048 px: la base cubre 30° alrededor del nadir (3,3 km por píxel) y el detalle, 5,5° (0,6 km por píxel: Uruguay entero, Buenos Aires y la Laguna Merín). Cada una tiene su textura de día y una de «noche» con las luces en el canal rojo y la máscara de agua en el verde. `salida/review/tierra_*_dia.png` marca ciudades de referencia para controlar posiciones y orientación.

Límites de los datos: los embalses de Baygorria y Palmar no figuran en GSHHG, así que el Río Negro muestra Rincón del Bonete y el cauce. Las luces se generan a partir de la mancha urbana y la población de cada localidad; no son una imagen satelital nocturna.

La carpeta de datos se cambia con `ARTIGAS1_GEO` (por defecto `geo/`, que no se sube al repositorio).
