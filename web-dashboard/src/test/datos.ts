import type { InventoryResponse, ModelAsset, ModelManifest, SessionRecord, TelemetrySummary } from '../api/types'

export function sesion(parcial: Partial<SessionRecord> = {}): SessionRecord {
  return {
    session_id: 'sesion-ana-01',
    student_id: 'ana',
    scenario: 'cubesat',
    device: 'quest3',
    interaction: 'hands',
    started_at: '2026-10-31T14:00:00Z',
    ended_at: null,
    parts_total: 4,
    parts_placed: 1,
    assembly_errors: 2,
    hints_used: 0,
    finished: false,
    metrics: { duration_s: 95, completion: 0.25, error_rate: 2, grabs: 5, snaps_ok: 1, snaps_failed: 2, explode_toggles: 1, score: 41 },
    received_at: '2026-10-31T14:01:35Z',
    ...parcial,
  }
}

export const RESUMEN: TelemetrySummary = {
  sessions: 2,
  students: 2,
  avg_score: 63.5,
  total_errors: 3,
  by_scenario: [
    { scenario: 'cubesat', sessions: 1, finished: 0, avg_duration_s: 95, avg_errors: 2, avg_score: 41, best_score: 41 },
    { scenario: 'motor', sessions: 1, finished: 1, avg_duration_s: 300, avg_errors: 1, avg_score: 86, best_score: 86 },
  ],
  by_student: [
    { student_id: 'ana', sessions: 1, avg_score: 41, total_errors: 2, last_seen: '2026-10-31T14:01:35Z' },
    { student_id: 'bruno', sessions: 1, avg_score: 86, total_errors: 1, last_seen: '2026-10-31T13:30:00Z' },
  ],
}

export const CUBESAT: ModelAsset = {
  id: 'cubesat',
  collection: 'laboratorio',
  collection_name: 'Laboratorio',
  source: null,
  root_node: 'CubeSat',
  name: 'CubeSat 1U',
  category: 'Aeroespacial',
  description: 'Nanosatélite de 10 cm con pila PC/104.',
  files: { glb: 'glb/cubesat.glb', fbx: 'fbx/cubesat.fbx', blend: 'blend/cubesat.blend', usdz: null },
  urls: { glb: '/models/glb/cubesat.glb', fbx: '/models/fbx/cubesat.fbx', blend: '/models/blend/cubesat.blend', usdz: null },
  sizes_bytes: { glb: 34044, fbx: 47484, blend: 101334 },
  available: true,
  dimensions_m: [0.1, 0.1135, 0.1],
  triangles: 432,
  mass_kg: 1.33,
  parts: [
    { node: 'Part_Estructura', name: 'Estructura', material: 'Aluminio 6061', mass_kg: 0.1, explode_offset: [0, 0, 0], parent: null },
    { node: 'Part_Placa_OBC', name: 'Computadora de a bordo', material: 'FR-4', mass_kg: 0.08, explode_offset: [0, 0.12, 0], parent: null },
  ],
  snap_points: [{ node: 'Snap_Ranura_OBC', accepts: 'placa_obc', tolerance_m: 0.004, position: [0, 0.03, 0] }],
}

/** Un modelo de otro proyecto: sin fbx ni blend, con usdz para la RA y masa desconocida. */
export const ROBOT: ModelAsset = {
  id: 'robot-6-ejes',
  collection: 'robot',
  collection_name: 'Brazo robótico (RA)',
  source: 'quest-xr-pilotos · robot-6-ejes/modelo',
  root_node: 'Base_Mesh',
  name: 'Brazo robótico de 6 ejes',
  category: 'Automatización',
  description: 'Robot industrial articulado.',
  files: { glb: 'proyectos/robot/robot-6-ejes.glb', fbx: null, blend: null, usdz: 'proyectos/robot/robot-6-ejes.usdz' },
  urls: { glb: '/models/proyectos/robot/robot-6-ejes.glb', fbx: null, blend: null, usdz: '/models/proyectos/robot/robot-6-ejes.usdz' },
  sizes_bytes: { glb: 964756, usdz: 6430032 },
  available: true,
  dimensions_m: [0.38, 1.09, 0.3],
  triangles: 8122,
  mass_kg: null,
  parts: [
    { node: 'Shoulder_Joint', name: 'Hombro (eje 1-2)', material: 'Aluminio fundido', mass_kg: null, explode_offset: [0.2, 0.1, 0], parent: null },
    { node: 'Upper_Arm', name: 'Brazo', material: 'Aluminio fundido', mass_kg: null, explode_offset: [0, 0.13, 0], parent: 'Shoulder_Joint' },
  ],
  snap_points: [],
}

export const CONTENEDOR: ModelAsset = {
  ...ROBOT,
  id: 'puerto-contenedor-40',
  collection: 'puerto',
  collection_name: 'Terminal portuaria',
  name: "Contenedor ISO de 40'",
  files: { ...ROBOT.files, usdz: null },
  urls: { ...ROBOT.urls, glb: '/models/proyectos/puerto/puerto-contenedor-40.glb', usdz: null },
  parts: [],
}

export const MANIFEST: ModelManifest = {
  version: 1,
  units: 'metros',
  axes: 'glTF',
  collections: { laboratorio: 'Laboratorio', puerto: 'Terminal portuaria', robot: 'Brazo robótico (RA)' },
  assets: [CUBESAT, { ...CUBESAT, id: 'motor', name: 'Motor trifásico IEC 132', root_node: 'Motor', available: false }, CONTENEDOR, ROBOT],
}

export const INVENTARIO: InventoryResponse = {
  items: [
    { id: 'mc-01', model_id: 'forklift', name: 'Montacargas 2,5 t', category: 'Equipos', sku: 'EQ-01', quantity: 1, status: 'available', location: { zone: 'Muelle', position: [-6, 0, 4], rotation_y_deg: 90 } },
    { id: 'rk-a1', model_id: 'rack', name: 'Rack A1', category: 'Almacenamiento', sku: 'AL-A1', quantity: 1, status: 'maintenance', location: { zone: 'A-Racks', position: [0, 0, -6], rotation_y_deg: 0 } },
  ],
  total: 2,
  zones: ['A-Racks', 'Muelle'],
}

/** fetch falso que responde por ruta (sin query). */
export function fetchFalso(rutas: Record<string, unknown>, fallas: Record<string, number> = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    const ruta = url.split('?')[0] ?? url
    if (fallas[ruta]) {
      return new Response(JSON.stringify({ detail: 'Algo salió mal' }), { status: fallas[ruta] })
    }
    if (!(ruta in rutas)) return new Response(JSON.stringify({ detail: `No existe ${ruta}` }), { status: 404 })
    return new Response(JSON.stringify(rutas[ruta]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
}

/** WebSocket falso: las pruebas abren, mandan mensajes y cierran a mano. */
export class SocketFalso {
  static todos: SocketFalso[] = []
  readyState = 0
  enviados: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(public url: string) {
    SocketFalso.todos.push(this)
  }

  abrir() {
    this.readyState = 1
    this.onopen?.()
  }

  recibir(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: typeof data === 'string' ? data : JSON.stringify(data) }))
  }

  send(t: string) {
    this.enviados.push(t)
  }

  close() {
    if (this.readyState === 3) return
    this.readyState = 3
    this.onclose?.()
  }

  static crear = (url: string) => new SocketFalso(url) as unknown as WebSocket
}
