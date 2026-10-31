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
