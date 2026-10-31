from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, WebSocket, WebSocketDisconnect, status

from .. import deps
from ..db import TelemetryStore
from ..live import LiveHub
from ..metrics import resumen
from ..schemas import (
    LiveEvent,
    SessionCreated,
    SessionList,
    SessionRecord,
    SessionReport,
    TelemetryEvent,
    TelemetrySummary,
    WsMessage,
)

router = APIRouter(prefix="/api/v1/telemetry", tags=["Telemetría"])
ws_router = APIRouter(tags=["Telemetría"])

Store = Annotated[TelemetryStore, Depends(deps.store)]
Hub = Annotated[LiveHub, Depends(deps.hub)]


@router.post(
    "/session",
    response_model=SessionCreated,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(deps.require_api_key)],
    summary="Registra (o actualiza) una sesión VR: tiempos, errores de ensamblaje e interacciones",
    responses={200: {"description": "La sesión ya existía y se actualizó"}},
)
async def post_session(report: SessionReport, response: Response, store: Store, hub: Hub) -> SessionCreated:
    registro, creada = store.upsert(report)
    if not creada:
        response.status_code = status.HTTP_200_OK
    await hub.broadcast(WsMessage(kind="session_saved", data=registro.model_dump(mode="json")))
    return SessionCreated(session=registro, created=creada)


@router.post(
    "/event",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(deps.require_api_key)],
    summary="Evento suelto durante la sesión: se reenvía en vivo a los tableros (no se guarda)",
)
async def post_event(evento: LiveEvent, hub: Hub) -> dict[str, int]:
    llegaron = await hub.broadcast(WsMessage(kind="live_event", data=evento.model_dump(mode="json")))
    return {"delivered": llegaron}


@router.get("/sessions", response_model=SessionList, summary="Sesiones registradas (las más recientes primero)")
def list_sessions(
    store: Store,
    student_id: Annotated[str | None, Query()] = None,
    scenario: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 200,
) -> SessionList:
    sesiones = store.list(student_id=student_id, scenario=scenario, limit=limit)
    return SessionList(sessions=sesiones, total=len(sesiones))


@router.get("/sessions/{session_id}", response_model=SessionRecord)
def get_session(session_id: str, store: Store) -> SessionRecord:
    s = store.get(session_id)
    if s is None:
        raise HTTPException(status_code=404, detail=f"No existe la sesión {session_id}")
    return s


@router.get("/sessions/{session_id}/events", response_model=list[TelemetryEvent])
def get_events(session_id: str, store: Store) -> list[TelemetryEvent]:
    eventos = store.events(session_id)
    if eventos is None:
        raise HTTPException(status_code=404, detail=f"No existe la sesión {session_id}")
    return eventos


@router.get("/summary", response_model=TelemetrySummary, summary="Métricas agregadas por escenario y por alumno")
def summary(store: Store) -> TelemetrySummary:
    return resumen(store.list(limit=10_000))


@ws_router.websocket("/ws/telemetry")
async def telemetry_ws(ws: WebSocket) -> None:
    """Tablero en vivo: al conectar recibe `hello` con el resumen; después `session_saved` y `live_event`."""
    hub: LiveHub = ws.app.state.hub
    store: TelemetryStore = ws.app.state.store
    await hub.connect(ws)
    try:
        await hub.send(ws, WsMessage(kind="hello", data=resumen(store.list(limit=10_000)).model_dump(mode="json")))
        while True:
            # El tablero no manda nada útil; se lee para detectar el cierre (y responder "ping" si lo manda).
            texto = await ws.receive_text()
            if texto == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(ws)
