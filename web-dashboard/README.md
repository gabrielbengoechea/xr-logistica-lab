# Tablero web (React · TypeScript · Tailwind · React Three Fiber)

El tablero del docente y el visor 3D de los modelos del laboratorio.

| Sección | Qué muestra | De dónde salen los datos |
|---|---|---|
| **Panel docente** | Quién está practicando ahora, sesiones con avance, errores, duración y puntaje, feed en vivo de lo que pasa en cada visor, detalle con la línea de tiempo de una sesión, y resumen por escenario (gráficos y tabla) y por alumno | `GET /api/v1/telemetry/sessions`, `/summary` y `/sessions/{id}/events`; WebSocket `/ws/telemetry` |
| **Visor 3D** | Los 6 modelos de `/models` (glb) con vista explotada animada, piezas resaltables (pasando el mouse por la lista o por el modelo), encajes rotulados, datos de cada pieza y descarga de glb, fbx y blend | `GET /api/v1/models/manifest` y los archivos servidos en `/models/*` |
| **Inventario** | Planta del depósito con cada componente ubicado (la forma y el color del marcador dicen su estado) y tabla filtrable por zona | `GET /api/v1/inventory` |

Las sesiones y los eventos llegan solos por WebSocket. Si se corta la conexión, se reconecta con espera exponencial y lo avisa arriba a la derecha.

El panel sigue escuchando aunque se mire otra pestaña. three.js se descarga solo al abrir el visor: el panel carga unos 60 KB comprimidos.

## Uso

```bash
npm ci
npm run dev          # http://localhost:5173 (con el backend en :8000: cd ../backend && uvicorn app.main:app --port 8000)
npm test             # Vitest + Testing Library
npm run lint         # ESLint (TypeScript estricto, sin any, reglas de hooks)
npm run build        # tsc + Vite → dist/
```

En desarrollo, Vite redirige `/api`, `/ws` y `/models` al backend: `http://127.0.0.1:8000` por defecto, o lo que diga `XRLAB_BACKEND`.

En producción, si el tablero se sirve desde otro origen, compilar con la URL del backend:

```bash
VITE_API_BASE=http://192.168.0.10:8000 npm run build
```

En ese caso, agregar el origen del tablero a `XRLAB_CORS_ORIGINS` en el backend.

## Estructura

| Carpeta o archivo | Contenido |
|---|---|
| `src/api/types.ts` | Espejo del contrato de `backend/app/schemas.py`. Si cambia un campo, se actualiza en el mismo PR. |
| `src/hooks/` | `useApi` (GET con carga, error y recarga), `useTelemetrySocket` (WebSocket con reconexión y ping) y `usePanelEnVivo` (une REST y WebSocket) |
| `src/lib/` | Lógica sin React, probada aparte: `sesiones.ts` (reductor del panel en vivo), `explotada.ts` (la misma matemática que `ExplodedViewMath.cs` del cliente VR), `formato.ts` y `api.ts` |
| `src/panel/`, `src/viewer/`, `src/inventario/`, `src/components/` | Componentes chicos |

## Diseño

Tipografía IBM Plex, empaquetada en la app: funciona sin internet en el aula. Hay modo claro y oscuro, que siguen al sistema o se eligen arriba a la derecha.

Los gráficos son barras de una sola serie, con la paleta validada de visualización. El valor va rotulado y hay tooltip al pasar el mouse o con el foco. Los mismos datos están en tabla.

Los estados (practicando, terminada, error, mantenimiento) siempre llevan texto o forma además del color.

El visor usa un entorno de reflejos generado en el momento, sin descargar mapas HDR.
