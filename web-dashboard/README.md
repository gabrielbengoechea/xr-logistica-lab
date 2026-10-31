# Tablero web (React · TypeScript · Tailwind · React Three Fiber)

La portada de los estudiantes, el tablero del docente y el visor 3D de los modelos del laboratorio.

**Portada de estudiantes** (`/`, sin `#`). Muestra los 8 simuladores WebXR del equipo agrupados en tres secciones: recorrer un lugar, practicar una tarea y explorar sobre la mesa. Cada tarjeta es la puerta de un contenedor con el color de su área y el modelo adelante, y abre el simulador publicado en GitHub Pages. El filtro «¿Con qué vas a entrar?» deja solo los que andan en el visor Quest, la compu o el celular. «Soy docente» lleva al tablero (`#panel`). La lista está en `src/estudiante/simuladores.ts`. Las imágenes de `public/simuladores/` son renders de los `.glb` del repositorio con fondo transparente; la del motor sale de la escena de `quest-xr-pilotos/motor-jet`.

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

## Sitio publicado (GitHub Pages)

https://gabrielbengoechea.github.io/xr-logistica-lab/ tiene la portada, el visor 3D y el inventario, sin servidor: se puede abrir en el navegador del Quest o del celular. El panel en vivo muestra un aviso, porque la telemetría necesita el backend del aula.

El workflow `pages.yml` lo publica en la rama `gh-pages` en cada push a `main`. A mano:

```bash
cd web-dashboard && XRLAB_BASE=/xr-logistica-lab/ VITE_SITIO_ESTATICO=1 npx vite build
cd .. && python3 backend/tools/exportar_sitio.py web-dashboard/dist   # datos/*.json y models/
```

Con `VITE_SITIO_ESTATICO=1`, `apiUrl` lee el manifest y el inventario de `datos/` y los modelos de `models/` (ver `rutaEstatica` en `src/lib/api.ts`).

## Estructura

| Carpeta o archivo | Contenido |
|---|---|
| `src/api/types.ts` | Espejo del contrato de `backend/app/schemas.py`. Si cambia un campo, se actualiza en el mismo PR. |
| `src/hooks/` | `useApi` (GET con carga, error y recarga), `useTelemetrySocket` (WebSocket con reconexión y ping) y `usePanelEnVivo` (une REST y WebSocket) |
| `src/lib/` | Lógica sin React, probada aparte: `sesiones.ts` (reductor del panel en vivo), `explotada.ts` (la misma matemática que `ExplodedViewMath.cs` del cliente VR), `formato.ts` y `api.ts` |
| `src/panel/`, `src/viewer/`, `src/inventario/`, `src/components/` | Componentes chicos |

## Diseño

El tablero usa IBM Plex; la portada usa Barlow Condensed para los títulos (letra de cartel industrial) y Atkinson Hyperlegible para leer. Toda la tipografía va empaquetada en la app y funciona sin internet en el aula. Hay modo claro y oscuro, que siguen al sistema o se eligen arriba a la derecha.

Los gráficos son barras de una sola serie, con la paleta validada de visualización. El valor va rotulado y hay tooltip al pasar el mouse o con el foco. Los mismos datos están en tabla.

Los estados (practicando, terminada, error, mantenimiento) siempre llevan texto o forma además del color.

El visor usa un entorno de reflejos generado en el momento, sin descargar mapas HDR.
