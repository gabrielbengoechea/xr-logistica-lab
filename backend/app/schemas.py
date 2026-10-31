"""
Contrato de datos de la API (fuente de verdad). Si cambia un campo, actualizar también
web-dashboard/src/api/types.ts y vr-client/Assets/Scripts/Telemetry/TelemetryModels.cs.

Los nombres de campo van en inglés (snake_case) para que el contrato sea estable entre Python, TypeScript y C#.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Vec3 = Annotated[list[float], Field(min_length=3, max_length=3)]


# ---------------------------------------------------------------------------------------------------------------------
# Inventario
# ---------------------------------------------------------------------------------------------------------------------
class ComponentStatus(str, Enum):
    available = "available"
    in_use = "in_use"
    maintenance = "maintenance"


class Location(BaseModel):
    """Ubicación en el depósito virtual (metros, ejes de Unity/glTF: y arriba)."""

    zone: str = Field(description="Zona del depósito, p. ej. 'A-Racks'")
    position: Vec3
    rotation_y_deg: float = Field(default=0.0, ge=-360, le=360)


class InventoryItem(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    model_id: str = Field(description="Id del activo en models/manifest.json")
    name: str
    category: str
    sku: str
    quantity: int = Field(ge=0)
    status: ComponentStatus = ComponentStatus.available
    location: Location


class InventoryResponse(BaseModel):
    items: list[InventoryItem]
    total: int
    zones: list[str]


# ---------------------------------------------------------------------------------------------------------------------
# Manifest de modelos
# ---------------------------------------------------------------------------------------------------------------------
class ModelPart(BaseModel):
    node: str
    name: str
    material: str
    mass_kg: float
    explode_offset: Vec3
    parent: str | None = None


class SnapPoint(BaseModel):
    node: str
    accepts: str
    tolerance_m: float
    position: Vec3


class ModelFiles(BaseModel):
    glb: str
    fbx: str
    blend: str


class ModelAsset(BaseModel):
    id: str
    root_node: str
    name: str
    category: str
    description: str
    files: ModelFiles = Field(description="Rutas relativas a /models")
    urls: ModelFiles = Field(description="URLs servidas por este backend")
    sizes_bytes: dict[str, int]
    available: bool = Field(description="Los tres archivos existen en el servidor")
    dimensions_m: Vec3
    triangles: int
    mass_kg: float
    parts: list[ModelPart]
    snap_points: list[SnapPoint]


class ModelManifest(BaseModel):
    version: int
    units: str
    axes: str
    assets: list[ModelAsset]


# ---------------------------------------------------------------------------------------------------------------------
# Telemetría
# ---------------------------------------------------------------------------------------------------------------------
class DeviceType(str, Enum):
    quest3 = "quest3"
    quest2 = "quest2"
    editor = "editor"
    web = "web"


class EventType(str, Enum):
    session_start = "session_start"
    grab = "grab"
    release = "release"
    snap_ok = "snap_ok"
    snap_fail = "snap_fail"
    explode = "explode"
    assemble = "assemble"
    hint = "hint"
    session_end = "session_end"


class InteractionMode(str, Enum):
    hands = "hands"
    controllers = "controllers"
    mouse = "mouse"


class TelemetryEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    t: float = Field(ge=0, description="Segundos desde el inicio de la sesión")
    type: EventType
    part: str | None = Field(default=None, max_length=120)
    target: str | None = Field(default=None, max_length=120, description="Encaje involucrado, si lo hay")
    detail: str | None = Field(default=None, max_length=500)


class SessionReport(BaseModel):
    """Lo que manda el visor al terminar (o periódicamente durante) una sesión. Reenviar el mismo `session_id` la actualiza."""

    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    student_id: str = Field(min_length=1, max_length=64)
    scenario: str = Field(description="Id del activo practicado (models/manifest.json)", min_length=1, max_length=64)
    device: DeviceType
    interaction: InteractionMode = InteractionMode.hands
    started_at: datetime
    ended_at: datetime | None = None
    parts_total: int = Field(ge=0, description="Piezas que había que encajar")
    parts_placed: int = Field(ge=0)
    assembly_errors: int = Field(ge=0, description="Intentos de encaje fallidos (pieza equivocada o fuera de tolerancia)")
    hints_used: int = Field(default=0, ge=0)
    events: list[TelemetryEvent] = Field(default_factory=list, max_length=5000)

    @model_validator(mode="after")
    def coherente(self) -> SessionReport:
        if self.parts_placed > self.parts_total:
            raise ValueError("parts_placed no puede superar parts_total")
        if self.ended_at is not None and self.ended_at < self.started_at:
            raise ValueError("ended_at es anterior a started_at")
        tiempos = [e.t for e in self.events]
        if tiempos != sorted(tiempos):
            raise ValueError("los eventos tienen que venir en orden de tiempo")
        return self


class SessionMetrics(BaseModel):
    duration_s: float | None
    completion: float = Field(ge=0, le=1)
    error_rate: float = Field(ge=0, description="Errores por pieza colocada; 1 si hubo errores sin colocar ninguna")
    grabs: int
    snaps_ok: int
    snaps_failed: int
    explode_toggles: int
    score: int = Field(ge=0, le=100)


class SessionRecord(BaseModel):
    session_id: str
    student_id: str
    scenario: str
    device: DeviceType
    interaction: InteractionMode
    started_at: datetime
    ended_at: datetime | None
    parts_total: int
    parts_placed: int
    assembly_errors: int
    hints_used: int
    finished: bool
    metrics: SessionMetrics
    received_at: datetime


class SessionCreated(BaseModel):
    session: SessionRecord
    created: bool


class SessionList(BaseModel):
    sessions: list[SessionRecord]
    total: int


class LiveEvent(BaseModel):
    """Evento suelto enviado durante la sesión, para que el docente lo vea al instante."""

    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    student_id: str = Field(min_length=1, max_length=64)
    scenario: str = Field(min_length=1, max_length=64)
    event: TelemetryEvent


class ScenarioSummary(BaseModel):
    scenario: str
    sessions: int
    finished: int
    avg_duration_s: float | None
    avg_errors: float
    avg_score: float
    best_score: int


class StudentSummary(BaseModel):
    student_id: str
    sessions: int
    avg_score: float
    total_errors: int
    last_seen: datetime


class TelemetrySummary(BaseModel):
    sessions: int
    students: int
    avg_score: float
    total_errors: int
    by_scenario: list[ScenarioSummary]
    by_student: list[StudentSummary]


class WsMessage(BaseModel):
    """Mensajes del WebSocket /ws/telemetry (servidor → tablero)."""

    kind: Literal["hello", "session_saved", "live_event"]
    data: dict[str, object]


class Health(BaseModel):
    status: Literal["ok"]
    version: str
    models_available: int
    sessions: int
