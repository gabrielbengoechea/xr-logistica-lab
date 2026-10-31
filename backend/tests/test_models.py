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
    for a in (x for x in m["assets"] if x["collection"] == "laboratorio"):
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


def test_modelos_de_los_proyectos_agrupados(client: TestClient) -> None:
    m = client.get("/api/v1/models/manifest").json()
    assert list(m["collections"]) == ["laboratorio", "puerto", "autoelevador", "atlas", "robot"]
    por_coleccion: dict[str, list[dict]] = {}
    for a in m["assets"]:
        por_coleccion.setdefault(a["collection"], []).append(a)
    assert {a["id"] for a in por_coleccion["puerto"]} >= {"puerto-sts", "puerto-rtg", "puerto-buque", "puerto-contenedor-40"}
    robot = client.get("/api/v1/models/robot-6-ejes").json()
    assert robot["collection_name"] == "Brazo robótico (RA)"
    assert robot["available"] is True
    assert robot["urls"]["glb"] == "/models/proyectos/robot/robot-6-ejes.glb"
    assert robot["urls"]["usdz"].endswith(".usdz")
    assert robot["files"]["fbx"] is None
    assert robot["mass_kg"] is None
    assert [p["node"] for p in robot["parts"]][:2] == ["Shoulder_Joint", "Upper_Arm"]
    assert robot["parts"][1]["parent"] == "Shoulder_Joint"
    contenedor = client.get("/api/v1/models/puerto-contenedor-40").json()
    assert len(contenedor["snap_points"]) == 4
    assert client.get(robot["urls"]["usdz"]).status_code == 200


def test_solo_proyectos_o_ids_repetidos(tmp_path: Path, settings: Settings) -> None:
    proyectos = json.loads((settings.models_dir / "proyectos" / "manifest.json").read_text(encoding="utf-8"))
    (tmp_path / "proyectos").mkdir()
    (tmp_path / "proyectos" / "manifest.json").write_text(json.dumps(proyectos), encoding="utf-8")
    from app.catalog import cargar_manifest

    m = cargar_manifest(tmp_path)
    assert "laboratorio" not in m.collections
    assert m.assets and all(a.available is False for a in m.assets)  # los archivos no están en tmp_path
    base = json.loads((settings.models_dir / "manifest.json").read_text(encoding="utf-8"))
    base["activos"][0]["id"] = proyectos["activos"][0]["id"]
    (tmp_path / "manifest.json").write_text(json.dumps(base), encoding="utf-8")
    try:
        cargar_manifest(tmp_path)
    except ValueError as e:
        assert "repetidos" in str(e)
    else:
        raise AssertionError("se esperaba un error por id repetido")
