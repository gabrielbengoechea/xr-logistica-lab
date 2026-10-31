# Backend: XR Logística Lab API

API en FastAPI (Pydantic v2) con persistencia en SQLite. Documentación interactiva en `/docs`.

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
pytest                                   # 26 pruebas
ruff check . && ruff format --check .
uvicorn app.main:app --reload --port 8000
```

## Endpoints

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/api/v1/inventory` | Componentes logísticos con sus coordenadas. Filtros: `category`, `zone`, `status`, `model_id` |
| GET | `/api/v1/inventory/{id}` | Un componente |
| GET | `/api/v1/models/manifest` | Manifest de `/models`: rutas y URLs de `.glb`, `.fbx` y `.blend`, piezas con su desplazamiento explotado, encajes, medidas y triángulos |
| GET | `/api/v1/models/{id}` | Un activo |
| GET | `/models/...` | Los archivos 3D tal cual (por ejemplo `/models/glb/motor.glb`) |
| POST | `/api/v1/telemetry/session` | Registra la sesión de un alumno: tiempos, errores de ensamblaje, pistas y eventos. Devuelve 201 si es nueva y 200 si actualiza el mismo `session_id` |
| POST | `/api/v1/telemetry/event` | Un evento suelto durante la sesión. Se reenvía en vivo a los tableros y no se guarda |
| GET | `/api/v1/telemetry/sessions` | Sesiones, de la más reciente a la más vieja. Filtros: `student_id`, `scenario`, `limit` |
| GET | `/api/v1/telemetry/sessions/{id}` y `/events` | Una sesión con sus métricas, o su lista de eventos |
| GET | `/api/v1/telemetry/summary` | Promedios por escenario y por alumno, para el tablero |
| WS | `/ws/telemetry` | Al conectar llega `hello` con el resumen. Después llegan `session_saved` y `live_event`. Responde `pong` a `ping` |
| GET | `/api/v1/health` | Estado del servidor, modelos disponibles y cantidad de sesiones |

**Puntaje de una sesión (0 a 100):** 70 × la fracción de piezas colocadas, más 30 × la precisión (colocadas / (colocadas + errores)), menos 3 por cada pista. Está en `app/metrics.py`.

## Configuración (variables de entorno)

| Variable | Por defecto |
|---|---|
| `XRLAB_MODELS_DIR` | `../models` |
| `XRLAB_DB_PATH` | `data/xrlab.db` |
| `XRLAB_INVENTORY_PATH` | `data/inventory.json` |
| `XRLAB_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` |
| `XRLAB_API_KEY` | Sin definir. Si se define, los POST de telemetría exigen la cabecera `X-API-Key` |

El contrato de datos está en `app/schemas.py`. Si cambia, hay que actualizar también el tablero (`web-dashboard/src/api/types.ts`) y el cliente VR (`TelemetryModels.cs`).
