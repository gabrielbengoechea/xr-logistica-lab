"""Exporta los datos de la API como archivos para el sitio estático del tablero (GitHub Pages).

Uso (desde la raíz del repositorio, después de `npm run build` en web-dashboard):

    python3 backend/tools/exportar_sitio.py web-dashboard/dist

Escribe en el destino:

- `datos/manifest.json`: la misma respuesta de `GET /api/v1/models/manifest`;
- `datos/inventario.json` y `datos/inventario-<zona>.json`: `GET /api/v1/inventory`, completo y por zona;
- `models/...`: los archivos que nombra el manifest (glb, usdz, fbx y blend).

Usa la app real con TestClient, así el sitio muestra exactamente lo que serviría el backend.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tempfile
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402


def slug_zona(zona: str) -> str:
    """Igual que `slugZona` de web-dashboard/src/lib/api.ts: "Pañol" → "panol"."""
    sin_tildes = "".join(c for c in unicodedata.normalize("NFD", zona) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", sin_tildes.lower()).strip("-")


def escribir(destino: Path, datos: object) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def exportar(destino: Path) -> tuple[int, int]:
    """Devuelve (activos, bytes de modelos copiados)."""
    with tempfile.TemporaryDirectory() as tmp:
        settings = Settings(db_path=Path(tmp) / "exportar.db")
        with TestClient(create_app(settings)) as cliente:
            manifest = cliente.get("/api/v1/models/manifest").json()
            inventario = cliente.get("/api/v1/inventory").json()
            por_zona = {z: cliente.get("/api/v1/inventory", params={"zone": z}).json() for z in inventario["zones"]}

    escribir(destino / "datos" / "manifest.json", manifest)
    escribir(destino / "datos" / "inventario.json", inventario)
    for zona, datos in por_zona.items():
        escribir(destino / "datos" / f"inventario-{slug_zona(zona)}.json", datos)

    copiados = 0
    for activo in manifest["assets"]:
        for url in activo["urls"].values():
            if not url:
                continue
            relativo = url.removeprefix("/models/")
            origen = settings.models_dir / relativo
            final = destino / "models" / relativo
            final.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(origen, final)
            copiados += final.stat().st_size
    # GitHub Pages no tiene que procesar el sitio con Jekyll.
    (destino / ".nojekyll").write_text("", encoding="utf-8")
    return len(manifest["assets"]), copiados


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("destino", type=Path, help="Carpeta del sitio compilado (web-dashboard/dist)")
    args = parser.parse_args()
    activos, copiados = exportar(args.destino)
    print(f"{activos} activos y {copiados / 1e6:.1f} MB de modelos en {args.destino}")


if __name__ == "__main__":
    main()
