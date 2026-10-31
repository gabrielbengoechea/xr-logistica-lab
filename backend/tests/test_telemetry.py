from __future__ import annotations

import copy

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.metrics import puntaje


def test_registra_sesion_y_calcula_metricas(client: TestClient, informe: dict) -> None:
    r = client.post("/api/v1/telemetry/session", json=informe)
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["created"] is True
    s = cuerpo["session"]
    assert s["finished"] is True
    m = s["metrics"]
    assert m["duration_s"] == 240.0
    assert m["completion"] == 0.8
    assert m["error_rate"] == 0.375
    assert (m["grabs"], m["snaps_ok"], m["snaps_failed"], m["explode_toggles"]) == (1, 1, 1, 1)
    # 70·0,8 + 30·8/11 − 3 = 56 + 21,8 − 3 = 74,8 → 75
    assert m["score"] == 75


def test_reenviar_actualiza(client: TestClient, informe: dict) -> None:
    client.post("/api/v1/telemetry/session", json=informe)
    otra = copy.deepcopy(informe)
    otra["parts_placed"] = 10
    r = client.post("/api/v1/telemetry/session", json=otra)
    assert r.status_code == 200
    assert r.json()["created"] is False
    assert client.get("/api/v1/telemetry/sessions").json()["total"] == 1
    assert client.get(f"/api/v1/telemetry/sessions/{informe['session_id']}").json()["parts_placed"] == 10


@pytest.mark.parametrize(
    ("campo", "valor"),
    [
        ("parts_placed", 11),
        ("assembly_errors", -1),
        ("device", "vive"),
        ("ended_at", "2026-10-30T13:00:00+00:00"),
        ("session_id", "corto"),
        ("extra", 1),
    ],
)
def test_validacion(client: TestClient, informe: dict, campo: str, valor: object) -> None:
    malo = copy.deepcopy(informe)
    malo[campo] = valor
    assert client.post("/api/v1/telemetry/session", json=malo).status_code == 422


def test_eventos_desordenados(client: TestClient, informe: dict) -> None:
    malo = copy.deepcopy(informe)
    malo["events"] = list(reversed(malo["events"]))
    r = client.post("/api/v1/telemetry/session", json=malo)
    assert r.status_code == 422
    assert "orden" in r.text


def test_eventos_y_listado_filtrado(client: TestClient, informe: dict) -> None:
    client.post("/api/v1/telemetry/session", json=informe)
    otro = copy.deepcopy(informe) | {"session_id": "ses-0002-abcd", "student_id": "alu-08", "scenario": "cubesat", "ended_at": None}
    client.post("/api/v1/telemetry/session", json=otro)
    assert client.get("/api/v1/telemetry/sessions", params={"scenario": "cubesat"}).json()["total"] == 1
    assert client.get("/api/v1/telemetry/sessions", params={"student_id": "alu-07"}).json()["sessions"][0]["scenario"] == "motor"
    eventos = client.get(f"/api/v1/telemetry/sessions/{informe['session_id']}/events").json()
    assert [e["type"] for e in eventos][:3] == ["session_start", "explode", "grab"]
    assert client.get("/api/v1/telemetry/sessions/no-existe-123/events").status_code == 404
    abierta = client.get("/api/v1/telemetry/sessions/ses-0002-abcd").json()
    assert abierta["finished"] is False
    assert abierta["metrics"]["duration_s"] == 240.0  # sin fin: último evento


def test_resumen(client: TestClient, informe: dict) -> None:
    vacio = client.get("/api/v1/telemetry/summary").json()
    assert vacio["sessions"] == 0 and vacio["by_scenario"] == []
    client.post("/api/v1/telemetry/session", json=informe)
    perfecta = copy.deepcopy(informe) | {
        "session_id": "ses-0003-abcd",
        "student_id": "alu-09",
        "parts_placed": 10,
        "assembly_errors": 0,
        "hints_used": 0,
    }
    client.post("/api/v1/telemetry/session", json=perfecta)
    r = client.get("/api/v1/telemetry/summary").json()
    assert r["sessions"] == 2 and r["students"] == 2
    motor = r["by_scenario"][0]
    assert motor["scenario"] == "motor" and motor["best_score"] == 100 and motor["finished"] == 2
    assert motor["avg_score"] == 87.5
    assert [a["student_id"] for a in r["by_student"]] == ["alu-09", "alu-07"]


def test_puntaje_limites() -> None:
    assert puntaje(10, 10, 0, 0) == 100
    assert puntaje(0, 0, 0, 0) == 0
    assert puntaje(10, 0, 5, 0) == 0
    assert puntaje(10, 10, 0, 50) == 0


def test_api_key(settings: Settings, informe: dict) -> None:
    with TestClient(create_app(settings.model_copy(update={"api_key": "secreta"}))) as c:
        assert c.post("/api/v1/telemetry/session", json=informe).status_code == 401
        assert c.post("/api/v1/telemetry/session", json=informe, headers={"X-API-Key": "secreta"}).status_code == 201
        assert c.get("/api/v1/telemetry/sessions").status_code == 200  # la lectura no la exige


def test_persistencia_entre_reinicios(settings: Settings, informe: dict) -> None:
    with TestClient(create_app(settings)) as c:
        c.post("/api/v1/telemetry/session", json=informe)
    with TestClient(create_app(settings)) as c:
        assert c.get("/api/v1/health").json()["sessions"] == 1
