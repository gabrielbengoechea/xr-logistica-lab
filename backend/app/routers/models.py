from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from .. import deps
from ..catalog import cargar_manifest
from ..config import Settings
from ..schemas import ModelAsset, ModelManifest

router = APIRouter(prefix="/api/v1/models", tags=["Modelos 3D"])


@router.get("/manifest", response_model=ModelManifest, summary="Manifest con rutas a los modelos 3D de /models")
def manifest(cfg: Annotated[Settings, Depends(deps.settings)]) -> ModelManifest:
    # Se lee en cada pedido: si se regeneran los modelos, el manifest nuevo se ve sin reiniciar.
    return cargar_manifest(cfg.models_dir)


@router.get("/{model_id}", response_model=ModelAsset, summary="Un activo del manifest")
def model(model_id: str, cfg: Annotated[Settings, Depends(deps.settings)]) -> ModelAsset:
    for a in cargar_manifest(cfg.models_dir).assets:
        if a.id == model_id:
            return a
    raise HTTPException(status_code=404, detail=f"No existe el modelo {model_id}")
