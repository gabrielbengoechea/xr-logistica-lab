/** Cliente HTTP mínimo para la API. En desarrollo Vite redirige /api al backend; en producción, VITE_API_BASE. */

export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? ''

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Sitio estático (GitHub Pages): sin backend, con el manifest, el inventario y los modelos copiados como archivos. */
export const SITIO_ESTATICO: boolean = import.meta.env.VITE_SITIO_ESTATICO === '1'

/** Nombre de archivo para una zona del inventario: minúsculas, sin tildes y con guiones ("Pañol" → "panol"). */
export function slugZona(zona: string): string {
  return zona
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Ruta de un recurso de la API en el sitio estático. El manifest y el inventario son JSON exportados por
 * backend/tools/exportar_sitio.py; los modelos van en models/. Lo demás (telemetría) no existe sin servidor.
 */
export function rutaEstatica(path: string, base: string = import.meta.env.BASE_URL): string {
  const [ruta = '', consulta = ''] = path.split('?')
  if (ruta === '/api/v1/models/manifest') return `${base}datos/manifest.json`
  if (ruta === '/api/v1/inventory') {
    const zona = new URLSearchParams(consulta).get('zone')
    return `${base}datos/${zona ? `inventario-${slugZona(zona)}` : 'inventario'}.json`
  }
  if (ruta.startsWith('/models/')) return `${base}${ruta.slice(1)}`
  return path
}

export function apiUrl(path: string): string {
  if (SITIO_ESTATICO) return rutaEstatica(path)
  return `${API_BASE}${path}`
}

/** URL del WebSocket a partir de la base HTTP (o de la página actual). */
export function wsUrl(path: string, loc: Pick<Location, 'protocol' | 'host'> = window.location): string {
  if (API_BASE) {
    return API_BASE.replace(/^http/, 'ws') + path
  }
  return `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}${path}`
}

/** FastAPI devuelve {"detail": "..."} o {"detail": [{msg, loc}, ...]}: se arma un texto legible. */
export function mensajeDeError(status: number, body: unknown): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((d: unknown) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
        .join('; ')
    }
  }
  if (status === 0) return 'Sin conexión con el servidor'
  return `Error ${status}`
}

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(apiUrl(path), { signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError(0, 'Sin conexión con el servidor')
  }
  if (!res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    throw new ApiError(res.status, mensajeDeError(res.status, body))
  }
  return (await res.json()) as T
}
