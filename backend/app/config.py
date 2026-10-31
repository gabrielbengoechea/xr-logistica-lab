"""Configuración por variables de entorno (con valores por defecto para desarrollo)."""

from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field

RAIZ_REPO = Path(__file__).resolve().parents[2]


class Settings(BaseModel):
    """Parámetros del servidor. Se leen una vez al crear la app (ver `Settings.from_env`)."""

    models_dir: Path = Field(default=RAIZ_REPO / "models", description="Carpeta /models del repositorio")
    db_path: Path = Field(default=RAIZ_REPO / "backend" / "data" / "xrlab.db", description="Base SQLite de telemetría")
    inventory_path: Path = Field(default=RAIZ_REPO / "backend" / "data" / "inventory.json", description="Inventario inicial")
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])
    api_key: str | None = Field(default=None, description="Si se define, POST de telemetría exige la cabecera X-API-Key")

    @classmethod
    def from_env(cls) -> Settings:
        valores: dict[str, object] = {}
        if v := os.getenv("XRLAB_MODELS_DIR"):
            valores["models_dir"] = Path(v)
        if v := os.getenv("XRLAB_DB_PATH"):
            valores["db_path"] = Path(v)
        if v := os.getenv("XRLAB_INVENTORY_PATH"):
            valores["inventory_path"] = Path(v)
        if v := os.getenv("XRLAB_CORS_ORIGINS"):
            valores["cors_origins"] = [o.strip() for o in v.split(",") if o.strip()]
        if v := os.getenv("XRLAB_API_KEY"):
            valores["api_key"] = v
        return cls(**valores)
