/**
 * Contrato de datos de la API: espejo de backend/app/schemas.py (la fuente de verdad).
 * Si cambia un campo allá, se actualiza acá y en vr-client/Assets/Scripts/Telemetry/TelemetryModels.cs en el mismo PR.
 */

export type Vec3 = [number, number, number]

// ---------------------------------------------------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------------------------------------------------
export type ComponentStatus = 'available' | 'in_use' | 'maintenance'

export interface Location {
  zone: string
  position: Vec3
  rotation_y_deg: number
}

export interface InventoryItem {
  id: string
  model_id: string
  name: string
  category: string
  sku: string
  quantity: number
  status: ComponentStatus
  location: Location
}

export interface InventoryResponse {
  items: InventoryItem[]
  total: number
  zones: string[]
}

// ---------------------------------------------------------------------------------------------------------------------
// Manifest de modelos
// ---------------------------------------------------------------------------------------------------------------------
export interface ModelPart {
  node: string
  name: string
  material: string
  /** Desconocida en los modelos importados de otros proyectos. */
  mass_kg: number | null
  explode_offset: Vec3
  parent: string | null
}

export interface SnapPoint {
  node: string
  accepts: string
  tolerance_m: number
  position: Vec3
}

export interface ModelFiles {
  glb: string
  fbx: string | null
  blend: string | null
  /** Para la RA del iPhone (Quick Look). */
  usdz: string | null
}

export interface ModelAsset {
  id: string
  /** «laboratorio» (generados en este repo) o el proyecto de origen: puerto, autoelevador, atlas, robot… */
  collection: string
  collection_name: string
  source: string | null
  root_node: string
  name: string
  category: string
  description: string
  files: ModelFiles
  urls: ModelFiles
  sizes_bytes: Record<string, number>
  available: boolean
  dimensions_m: Vec3
  triangles: number
  mass_kg: number | null
  parts: ModelPart[]
  snap_points: SnapPoint[]
}

export interface ModelManifest {
  version: number
  units: string
  axes: string
  /** Id de colección → nombre, en el orden en que se muestran. */
  collections: Record<string, string>
  assets: ModelAsset[]
}

// ---------------------------------------------------------------------------------------------------------------------
// Telemetría
// ---------------------------------------------------------------------------------------------------------------------
export type DeviceType = 'quest3' | 'quest2' | 'editor' | 'web'

export type EventType =
  | 'session_start'
  | 'grab'
  | 'release'
  | 'snap_ok'
  | 'snap_fail'
  | 'explode'
  | 'assemble'
  | 'hint'
  | 'session_end'

export type InteractionMode = 'hands' | 'controllers' | 'mouse'

export interface TelemetryEvent {
  t: number
  type: EventType
  part: string | null
  target: string | null
  detail: string | null
}

export interface SessionMetrics {
  duration_s: number | null
  completion: number
  error_rate: number
  grabs: number
  snaps_ok: number
  snaps_failed: number
  explode_toggles: number
  score: number
}

export interface SessionRecord {
  session_id: string
  student_id: string
  scenario: string
  device: DeviceType
  interaction: InteractionMode
  started_at: string
  ended_at: string | null
  parts_total: number
  parts_placed: number
  assembly_errors: number
  hints_used: number
  finished: boolean
  metrics: SessionMetrics
  received_at: string
}

export interface SessionList {
  sessions: SessionRecord[]
  total: number
}

export interface LiveEvent {
  session_id: string
  student_id: string
  scenario: string
  event: TelemetryEvent
}

export interface ScenarioSummary {
  scenario: string
  sessions: number
  finished: number
  avg_duration_s: number | null
  avg_errors: number
  avg_score: number
  best_score: number
}

export interface StudentSummary {
  student_id: string
  sessions: number
  avg_score: number
  total_errors: number
  last_seen: string
}

export interface TelemetrySummary {
  sessions: number
  students: number
  avg_score: number
  total_errors: number
  by_scenario: ScenarioSummary[]
  by_student: StudentSummary[]
}

/** Mensajes de /ws/telemetry (servidor → tablero). */
export type WsMessage =
  | { kind: 'hello'; data: TelemetrySummary }
  | { kind: 'session_saved'; data: SessionRecord }
  | { kind: 'live_event'; data: LiveEvent }

export interface Health {
  status: 'ok'
  version: string
  models_available: number
  sessions: number
}
