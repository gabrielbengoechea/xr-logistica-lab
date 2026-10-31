import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getJson } from '../lib/api'

export interface EstadoApi<T> {
  data: T | null
  error: string | null
  loading: boolean
  /** Vuelve a pedir el recurso (mantiene los datos anteriores mientras tanto). */
  reload: () => void
}

/**
 * GET a la API con estado de carga y error. Cambiar `path` (o pasar null) cancela el pedido anterior.
 * `intervaloMs` lo vuelve a pedir periódicamente (0: nunca).
 */
export function useApi<T>(path: string | null, intervaloMs = 0): EstadoApi<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(path !== null)
  const [vuelta, setVuelta] = useState(0)
  const pathRef = useRef(path)

  useEffect(() => {
    if (pathRef.current !== path) {
      pathRef.current = path
      setData(null)
    }
    if (path === null) {
      setLoading(false)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    getJson<T>(path, ctrl.signal)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof ApiError ? e.message : 'No se pudo leer la respuesta del servidor')
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [path, vuelta])

  useEffect(() => {
    if (!intervaloMs || path === null) return
    const id = window.setInterval(() => setVuelta((v) => v + 1), intervaloMs)
    return () => window.clearInterval(id)
  }, [intervaloMs, path])

  const reload = useCallback(() => setVuelta((v) => v + 1), [])
  return { data, error, loading, reload }
}
