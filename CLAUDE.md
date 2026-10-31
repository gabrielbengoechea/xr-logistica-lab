# CLAUDE.md: XR Logística Lab

Laboratorio de realidad mixta para enseñar logística e ingeniería. Tiene tres partes que comparten un mismo contrato de datos:

- un cliente VR en Unity para Meta Quest;
- una API en Python;
- un tablero web para el docente.

## Arquitectura

| Carpeta | Qué es | Tecnología |
|---|---|---|
| `/models` | Activos 3D: montacargas, pallet, rack, sensor, motor y CubeSat, con piezas para la vista explotada y encajes, más `manifest.json`; en `proyectos/`, los modelos del puerto, el juego del montacargas, Atlas XR y el brazo robótico | Blender 5.2 (bpy): `.blend`, `.fbx` y `.glb` |
| `/backend` | API REST y WebSocket: inventario, telemetría de sesiones VR, manifest de modelos | Python 3.11+, FastAPI, Pydantic v2, SQLite |
| `/web-dashboard` | Visor 3D de los modelos y panel del docente con métricas en vivo | React 18, TypeScript, Vite, Tailwind CSS, three.js y React Three Fiber |
| `/vr-client` | App de realidad mixta: passthrough, manos, vista explotada, encajes y telemetría | Unity 6 (6000.0 LTS), C#, OpenXR, XR Interaction Toolkit 3, XR Hands, Meta OpenXR |

```
Quest (Unity) ──HTTP POST /api/v1/telemetry/session──▶ FastAPI ──WS /ws/telemetry──▶ Tablero web (React)
      ▲                                                 │  ▲
      └──── GET /api/v1/models/manifest, /inventory ────┘  └── GET /api/v1/telemetry/* (métricas)
/models ──(manifest.json + .glb)──▶ backend (/models/*) ──▶ visor three.js y glTFast en Unity
```

**Dispositivos.** El objetivo principal es el Meta Quest 3. También funciona en el Quest 2: Android, ARM64, Vulkan u OpenGLES3 y OpenXR. En el Quest 2 el passthrough es en escala de grises y no hay detección de profundidad.

## Comandos

```bash
# Modelos (bpy 5.2 de pip o Blender 5.2)
python3 models/tools/generar_modelos.py
python3 models/tools/verificar_manifest.py     # revisa los dos manifests
python3 models/tools/importar_proyectos.py --quest ../quest-xr-pilotos --kit DIR   # trae los modelos de los otros proyectos

# Backend
cd backend && python3 -m pip install -r requirements-dev.txt
cd backend && python3 -m pytest -q
cd backend && uvicorn app.main:app --reload --port 8000        # http://localhost:8000/docs

# Tablero web
cd web-dashboard && npm ci
cd web-dashboard && npm run dev       # http://localhost:5173 (proxy /api y /ws → :8000)
cd web-dashboard && npm test && npm run build && npm run lint

# Cliente VR
# Compilación de los scripts fuera de Unity, contra firmas mínimas de la API de Unity (sin licencia):
cd vr-client/Tools/verificar-compilacion && dotnet build -warnaserror
# Pruebas de lógica pura, sin Unity (las EditMode corren dentro de Unity):
cd vr-client/Tools/verificar-compilacion && dotnet run --project ../pruebas-logica
# APK para Quest en modo batch (Unity instalado con Android Build Support):
Unity -batchmode -quit -projectPath vr-client -executeMethod XRLab.Editor.BuildScript.BuildQuest -logFile -
```

## Estándares de código

- **Idioma:** los textos que ve el usuario, los comentarios y la documentación van en español rioplatense, en voseo. Los identificadores de API (rutas, campos JSON, clases C#) van en inglés, para que el contrato sea estable entre lenguajes.
- **Python:**
  - type hints en todo y modelos Pydantic para cada entrada y salida;
  - sin estado global mutable fuera de `app.state`;
  - `ruff` para estilo;
  - cada endpoint tiene su prueba en `backend/tests`.
- **TypeScript:**
  - `strict`, sin `any`;
  - componentes chicos, con los datos en hooks (`useApi`, `useTelemetrySocket`);
  - Tailwind para el estilo y sin CSS suelto salvo `index.css`;
  - pruebas con Vitest y Testing Library.
- **C# (Unity):**
  - namespace `XRLab`, un componente por archivo;
  - `[SerializeField] private` en lugar de campos públicos;
  - sin `Find*` en `Update`;
  - asincronía con `async`/`await` y `UnityWebRequest`;
  - la lógica pura va en clases sin `MonoBehaviour`, para probarla fuera de Unity;
  - los scripts de editor van en `Assets/Scripts/Editor` (ensamblado aparte).
- **Contrato de datos:** el backend es la fuente de verdad (`backend/app/schemas.py`). Si cambia un campo, se actualizan en el mismo PR `web-dashboard/src/api/types.ts` y `vr-client/Assets/Scripts/Telemetry/TelemetryModels.cs`.
- **Modelos 3D:**
  - se generan solo con `generar_modelos.py`; nada a mano en `glb/`, `fbx/` ni `blend/`;
  - los de `proyectos/` se copian solo con `importar_proyectos.py`;
  - metros y Y arriba en glTF;
  - piezas `Part_*` y encajes `Snap_*` (ver `models/README.md`).
- **Git:**
  - ramas `feature/<tema>` y PR hacia `main` con las verificaciones en verde;
  - commits en español, en imperativo y con cuerpo explicativo cuando hace falta;
  - no se suben `Library/`, `node_modules/`, bases `.db` ni APK.

## Estado del desarrollo

| Componente | Estado |
|---|---|
| Estructura, `CLAUDE.md`, modelos 3D y manifest | Listo en `main` |
| Backend FastAPI: inventario, telemetría, manifest, WebSocket y pruebas | PR `feature/backend-init` |
| Scripts Unity: vista explotada, encajes, telemetría y build batch | PR `feature/vr-scripts` |
| Tablero web: visor 3D y panel docente | PR `feature/web-dashboard` |
| Modelos de los otros proyectos en el catálogo y el visor (colecciones) | PR `feature/modelos-proyectos` |
| Escenas Unity, prefabs y configuración XR del proyecto | Se arman en el editor de Unity a partir de los scripts (ver `vr-client/README.md`) |
| Autenticación de docentes y despliegue en la nube | Pendiente |
