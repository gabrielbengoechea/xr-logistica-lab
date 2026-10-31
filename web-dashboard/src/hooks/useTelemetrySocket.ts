import { useEffect, useRef, useState } from 'react'
import type { WsMessage } from '../api/types'
import { wsUrl } from '../lib/api'

export type EstadoSocket = 'conectando' | 'en-vivo' | 'reconectando'

export interface OpcionesSocket {
  url?: string
  /** Para las pruebas: fábrica del WebSocket. */
  crear?: (url: string) => WebSocket
  /** Espera máxima entre reintentos (ms). */
  esperaMaxMs?: number
}

const ES_MENSAJE = new Set(['hello', 'session_saved', 'live_event'])

/** Valida lo mínimo de un mensaje del servidor (el backend es la fuente de verdad: ver api/types.ts). */
export function leerMensaje(texto: string): WsMessage | null {
  try {
    const m: unknown = JSON.parse(texto)
    if (m && typeof m === 'object' && 'kind' in m && 'data' in m && ES_MENSAJE.has(String((m as { kind: unknown }).kind))) {
      return m as WsMessage
    }
  } catch {
    // "pong" u otro texto que no es JSON
  }
  return null
}

/** Espera antes del reintento `n` (1 s, 2 s, 4 s… hasta el tope). */
export function esperaReintento(n: number, maxMs = 15_000): number {
  return Math.min(maxMs, 1000 * 2 ** Math.max(0, n))
}

/**
 * Conexión a /ws/telemetry: llama a `alRecibir` con cada mensaje y se reconecta sola con espera exponencial.
 * Manda "ping" cada 25 s para que los proxys no corten la conexión.
 */
export function useTelemetrySocket(alRecibir: (m: WsMessage) => void, opciones: OpcionesSocket = {}): EstadoSocket {
  const [estado, setEstado] = useState<EstadoSocket>('conectando')
  const handler = useRef(alRecibir)
  handler.current = alRecibir
  const { url, crear, esperaMaxMs } = opciones

  useEffect(() => {
    const destino = url ?? wsUrl('/ws/telemetry')
    const fabrica = crear ?? ((u: string) => new WebSocket(u))
    let socket: WebSocket | null = null
    let intentos = 0
    let reintento: number | undefined
    let ping: number | undefined
    let cerrado = false

    const conectar = () => {
      socket = fabrica(destino)
      socket.onopen = () => {
        intentos = 0
        setEstado('en-vivo')
        ping = window.setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send('ping'), 25_000)
      }
      socket.onmessage = (ev: MessageEvent) => {
        const m = typeof ev.data === 'string' ? leerMensaje(ev.data) : null
        if (m) handler.current(m)
      }
      socket.onclose = () => {
        window.clearInterval(ping)
        if (cerrado) return
        setEstado('reconectando')
        reintento = window.setTimeout(conectar, esperaReintento(intentos++, esperaMaxMs))
      }
      socket.onerror = () => socket?.close()
    }
    conectar()
    return () => {
      cerrado = true
      window.clearTimeout(reintento)
      window.clearInterval(ping)
      socket?.close()
    }
  }, [url, crear, esperaMaxMs])

  return estado
}
