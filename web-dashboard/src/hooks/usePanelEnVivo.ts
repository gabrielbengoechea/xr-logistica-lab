import { useCallback, useEffect, useReducer, useState } from 'react'
import type { SessionList, SessionRecord, TelemetrySummary, WsMessage } from '../api/types'
import { ESTADO_INICIAL, aplicarMensaje, cargarResumen, cargarSesiones, type EstadoPanel } from '../lib/sesiones'
import { useApi } from './useApi'
import { useTelemetrySocket, type EstadoSocket, type OpcionesSocket } from './useTelemetrySocket'

type Accion =
  | { tipo: 'sesiones'; lista: SessionRecord[] }
  | { tipo: 'resumen'; resumen: TelemetrySummary }
  | { tipo: 'mensaje'; mensaje: WsMessage }

function reducir(estado: EstadoPanel, a: Accion): EstadoPanel {
  switch (a.tipo) {
    case 'sesiones':
      return cargarSesiones(estado, a.lista)
    case 'resumen':
      return cargarResumen(estado, a.resumen)
    case 'mensaje':
      return aplicarMensaje(estado, a.mensaje)
  }
}

export interface PanelEnVivo {
  estado: EstadoPanel
  socket: EstadoSocket
  cargando: boolean
  error: string | null
  recargar: () => void
  /** Reloj del panel (se actualiza cada 15 s) para «activa / hace 3 min». */
  ahora: number
}

/**
 * Datos del panel del docente: sesiones y resumen por REST, y novedades por WebSocket (sesiones guardadas y
 * eventos en vivo). Cuando llega un informe nuevo, el resumen se vuelve a pedir (como mucho cada 3 s).
 */
export function usePanelEnVivo(opcionesSocket?: OpcionesSocket): PanelEnVivo {
  const [estado, despachar] = useReducer(reducir, ESTADO_INICIAL)
  const sesiones = useApi<SessionList>('/api/v1/telemetry/sessions?limit=200')
  const resumen = useApi<TelemetrySummary>('/api/v1/telemetry/summary')
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (sesiones.data) despachar({ tipo: 'sesiones', lista: sesiones.data.sessions })
  }, [sesiones.data])

  useEffect(() => {
    if (resumen.data) despachar({ tipo: 'resumen', resumen: resumen.data })
  }, [resumen.data])

  const recargarResumen = resumen.reload
  useEffect(() => {
    if (!estado.resumenViejo) return
    const id = window.setTimeout(recargarResumen, 3000)
    return () => window.clearTimeout(id)
  }, [estado.resumenViejo, recargarResumen])

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  const alRecibir = useCallback((mensaje: WsMessage) => despachar({ tipo: 'mensaje', mensaje }), [])
  const socket = useTelemetrySocket(alRecibir, opcionesSocket)

  const recargarSesiones = sesiones.reload
  const recargar = useCallback(() => {
    recargarSesiones()
    recargarResumen()
  }, [recargarSesiones, recargarResumen])

  return {
    estado,
    socket,
    cargando: (sesiones.loading && !sesiones.data) || (resumen.loading && !resumen.data && !estado.resumen),
    error: sesiones.error ?? resumen.error,
    recargar,
    ahora,
  }
}
