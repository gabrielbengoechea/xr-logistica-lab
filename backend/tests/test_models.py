import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_manifest_con_rutas_y_piezas(client: TestClient) -> None:
    r = client.get("/api/v1/models/manifest")
    assert r.status_code == 200
    m = r.json()
    ids = {a["id"] for a in m["assets"]}
    assert {"forklift", "pallet", "rack", "sensor", "motor", "cubesat"} <= ids
    for a in m["assets"]:
        assert a["available"] is True
        assert a["urls"]["glb"] == f"/models/glb/{a['id']}.glb"
        assert a["files"]["fbx"].endswith(".fbx")
        assert a["parts"], a["id"]
        assert all(len(p["explode_offset"]) == 3 for p in a["parts"])
        assert a["triangles"] > 0


def test_los_archivos_se_sirven(client: TestClient) -> None:
    url = client.get("/api/v1/models/forklift").json()["urls"]["glb"]
    r = client.get(url)
    assert r.status_code == 200
    assert r.content[:4] == b"glTF"


def test_un_modelo_y_encajes(client: TestClient) -> None:
    rack = client.get("/api/v1/models/rack").json()
    assert len(rack["snap_points"]) == 12
    assert all(s["accepts"] == "pallet" for s in rack["snap_points"])
    assert client.get("/api/v1/models/nada").status_code == 404


def test_archivo_faltante_marca_no_disponible(tmp_path: Path, settings: Settings) -> None:
    origen = json.loads((settings.models_dir / "manifest.json").read_text(encoding="utf-8"))
    origen["activos"] = origen["activos"][:1]
    (tmp_path / "manifest.json").write_text(json.dumps(origen), encoding="utf-8")
    cfg = settings.model_copy(update={"models_dir": tmp_path})
    from fastapi.testclient import TestClient as TC

    with TC(create_app(cfg)) as c:
        a = c.get("/api/v1/models/manifest").json()["assets"]
        assert len(a) == 1 and a[0]["available"] is False
        assert c.get("/api/v1/health").json()["models_available"] == 0


def test_sin_manifest_devuelve_lista_vacia(tmp_path: Path, settings: Settings) -> None:
    cfg = settings.model_copy(update={"models_dir": tmp_path})
    with TestClient(create_app(cfg)) as c:
        assert c.get("/api/v1/models/manifest").json()["assets"] == []
