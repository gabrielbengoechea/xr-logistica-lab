import type { LiveEvent, SessionRecord, TelemetrySummary, WsMessage } from '../api/types'

/** Una línea del feed en vivo del docente. */
export interface ItemFeed {
  id: string
  at: string
  session_id: string
  student_id: string
  scenario: string
  kind: 'evento' | 'informe'
  event?: LiveEvent['event']
  record?: SessionRecord
}

export interface EstadoPanel {
  /** Sesiones por id (las del GET inicial más las que llegan por WebSocket). */
  sesiones: Record<string, SessionRecord>
  /** Última actividad por sesión (ISO): sirve para saber quién está practicando ahora. */
  actividad: Record<string, string>
  feed: ItemFeed[]
  resumen: TelemetrySummary | null
  /** Cambió algo que afecta el resumen: hay que volver a pedirlo. */
  resumenViejo: boolean
}

export const MAX_FEED = 60
/** Una sesión sin terminar se considera activa si hubo actividad en los últimos 2 minutos. */
export const VENTANA_ACTIVA_MS = 2 * 60 * 1000

export const ESTADO_INICIAL: EstadoPanel = { sesiones: {}, actividad: {}, feed: [], resumen: null, resumenViejo: false }

let contador = 0
const idFeed = () => `f${Date.now().toString(36)}${(contador++).toString(36)}`

export function cargarSesiones(estado: EstadoPanel, lista: SessionRecord[]): EstadoPanel {
  const sesiones = { ...estado.sesiones }
  for (const s of lista) {
    const previa = sesiones[s.session_id]
    if (!previa || previa.received_at <= s.received_at) sesiones[s.session_id] = s
  }
  return { ...estado, sesiones }
}

export function cargarResumen(estado: EstadoPanel, resumen: TelemetrySummary): EstadoPanel {
  return { ...estado, resumen, resumenViejo: false }
}

/** Aplica un mensaje del WebSocket (puro: devuelve un estado nuevo). */
export function aplicarMensaje(estado: EstadoPanel, msg: WsMessage, ahora: string = new Date().toISOString()): EstadoPanel {
  switch (msg.kind) {
    case 'hello':
      return cargarResumen(estado, msg.data)
    case 'session_saved': {
      const r = msg.data
      const item: ItemFeed = { id: idFeed(), at: ahora, session_id: r.session_id, student_id: r.student_id, scenario: r.scenario, kind: 'informe', record: r }
      return {
        ...cargarSesiones(estado, [r]),
        actividad: { ...estado.actividad, [r.session_id]: ahora },
        feed: [item, ...estado.feed].slice(0, MAX_FEED),
        resumenViejo: true,
      }
    }
    case 'live_event': {
      const e = msg.data
      const item: ItemFeed = { id: idFeed(), at: ahora, session_id: e.session_id, student_id: e.student_id, scenario: e.scenario, kind: 'evento', event: e.event }
      return {
        ...estado,
        actividad: { ...estado.actividad, [e.session_id]: ahora },
        feed: [item, ...estado.feed].slice(0, MAX_FEED),
      }
    }
    default:
      return estado
  }
}

/** Sesiones de la más reciente a la más vieja (por última recepción o actividad). */
export function sesionesOrdenadas(estado: EstadoPanel): SessionRecord[] {
  const clave = (s: SessionRecord) => {
    const a = estado.actividad[s.session_id]
    return a && a > s.received_at ? a : s.received_at
  }
  return Object.values(estado.sesiones).sort((a, b) => (clave(a) < clave(b) ? 1 : clave(a) > clave(b) ? -1 : 0))
}

export function estaActiva(estado: EstadoPanel, s: SessionRecord, ahora: number = Date.now()): boolean {
  if (s.finished) return false
  const ultima = estado.actividad[s.session_id] ?? s.received_at
  return ahora - new Date(ultima).getTime() <= VENTANA_ACTIVA_MS
}

/** Estado de una sesión para mostrar (siempre con texto, nunca solo color). */
export type EstadoSesion = 'activa' | 'terminada' | 'inactiva'

export function estadoSesion(estado: EstadoPanel, s: SessionRecord, ahora: number = Date.now()): EstadoSesion {
  if (s.finished) return 'terminada'
  return estaActiva(estado, s, ahora) ? 'activa' : 'inactiva'
}
