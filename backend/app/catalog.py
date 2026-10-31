"""Lectura del inventario inicial y del manifest de modelos (archivos JSON del repositorio)."""

from __future__ import annotations

import json
from pathlib import Path

from .schemas import InventoryItem, ModelAsset, ModelFiles, ModelManifest, ModelPart, SnapPoint


def cargar_inventario(path: Path) -> list[InventoryItem]:
    with path.open(encoding="utf-8") as f:
        datos = json.load(f)
    items = [InventoryItem.model_validate(i) for i in datos["items"]]
    ids = [i.id for i in items]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{path}: hay ids de inventario repetidos")
    return items


def cargar_manifest(models_dir: Path, url_base: str = "/models") -> ModelManifest:
    """
    Lee models/manifest.json (escrito por models/tools/generar_modelos.py) y lo pasa al contrato de la API:
    nombres de campo en inglés, URLs servidas por el backend y si cada archivo está disponible.
    """
    path = models_dir / "manifest.json"
    if not path.is_file():
        return ModelManifest(version=0, units="metros", axes="glTF (Y arriba)", assets=[])
    with path.open(encoding="utf-8") as f:
        crudo = json.load(f)
    activos = []
    for a in crudo.get("activos", []):
        archivos = a["archivos"]
        disponible = all((models_dir / rel).is_file() for rel in archivos.values())
        activos.append(
            ModelAsset(
                id=a["id"],
                root_node=a["nodo_raiz"],
                name=a["nombre"],
                category=a["categoria"],
                description=a["descripcion"],
                files=ModelFiles(**archivos),
                urls=ModelFiles(**{k: f"{url_base.rstrip('/')}/{v}" for k, v in archivos.items()}),
                sizes_bytes=a.get("bytes", {}),
                available=disponible,
                dimensions_m=a["medidas_m"],
                triangles=a["triangulos"],
                mass_kg=a["masa_kg"],
                parts=[
                    ModelPart(
                        node=p["nodo"],
                        name=p["nombre"],
                        material=p["material"],
                        mass_kg=p["masa_kg"],
                        explode_offset=p["explotar"],
                        parent=p.get("padre"),
                    )
                    for p in a["piezas"]
                ],
                snap_points=[
                    SnapPoint(node=e["nodo"], accepts=e["acepta"], tolerance_m=e["tolerancia_m"], position=e["posicion"])
                    for e in a["encajes"]
                ],
            )
        )
    return ModelManifest(version=crudo.get("version", 1), units=crudo.get("unidades", "metros"), axes=crudo.get("ejes", ""), assets=activos)
