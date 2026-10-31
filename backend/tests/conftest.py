from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import RAIZ_REPO, Settings
from app.main import create_app


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        models_dir=RAIZ_REPO / "models",
        db_path=tmp_path / "prueba.db",
        inventory_path=RAIZ_REPO / "backend" / "data" / "inventory.json",
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture
def informe() -> dict[str, object]:
    """Sesión terminada: 10 piezas, 8 colocadas, 3 errores, 1 pista; 4 minutos."""
    inicio = datetime(2026, 10, 30, 14, 0, tzinfo=UTC)
    return {
        "session_id": "ses-0001-abcd",
        "student_id": "alu-07",
        "scenario": "motor",
        "device": "quest3",
        "interaction": "hands",
        "started_at": inicio.isoformat(),
        "ended_at": (inicio + timedelta(minutes=4)).isoformat(),
        "parts_total": 10,
        "parts_placed": 8,
        "assembly_errors": 3,
        "hints_used": 1,
        "events": [
            {"t": 0.0, "type": "session_start"},
            {"t": 3.2, "type": "explode"},
            {"t": 10.5, "type": "grab", "part": "Part_Rotor"},
            {"t": 14.1, "type": "snap_fail", "part": "Part_Rotor", "target": "Snap_Acople", "detail": "fuera de tolerancia"},
            {"t": 18.9, "type": "snap_ok", "part": "Part_Rotor", "target": "Snap_Rotor"},
            {"t": 240.0, "type": "session_end"},
        ],
    }
