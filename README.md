# XR Logística Lab

Laboratorio de realidad mixta para Meta Quest 3 y Quest 2, para practicar logística e ingeniería. En el visor se arma y se desarma equipamiento real:

- montacargas;
- pallet;
- rack selectivo;
- sensor fotoeléctrico;
- motor trifásico;
- CubeSat 1U.

Cada pieza se ve en vista explotada y encaja en su lugar. Mientras tanto, el visor manda métricas al tablero del docente: tiempos, errores de ensamblaje e interacciones.

| Carpeta | Contenido |
|---|---|
| [`models/`](models/README.md) | Modelos 3D generados con Blender (`.blend`, `.fbx`, `.glb`) y su `manifest.json` |
| `backend/` | API FastAPI: inventario, telemetría de sesiones, manifest de modelos, WebSocket en vivo |
| `web-dashboard/` | React, TypeScript, Tailwind y React Three Fiber: visor 3D y panel del docente |
| `vr-client/` | Unity 6 con OpenXR: passthrough, manos, vista explotada, encajes y telemetría |

Las pautas de desarrollo, los comandos y el estado del proyecto están en [`CLAUDE.md`](CLAUDE.md).
