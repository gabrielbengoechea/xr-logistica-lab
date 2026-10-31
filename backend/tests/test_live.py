from fastapi.testclient import TestClient


def test_websocket_recibe_hola_sesiones_y_eventos(client: TestClient, informe: dict) -> None:
    with client.websocket_connect("/ws/telemetry") as ws:
        hola = ws.receive_json()
        assert hola["kind"] == "hello" and hola["data"]["sessions"] == 0

        client.post("/api/v1/telemetry/session", json=informe)
        guardada = ws.receive_json()
        assert guardada["kind"] == "session_saved"
        assert guardada["data"]["session_id"] == informe["session_id"]
        assert guardada["data"]["metrics"]["score"] == 75

        r = client.post(
            "/api/v1/telemetry/event",
            json={
                "session_id": "ses-0001-abcd",
                "student_id": "alu-07",
                "scenario": "motor",
                "event": {"t": 20.0, "type": "snap_ok", "part": "Part_Ventilador", "target": "Snap_Ventilador"},
            },
        )
        assert r.status_code == 202 and r.json()["delivered"] == 1
        vivo = ws.receive_json()
        assert vivo["kind"] == "live_event" and vivo["data"]["event"]["part"] == "Part_Ventilador"

        ws.send_text("ping")
        assert ws.receive_text() == "pong"


def test_evento_sin_tableros(client: TestClient) -> None:
    r = client.post(
        "/api/v1/telemetry/event",
        json={"session_id": "ses-0001-abcd", "student_id": "a", "scenario": "motor", "event": {"t": 1, "type": "grab"}},
    )
    assert r.json() == {"delivered": 0}


def test_health(client: TestClient) -> None:
    h = client.get("/api/v1/health").json()
    # 6 del laboratorio + 9 de los otros proyectos (models/proyectos)
    assert h == {"status": "ok", "version": "0.1.0", "models_available": 15, "sessions": 0}
