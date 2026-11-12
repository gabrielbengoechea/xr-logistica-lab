# Artigas-1 VR · proyecto Unity (fase 1)

Simulador de logística espacial en la estación uruguaya Artigas-1, para Meta Quest 2 con controles Touch. Esta primera entrega cubre la **fase 1 del plan Beta** (semanas 1-4): gravedad cero, locomoción tomándose de las barandas, agarre de carga con masa, huecos de rack con reglas, escáner, portal RFID y medición de fps, todo dentro del Módulo Rivera.

Vive en el repo de XR Logística Lab, al lado del cliente `vr-client/`, y es su hermano: misma versión de Unity, mismos paquetes (XR Interaction Toolkit 3 con OpenXR, URP) y la **misma telemetría**, así que las sesiones llegan al mismo backend y al mismo panel docente.

| Requisito | Versión |
|---|---|
| Unity | 6 (6000.0.32f1 LTS o posterior) con **Android Build Support** |
| Paquetes | XR Interaction Toolkit 3.0.7, OpenXR 1.13, Unity OpenXR: Meta 2.1, XR Management, Input System, URP 17 (ver `Packages/manifest.json`) |
| Visor | Meta Quest 2 con controles Touch (también corre en Quest 3) |

## Qué hay

```
Assets/
  Artigas1/
    Modelos/      FBX del kit 3D v0.5 (todos los módulos, props y layouts)
    Texturas/     paleta, atlas de carteles y pantallas, Tierra, estrellas
    Scripts/
      Core/       lógica pura, sin MonoBehaviour (se prueba fuera de Unity)
      Runtime/    componentes de juego
      Editor/     importador, menú Artigas-1 y compilación del APK
  XRLab/Telemetry/  telemetría copiada de xr-logistica-lab (un solo cambio, anotado en el archivo)
  Tests/EditMode/   pruebas de Unity Test Runner
Tools/pruebas-logica/  pruebas de la lógica con dotnet, sin Unity
Blender/               scripts que generan el kit 3D (ver Blender/README.md)
```

### Componentes (Runtime)

| Archivo | Qué hace |
|---|---|
| `ZeroGWorld` | Gravedad cero y paso de física de 1/72 s |
| `ObjetoFlotante` | Objeto suelto: arranca con deriva y giro lentos y lo mueve la física de Unity sin gravedad. Lo agrega el paso 3 del menú a los `*_Flot_*` de `Modelos/Ambientacion` |
| `ZeroGLocomotion` | Corrige la penetración de la cabeza contra las paredes. «Mano sobre mano»: con la mano en una baranda el cuerpo se mueve al revés que la mano; al soltar hereda la velocidad promedio (con tope) y flota con amortiguación; se frena contra las paredes. Modos Confort y Realista (sección 1.1 del plan) |
| `Agarradera` | Baranda tomable con el botón de agarre (grip); las dos manos pueden tomar la misma |
| `ConfortVineta` | Viñeta que cierra la periferia solo cuando hay aceleración, a través del `TunnelingVignetteController` de XRI |
| `CargoUnit` | Bolsa o contenedor con masa, categoría, talla y estado. Una carga pesada «llega tarde» a la mano; más de 30 kg pide las dos manos |
| `RackSlot` | Hueco de rack: valida talla, masa, categoría y ocupado; si está bien acerca la carga como un imán; LED verde/ámbar/rojo/cian |
| `EscanerHerramienta` | Escáner de mano: gatillo, rayo de 1,5 m, lee la etiqueta si se ve con menos de 45° |
| `PortalRfid` | Volumen que registra cada carga que cruza la escotilla de acople (listo para la fase 2) |
| `InventoryService` | Manifiesto del turno, lecturas y discrepancias |
| `MedidorRendimiento` | Resumen de fps cada 10 s en la consola y en logcat |
| `ControlesBeta` | A (control derecho) o M: cambia Confort/Realista. X (izquierdo) o F: frena el cuerpo |

### Lógica pura (Core)

`ZeroGMath` (velocidad al soltar, amortiguación, choque, viñeta, respuesta de la mano), `ComfortProfile`, `Cargo` (reglas de huecos y estados de la carga), `Manifiesto`, `StationMass` (centro de masa y puntaje del minijuego B) y `FrameStats`.

## Armar el proyecto (una sola vez)

1. En Unity Hub, **New project → plantilla «VR»** (Unity 6). Ya trae URP, OpenXR y XR Interaction Toolkit configurados para Quest. Llamalo `artigas1-vr`.
2. Cerrá Unity y copiá encima, desde `artigas1-vr/` de este repo: `Assets/Artigas1`, `Assets/XRLab`, `Assets/Tests`, `Tools`, `README.md` y `.gitignore`. Agregá a tu `Packages/manifest.json` las dependencias que falten de `Packages/manifest.json` de acá (sobre todo `com.unity.xr.meta-openxr` y `com.unity.test-framework`).
3. Abrí el proyecto. En **Package Manager → XR Interaction Toolkit → Samples**, importá **Starter Assets** (si la plantilla no lo trajo).
4. **Project Settings → XR Plug-in Management**:
   1. En la pestaña Android, activar **OpenXR** con el grupo **Meta Quest**.
   2. En OpenXR, agregar el perfil **Oculus Touch Controller Profile**.
5. Menú **Artigas-1**, en orden:
   - **0. Revisar el proyecto**: confirma URP, Starter Assets y shaders.
   - **1. Crear materiales**: materiales URP para la paleta, los carteles, las pantallas, el vidrio y la Tierra; reimporta los FBX con esos materiales.
   - **2. Crear prefabs**: bolsas (normal, grande, dañada, sin etiqueta), contenedor rígido, barandas, escáner, LED y rack con sus 8 huecos.
   - **3. Armar escena F1 (Módulo Rivera)**: arma `Assets/Artigas1/Escenas/F1_Rivera.unity` con el módulo, unas 45 bolsas en los racks, tres cargas flotando para practicar, el escáner, luces, el rig de XRI con la locomoción en 0G, la viñeta y la telemetría.
6. **Telemetría**: en el objeto `Sistemas → TelemetryLogger`, poné la URL del backend de XR Logística Lab en la red del aula (p. ej. `http://192.168.0.10:8000`). El escenario queda como `artigas1-f1-rivera`.

Para probar sin visor: importá el sample **XR Device Simulator** de XR Interaction Toolkit y arrastrá su prefab a la escena.

## Probar en el Quest 2

```bash
Unity -batchmode -quit -projectPath artigas1-vr -executeMethod Artigas1.Editor.BuildScript.BuildQuest \
      -buildOutput Builds/Quest/Artigas1.apk -buildVersion 0.1.0 -buildNumber 1 -logFile -
adb install -r artigas1-vr/Builds/Quest/Artigas1.apk
adb logcat -s Unity | grep Artigas1      # manifiesto, lecturas y fps cada 10 s
```

O desde el editor: **Artigas-1 → Compilar APK para Quest** (mismo script de XR Logística Lab, con identificador `com.utec.artigas1`).

### Qué medir en la fase 1 (compuerta 1 del plan)

- **Mareo**: 10 personas, 8 de 10 sin síntomas moderados (SSQ antes y después). Probar los dos modos con el botón A.
- **72 fps estables**: OVR Metrics Tool en el visor, más el resumen de `MedidorRendimiento` en logcat.
- **Agarre sin saltos**: tomarse de las barandas, soltarse, frenarse contra una pared, mover la carga de 35 kg con una mano (casi no se mueve) y con dos.

Los parámetros iniciales (1,2 m/s de tope, amortiguación 0,6/s, 5 cuadros al soltar, etc.) están en `Core/ComfortProfile.cs`: se ajustan ahí después de cada ronda.

## Verificar sin Unity

```bash
cd artigas1-vr/Tools/pruebas-logica && dotnet run     # 12 pruebas de la lógica pura (Core)
```

Corren sobre la matemática de `Tools/verificar-compilacion/Stubs/UnityMath.cs` (copiada de XR Logística Lab, con `Mathf.RoundToInt` agregado). Las pruebas EditMode corren dentro de Unity: Window → General → Test Runner.

**Importante:** los scripts se escribieron sin Unity a mano. La lógica pura compila y se prueba en GitHub Actions (`.github/workflows/artigas1-vr.yml`), pero los componentes de Unity y los de editor **todavía no se compilaron contra Unity**. La primera vez que abras el proyecto, revisá la consola: si algún nombre de la API de XR Interaction Toolkit 3.0.7 no coincide (lo más probable, en `ConfortVineta`, que usa `TunnelingVignetteController`), es un ajuste de una línea.

## Telemetría

Usa el contrato de XR Logística Lab tal cual (`backend/app/schemas.py`):

| Evento de Artigas-1 | Tipo en el contrato |
|---|---|
| Tomar / soltar una carga | `grab` / `release` (part = código de la carga) |
| Carga apoyada en un hueco válido | `snap_ok` (target = código del hueco, p. ej. `RIV-E2-A3`) |
| Hueco rechaza la carga | `snap_fail` (detail = motivo: «Demasiado pesada…», «Químicos no va en este hueco») |

Las lecturas del escáner y del portal RFID, el amarre y las alarmas todavía no tienen tipo en el contrato: por ahora quedan en el log del visor. Para la fase 2 conviene agregar `scan`, `rfid`, `strap` y `alarm` a `EventType` en el backend (y en `TelemetryModels.cs`), en un mismo PR.

## Recorrido web

La estación completa se recorre en el navegador (compu o Quest, con WebXR) desde la portada de estudiantes: `web-dashboard/public/artigas1/`, publicado en <https://gabrielbengoechea.github.io/xr-logistica-lab/artigas1/>. Es three.js 0.170 sin dependencias extra y está partido en módulos (`js/`):

| Módulo | Qué hace |
|---|---|
| `estacion.js` | Fusiona las mallas por módulo y material, arma los colliders, las barandas y las escotillas corredizas |
| `colisiones.js` | Colisiones: triángulos en una grilla espacial, esfera contra triángulo |
| `locomocion.js` | Gravedad cero con cuerpo sólido: inercia, empuje, freno, rebote amortiguado y agarre |
| `barandas.js`, `manos.js` | Barandas como capa de interacción; controles y manos en VR |
| `materiales.js` | Reflejos de entorno, juntas de panel, vidrio con Fresnel, sol en la Cúpula |
| `entorno.js` | Tierra al atardecer calculada por píxel (esfera exacta), geografía real, luces de Buenos Aires y Montevideo, atmósfera, sol y estrellas |
| `flotantes.js` | Objetos sueltos en microgravedad: deriva, rebote, empuje y agarre con las manos |
| `etiquetas.js` | Etiquetas logísticas de cada bolsa, en una sola llamada de dibujo |

Pruebas: `cd web-dashboard && npm test` (18 de física y flotantes) y `python3 artigas1-vr/Tools/pruebas-web/fisica.py` (41, sobre la estación real en Chrome). Qué se hizo, qué se midió y qué falta probar en el visor: [`INFORME-refactorizacion.md`](INFORME-refactorizacion.md) (colisiones, cúpula, materiales) e [`INFORME-ambientacion.md`](INFORME-ambientacion.md) (Tierra al atardecer, interiores y objetos flotantes).

## Lo que sigue (fase 2)

- Módulo Colonia con el portal RFID, el panel de presión y el carguero cargado (minijuego A).
- Correas y trinquete (`StrapSystem`), con las cargas «apoyadas» en ámbar hasta amarrarlas.
- Tablet de muñeca con mapa, tareas y manifiesto (Canvas en world space).
- Hornear la iluminación y combinar los LED de los huecos para bajar draw calls.
