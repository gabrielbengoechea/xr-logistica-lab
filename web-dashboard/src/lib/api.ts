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

export function apiUrl(path: string): string {
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
