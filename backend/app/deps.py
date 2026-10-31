"""Dependencias compartidas: todo vive en `app.state` (se arma en `create_app`)."""

from __future__ import annotations

from fastapi import Header, HTTPException, Request, status

from .config import Settings
from .db import TelemetryStore
from .live import LiveHub
from .schemas import InventoryItem


def settings(request: Request) -> Settings:
    return request.app.state.settings


def store(request: Request) -> TelemetryStore:
    return request.app.state.store


def hub(request: Request) -> LiveHub:
    return request.app.state.hub


def inventory(request: Request) -> list[InventoryItem]:
    return request.app.state.inventory


def require_api_key(request: Request, x_api_key: str | None = Header(default=None)) -> None:
    """Si XRLAB_API_KEY está definida, las escrituras de telemetría la exigen en X-API-Key."""
    esperada = request.app.state.settings.api_key
    if esperada and x_api_key != esperada:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta o es incorrecta la cabecera X-API-Key")
