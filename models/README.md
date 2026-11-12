# Modelos 3D

Activos del laboratorio, generados con Blender 5.2 (bpy) por `tools/generar_modelos.py`. No hay modelos hechos a mano: cada pieza, medida y encaje sale del script.

| Id | Activo | Piezas | Encajes | Triángulos |
|---|---|---|---|---|
| `forklift` | Montacargas eléctrico 2,5 t (mástil dúplex, carro, horquillas, batería) | 16 | 1 (pallet en las horquillas) | 2.076 |
| `pallet` | Pallet EUR 1200 × 800 con 8 cajas | 9 | 1 (base) | 1.104 |
| `rack` | Rack selectivo de 2 módulos × 3 niveles | 11 | 12 (dos pallets por hueco) | 420 |
| `sensor` | Sensor fotoeléctrico M18 con conector M12 | 8 | 1 (soporte) | 468 |
| `motor` | Motor trifásico IEC 132, 5,5 kW | 11 | 1 (acople del eje) | 2.108 |
| `cubesat` | CubeSat 1U con pila PC/104, batería y paneles | 10 | 4 (ranuras OBC, EPS, COM y despliegue) | 432 |

## Carpetas

- `glb/`: glTF binario, Y arriba, en metros. Lo usan el visor web y glTFast en Unity.
- `fbx/`: FBX con escala 1, Y arriba y −Z adelante, con propiedades personalizadas para Unity.
- `blend/`: fuente editable.
- `manifest.json`: por cada activo, sus archivos, medidas, masa, triángulos, piezas y encajes.

## Convenciones

Las usan el backend, el visor web y el cliente VR.

- **Raíz del activo:** un vacío con `nombre`, `categoria` y `descripcion`.
- **Piezas:** se llaman `Part_<Nombre>` y llevan:
  - `pieza`: nombre en español;
  - `material`;
  - `masa_kg`;
  - `explotar`: desplazamiento de la vista explotada en metros, en ejes glTF (y arriba).

  Una pieza hija de otra se mueve con ella. Por ejemplo, las horquillas cuelgan del carro.
- **Encajes:** se llaman `Snap_<Id>` y llevan `encaje` (el tipo de pieza que aceptan: `pallet`, `placa_obc`, …) y `tolerancia_m`.

En glTF estas propiedades llegan como `extras`, que three.js guarda en `userData`. En FBX llegan como propiedades personalizadas, que Unity lee con un `AssetPostprocessor`.

## Regenerar

```bash
python3 models/tools/generar_modelos.py          # bpy de pip (Python 3.13)
blender -b -P models/tools/generar_modelos.py    # o con Blender 5.2
python3 models/tools/verificar_manifest.py       # el manifest coincide con los archivos
```

## Modelos de los otros proyectos

`proyectos/` trae los modelos de los otros proyectos del equipo, para verlos en el visor junto a los del laboratorio. No se generan acá: los copia `tools/importar_proyectos.py` desde los paquetes originales y escribe `proyectos/manifest.json` leyendo cada `.glb` (medidas, triángulos, piezas y encajes).

| Colección | Activos | Origen |
|---|---|---|
| Terminal portuaria | grúa STS, grúa RTG, buque Panamax, contenedor de 40', tractor de terminal | kit portuario de Blender de Logística 3D |
| Juego del montacargas | autoelevador y depósito con racks, pallets y zonas de descarga | quest-xr-pilotos (`autoelevador/`) |
| Atlas XR | globo logístico con puertos y rutas (`.glb` y `.usdz` para RA) | quest-xr-pilotos (`atlas-xr/`) |
| Brazo robótico (RA) | brazo de 6 ejes (`.glb` y `.usdz` para RA) | quest-xr-pilotos (`brazo-robotico/`) |

Diferencias con los modelos del laboratorio:

- las piezas conservan el nombre del nodo original (`Trolley`, `Wrist_1`, …) y el manifest dice cuál es la pieza padre;
- no traen masa (`masa_kg: null`) ni desplazamiento de vista explotada: el visor separa cada pieza alejándola del centro de su pieza padre, sin bajarla del piso;
- las mallas auxiliares del kit (`UCX_` de colisión, `ShadowCatcher` y los LOD 1 a 3) no cuentan para medidas ni triángulos y el visor las oculta.

```bash
python3 models/tools/importar_proyectos.py --quest ../quest-xr-pilotos --kit <salida del kit industrial> --kit <salida de buques y contenedores>
```
