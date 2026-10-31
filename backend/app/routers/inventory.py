from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from .. import deps
from ..schemas import ComponentStatus, InventoryItem, InventoryResponse

router = APIRouter(prefix="/api/v1/inventory", tags=["Inventario"])


@router.get("", response_model=InventoryResponse, summary="Componentes logísticos y sus coordenadas")
def list_inventory(
    items: Annotated[list[InventoryItem], Depends(deps.inventory)],
    category: Annotated[str | None, Query(description="Filtra por categoría exacta")] = None,
    zone: Annotated[str | None, Query(description="Filtra por zona del depósito")] = None,
    status: Annotated[ComponentStatus | None, Query()] = None,
    model_id: Annotated[str | None, Query(description="Filtra por activo 3D")] = None,
) -> InventoryResponse:
    filtrados = [
        i
        for i in items
        if (category is None or i.category == category)
        and (zone is None or i.location.zone == zone)
        and (status is None or i.status == status)
        and (model_id is None or i.model_id == model_id)
    ]
    return InventoryResponse(items=filtrados, total=len(filtrados), zones=sorted({i.location.zone for i in items}))


@router.get("/{item_id}", response_model=InventoryItem, summary="Un componente por id")
def get_item(item_id: str, items: Annotated[list[InventoryItem], Depends(deps.inventory)]) -> InventoryItem:
    for i in items:
        if i.id == item_id:
            return i
    raise HTTPException(status_code=404, detail=f"No existe el componente {item_id}")
