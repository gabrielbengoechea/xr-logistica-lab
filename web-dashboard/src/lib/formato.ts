import type { DeviceType, EventType, InteractionMode } from '../api/types'

const num = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 1 })
const entero = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 })

export function numero(n: number, decimales = 1): string {
  return decimales === 0 ? entero.format(n) : new Intl.NumberFormat('es-UY', { maximumFractionDigits: decimales }).format(n)
}

/** 75 → «1 min 15 s»; 3725 → «1 h 2 min»; null → «—». */
export function duracion(segundos: number | null | undefined): string {
  if (segundos == null || !Number.isFinite(segundos)) return '—'
  const s = Math.max(0, Math.round(segundos))
  if (s < 60) return `${s} s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`
  return r > 0 ? `${m} min ${r} s` : `${m} min`
}

export function porcentaje(fraccion: number): string {
  return `${entero.format(Math.round(Math.min(1, Math.max(0, fraccion)) * 100))} %`
}

export function kilos(kg: number | null | undefined): string {
  if (kg == null) return '—'
  return kg >= 1000 ? `${num.format(kg / 1000)} t` : kg >= 1 ? `${num.format(kg)} kg` : `${entero.format(kg * 1000)} g`
}

export function bytes(n: number | undefined): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${num.format(n / 1024)} KB`
  return `${num.format(n / (1024 * 1024))} MB`
}

const tresCifras = new Intl.NumberFormat('es-UY', { maximumSignificantDigits: 3 })

/** Medidas con 3 cifras significativas: sirve igual para un montacargas (4 m) que para un CubeSat (0,114 m). */
export function medidas(m: [number, number, number]): string {
  return m.map((v) => tresCifras.format(v)).join(' × ') + ' m'
}

/** Hora local «14:05» si es de hoy; si no, «31/10 14:05». */
export function hora(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const hhmm = d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })
  const mismoDia = d.toDateString() === ahora.toDateString()
  return mismoDia ? hhmm : `${d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })} ${hhmm}`
}

/** «hace 3 min» para el feed en vivo. */
export function haceCuanto(iso: string, ahora: number = Date.now()): string {
  const s = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000))
  if (s < 10) return 'recién'
  if (s < 60) return `hace ${s} s`
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  return `hace ${Math.floor(s / 3600)} h`
}

export const NOMBRE_DISPOSITIVO: Record<DeviceType, string> = {
  quest3: 'Quest 3',
  quest2: 'Quest 2',
  editor: 'Editor de Unity',
  web: 'Navegador',
}

export const NOMBRE_INTERACCION: Record<InteractionMode, string> = {
  hands: 'Manos',
  controllers: 'Controles',
  mouse: 'Mouse',
}

export const NOMBRE_EVENTO: Record<EventType, string> = {
  session_start: 'Empezó la sesión',
  grab: 'Tomó una pieza',
  release: 'Soltó una pieza',
  snap_ok: 'Encajó',
  snap_fail: 'Error de encaje',
  explode: 'Despiezó',
  assemble: 'Ensambló',
  hint: 'Pidió una pista',
  session_end: 'Terminó la sesión',
}

/** Nodo de Blender → texto: «Part_Placa_OBC» → «Placa OBC». */
export function nombreNodo(nodo: string | null | undefined): string {
  if (!nodo) return ''
  return nodo.replace(/^(Part|Snap)_/, '').replace(/\.\d+$/, '').replace(/_/g, ' ')
}
