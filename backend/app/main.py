"""Aplicación FastAPI: `uvicorn app.main:app --reload --port 8000` (documentación en /docs)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import __version__
from .catalog import cargar_inventario, cargar_manifest
from .config import Settings
from .db import TelemetryStore
from .live import LiveHub
from .routers import inventory, models, telemetry
from .schemas import Health


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.store = TelemetryStore(cfg.db_path)
        try:
            yield
        finally:
            app.state.store.close()

    app = FastAPI(
        title="XR Logística Lab API",
        version=__version__,
        description="Inventario del depósito virtual, telemetría de sesiones en Meta Quest y manifest de modelos 3D.",
        lifespan=lifespan,
    )
    app.state.settings = cfg
    app.state.hub = LiveHub()
    app.state.inventory = cargar_inventario(cfg.inventory_path)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-API-Key"],
    )
    app.include_router(inventory.router)
    app.include_router(models.router)
    app.include_router(telemetry.router)
    app.include_router(telemetry.ws_router)

    @app.get("/api/v1/health", response_model=Health, tags=["Sistema"])
    def health() -> Health:
        disponibles = sum(1 for a in cargar_manifest(cfg.models_dir).assets if a.available)
        return Health(status="ok", version=__version__, models_available=disponibles, sessions=app.state.store.count())

    # Archivos 3D (.glb, .fbx, .blend y manifest.json) servidos tal cual desde /models
    if cfg.models_dir.is_dir():
        app.mount("/models", StaticFiles(directory=cfg.models_dir), name="models")
    return app


app = create_app()
