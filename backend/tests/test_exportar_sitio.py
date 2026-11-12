import importlib.util
import json
from pathlib import Path

RUTA = Path(__file__).resolve().parents[1] / "tools" / "exportar_sitio.py"
spec = importlib.util.spec_from_file_location("exportar_sitio", RUTA)
assert spec and spec.loader
exportar_sitio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exportar_sitio)


def test_slug_igual_que_el_tablero() -> None:
    assert exportar_sitio.slug_zona("Pañol") == "panol"
    assert exportar_sitio.slug_zona("Laboratorio espacial") == "laboratorio-espacial"
    assert exportar_sitio.slug_zona("A-Racks") == "a-racks"


def test_exporta_datos_y_modelos(tmp_path: Path) -> None:
    activos, copiados = exportar_sitio.exportar(tmp_path)
    manifest = json.loads((tmp_path / "datos" / "manifest.json").read_text(encoding="utf-8"))
    assert activos == len(manifest["assets"]) == 15
    assert copiados > 0
    for activo in manifest["assets"]:
        assert (tmp_path / activo["urls"]["glb"].removeprefix("/")).is_file()
    inventario = json.loads((tmp_path / "datos" / "inventario.json").read_text(encoding="utf-8"))
    for zona in inventario["zones"]:
        por_zona = json.loads((tmp_path / "datos" / f"inventario-{exportar_sitio.slug_zona(zona)}.json").read_text(encoding="utf-8"))
        assert all(i["location"]["zone"] == zona for i in por_zona["items"])
    assert (tmp_path / ".nojekyll").exists()
