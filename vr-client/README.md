# Cliente VR (Unity 6 · Meta Quest 3 y Quest 2)

App de realidad mixta del laboratorio. En el visor el alumno:

- ve el aula a través del passthrough;
- toma piezas con las manos o los controles;
- despieza un equipo (vista explotada);
- lo vuelve a armar encajando cada pieza en su lugar.

Todo lo que hace se registra y viaja al backend, que se lo muestra al docente en vivo.

| Requisito | Versión |
|---|---|
| Unity | 6 (6000.0 LTS) con **Android Build Support** (SDK, NDK, OpenJDK) |
| Paquetes | XR Interaction Toolkit 3, XR Hands, OpenXR, Unity OpenXR: Meta, glTFast, Input System, URP (ver `Packages/manifest.json`) |
| Visor | Meta Quest 3 (principal) o Quest 2. En el Quest 2 el passthrough es en escala de grises y no hay profundidad. |

## Scripts

| Archivo | Qué hace |
|---|---|
| `Interaction/ExplodedViewManager.cs` | Vista explotada: interpola (LERP con curva y escalonado) cada pieza entre su lugar armado y el despiezado. Las piezas se descubren por nombre (`Part_*`). Los desplazamientos vienen del manifest del backend (`ApplyManifest`), del FBX o se calculan solos. Una pieza que está en la mano o encajada no se mueve. |
| `Interaction/SnapZone.cs` | Zona de encaje: detecta las piezas con un collider en modo trigger. Si la pieza que se tiene en la mano es la correcta y está a tiro, muestra la silueta. Al soltarla la acopla magnéticamente, con la orientación simétrica más cercana. Si no corresponde, registra el error con el motivo («Esa pieza no va en este lugar», «Girala hasta alinearla…»). Si una pieza cae cerca de varias zonas, la toma la más cercana que la acepte y el error se cuenta una sola vez. |
| `Interaction/SnappablePart.cs` | Pieza que se puede tomar (XR Grab Interactable, con manos o controles) y encajar. Avisa cuándo se toma y se suelta, y hace el último tramo del encaje. |
| `Telemetry/TelemetryLogger.cs` | Sesión de práctica. Ver más abajo. |
| `Editor/BuildScript.cs` | Compilación del APK sin interfaz (`-batchmode`). Configura Android ARM64, IL2CPP, Vulkan y ASTC, y verifica que OpenXR esté activo. |
| `Editor/ModelImportPostprocessor.cs` | Al importar un FBX del laboratorio en `Assets/Models/`, crea las zonas de encaje (`Snap_*`), la vista explotada (desplazamientos `explotar` de cada `Part_*`) y hace tomables las piezas que algún encaje acepta. |

`TelemetryLogger.cs` en detalle:

- Manda cada evento (tomar, soltar, encajar, error, despiece, pista) en vivo a `POST /api/v1/telemetry/event`.
- Manda el informe completo a `POST /api/v1/telemetry/session` cada 20 s, al sacarse el visor y al terminar. El backend lo actualiza por `session_id`.
- Sin wifi, el informe queda en una bandeja en disco y se reintenta con espera exponencial.

La lógica sin `MonoBehaviour` está en clases aparte, que se prueban fuera de Unity:

| Archivo | Contenido |
|---|---|
| `Core/ExplodedViewMath.cs` | Curvas, escalonado y conversión de glTF a Unity |
| `Core/SnapMath.cs` | Reglas de encaje, simetrías y fuerza del imán |
| `Core/ModelManifest.cs` | Espejo de `GET /api/v1/models/manifest` |
| `Core/UserPropertyParser.cs` | Propiedades del FBX |
| `Telemetry/TelemetryModels.cs` | Espejo del contrato de telemetría (`backend/app/schemas.py`), JSON, reintentos y bandeja |
| `Telemetry/TelemetryUploader.cs` | Envío con reintentos, independiente del transporte |
| `Editor/BuildArguments.cs` | Argumentos de la compilación |

## Verificar sin Unity

```bash
cd Tools/verificar-compilacion && dotnet build -warnaserror   # compila todos los scripts y las pruebas EditMode
dotnet run --project ../pruebas-logica                         # 41 pruebas de la lógica pura
```

`Tools/verificar-compilacion/Stubs/` tiene las firmas mínimas de la API de Unity, de XR Interaction Toolkit y de NUnit que usan los scripts. La matemática de `Vector3`, `Quaternion` y `Mathf` está implementada con las fórmulas de Unity, porque las pruebas de lógica corren sobre ella.

Si un script empieza a usar algo nuevo de Unity, se agrega a los stubs con la firma real. Las pruebas EditMode (`Assets/Tests/EditMode`) corren dentro de Unity: Window → General → Test Runner.

El contrato también se probó contra el backend: el informe y el evento que genera `TelemetrySession` pasan la validación de `SessionReport` y `LiveEvent` de Pydantic.

## Armar el proyecto en el editor

Las escenas, los prefabs y los ajustes de XR se guardan en el proyecto de Unity y se arman una sola vez.

1. **Abrir** `vr-client/` con Unity 6000.0 LTS. Los paquetes se instalan solos desde `Packages/manifest.json`.
2. **XR Plug-in Management** (Project Settings):
   1. En la pestaña Android, activar **OpenXR**.
   2. En OpenXR → Android, activar el grupo **Meta Quest** con las funciones:
      - Meta Quest Support;
      - Camera (Passthrough);
      - Session;
      - Hand Tracking Subsystem (XR Hands).
   3. En los perfiles de interacción, agregar **Oculus Touch Controller Profile** y **Hand Interaction Profile**.
3. **Ejemplos de XR Interaction Toolkit**: en Package Manager, importar **Starter Assets** y **Hands Interaction Demo**.
4. **Escena** `Assets/Scenes/Lab.unity`:
   - **Rig:** el prefab `XR Origin (XR Rig)` de los Starter Assets.
   - **Passthrough:** un `AR Session` en la escena. En la cámara del rig, `AR Camera Manager` y fondo de color sólido negro con **alfa 0**.
   - **Telemetría:** un objeto con `TelemetryLogger`. Configurar la URL del backend en la red del aula (p. ej. `http://192.168.0.10:8000`), el escenario (`cubesat`, `motor`…), el alumno y, si el backend la exige (`XRLAB_API_KEY`), la clave. Se pueden cambiar en el visor con `TelemetryLogger.Configure` y quedan guardados.
5. **Modelos**:
   1. Copiar los FBX de `/models/fbx` a `Assets/Models/`. El importador arma las zonas de encaje, la vista explotada y las piezas tomables.
   2. Arrastrar el modelo a la escena.
   3. Si las piezas se van a sacar y volver a encajar, duplicar el encaje correspondiente como silueta (`ghost`) con un material semitransparente.
6. **Despiece:** un botón de UI (o un *poke* con el dedo) que llame a `ExplodedViewManager.Toggle()`.
7. **Build Settings:** agregar `Lab.unity`.

## Compilar el APK

```bash
Unity -batchmode -quit -projectPath vr-client -executeMethod XRLab.Editor.BuildScript.BuildQuest \
      -buildOutput Builds/Quest/XRLab.apk -buildVersion 0.1.0 -buildNumber 1 -logFile -
adb install -r vr-client/Builds/Quest/XRLab.apk
```

| Argumento | Para qué |
|---|---|
| `-development` | Build de desarrollo, con perfilador |
| `-aab` | App Bundle |
| `-appId` | Identificador del paquete (por defecto `com.utec.xrlab`) |
| `-scenes` | Escenas separadas por `;` (por defecto, las de Build Settings) |

También se pueden usar las variables de entorno `XRLAB_BUILD_VERSION` y `XRLAB_BUILD_NUMBER`. Desde el editor: menú **XR Lab → Compilar APK para Quest**.

La app sale con código 1 si falta algo:

- escenas;
- Android Build Support;
- OpenXR para Android;
- errores de compilación.

El APK permite HTTP sin cifrar, para llegar al backend por IP en la red local del aula.
