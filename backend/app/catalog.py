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


LABORATORIO = ("laboratorio", "Laboratorio")


def _leer(path: Path) -> dict | None:
    if not path.is_file():
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _activo(a: dict, models_dir: Path, url_base: str, coleccion: tuple[str, str]) -> ModelAsset:
    archivos = {k: v for k, v in a["archivos"].items() if v}
    disponible = all((models_dir / rel).is_file() for rel in archivos.values())
    return ModelAsset(
        id=a["id"],
        collection=coleccion[0],
        collection_name=coleccion[1],
        source=a.get("origen"),
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
        mass_kg=a.get("masa_kg"),
        parts=[
            ModelPart(
                node=p["nodo"],
                name=p["nombre"],
                material=p["material"],
                mass_kg=p.get("masa_kg"),
                explode_offset=p["explotar"],
                parent=p.get("padre"),
            )
            for p in a["piezas"]
        ],
        snap_points=[
            SnapPoint(node=e["nodo"], accepts=e["acepta"], tolerance_m=e["tolerancia_m"], position=e["posicion"]) for e in a["encajes"]
        ],
    )


def cargar_manifest(models_dir: Path, url_base: str = "/models") -> ModelManifest:
    """
    Junta los dos manifests de /models y los pasa al contrato de la API (nombres en inglés, URLs servidas por el backend
    y si cada archivo está disponible):

    - models/manifest.json: los modelos del laboratorio (models/tools/generar_modelos.py);
    - models/proyectos/manifest.json: los de los otros proyectos (models/tools/importar_proyectos.py), agrupados por
      proyecto.
    """
    base = _leer(models_dir / "manifest.json")
    proyectos = _leer(models_dir / "proyectos" / "manifest.json")
    if base is None and proyectos is None:
        return ModelManifest(version=0, units="metros", axes="glTF (Y arriba)", assets=[])
    colecciones: dict[str, str] = {}
    activos: list[ModelAsset] = []
    if base is not None:
        colecciones[LABORATORIO[0]] = LABORATORIO[1]
        activos += [_activo(a, models_dir, url_base, LABORATORIO) for a in base.get("activos", [])]
    if proyectos is not None:
        nombres: dict[str, str] = proyectos.get("proyectos", {})
        colecciones.update(nombres)
        for a in proyectos.get("activos", []):
            clave = a["proyecto"]
            activos.append(_activo(a, models_dir, url_base, (clave, nombres.get(clave, clave))))
    ids = [a.id for a in activos]
    if len(ids) != len(set(ids)):
        raise ValueError("Hay ids de modelos repetidos entre los manifests")
    meta = base or proyectos or {}
    return ModelManifest(
        version=meta.get("version", 1),
        units=meta.get("unidades", "metros"),
        axes=meta.get("ejes", ""),
        collections=colecciones,
        assets=activos,
    )
