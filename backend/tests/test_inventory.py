from fastapi.testclient import TestClient


def test_lista_completa_con_coordenadas(client: TestClient) -> None:
    r = client.get("/api/v1/inventory")
    assert r.status_code == 200
    datos = r.json()
    assert datos["total"] == len(datos["items"]) == 8
    for item in datos["items"]:
        assert len(item["location"]["position"]) == 3
        assert item["quantity"] >= 0
    assert "A-Racks" in datos["zones"]


def test_filtros(client: TestClient) -> None:
    r = client.get("/api/v1/inventory", params={"zone": "Taller"})
    assert {i["id"] for i in r.json()["items"]} == {"mc-02", "mt-132"}
    r = client.get("/api/v1/inventory", params={"status": "maintenance"})
    assert [i["id"] for i in r.json()["items"]] == ["mc-02"]
    r = client.get("/api/v1/inventory", params={"model_id": "rack", "category": "Almacenamiento"})
    assert r.json()["total"] == 2
    assert client.get("/api/v1/inventory", params={"status": "roto"}).status_code == 422


def test_un_componente(client: TestClient) -> None:
    r = client.get("/api/v1/inventory/cs-1u")
    assert r.status_code == 200
    assert r.json()["model_id"] == "cubesat"
    assert client.get("/api/v1/inventory/no-existe").status_code == 404


def test_cada_componente_tiene_su_modelo(client: TestClient) -> None:
    modelos = {a["id"] for a in client.get("/api/v1/models/manifest").json()["assets"]}
    for item in client.get("/api/v1/inventory").json()["items"]:
        assert item["model_id"] in modelos, item["id"]
