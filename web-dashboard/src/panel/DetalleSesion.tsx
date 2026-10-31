import type { SessionRecord, TelemetryEvent } from '../api/types'
import { Cargando, CajaError } from '../components/Estado'
import { useApi } from '../hooks/useApi'
import { NOMBRE_DISPOSITIVO, NOMBRE_EVENTO, NOMBRE_INTERACCION, duracion, hora, nombreNodo, porcentaje } from '../lib/formato'

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div>
      <dt className="text-xs text-tenue">{etiqueta}</dt>
      <dd className="font-semibold tabular-nums">{valor}</dd>
    </div>
  )
}

/** Detalle de una sesión: métricas y línea de tiempo de eventos. */
export function DetalleSesion({ sesion, alCerrar, nombreEscenario }: { sesion: SessionRecord; alCerrar: () => void; nombreEscenario: (id: string) => string }) {
  // Se vuelve a pedir cuando llega un informe nuevo de la misma sesión (cambia received_at).
  const eventos = useApi<TelemetryEvent[]>(`/api/v1/telemetry/sessions/${encodeURIComponent(sesion.session_id)}/events?r=${encodeURIComponent(sesion.received_at)}`)
  const m = sesion.metrics
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{sesion.student_id}</h3>
          <p className="text-xs text-tenue">
            {nombreEscenario(sesion.scenario)} · {NOMBRE_DISPOSITIVO[sesion.device]} · {NOMBRE_INTERACCION[sesion.interaction]} · desde las {hora(sesion.started_at)}
          </p>
        </div>
        <button type="button" onClick={alCerrar} className="rounded-md px-2 py-1 text-sm text-tenue ring-1 ring-borde hover:text-tinta" aria-label="Cerrar el detalle">
          Cerrar
        </button>
      </div>
      <dl className="grid grid-cols-3 gap-3 rounded-lg bg-plano p-3 text-sm">
        <Dato etiqueta="Puntaje" valor={m.score} />
        <Dato etiqueta="Avance" valor={porcentaje(m.completion)} />
        <Dato etiqueta="Duración" valor={duracion(m.duration_s)} />
        <Dato etiqueta="Encajes" valor={m.snaps_ok} />
        <Dato etiqueta="Errores" valor={sesion.assembly_errors} />
        <Dato etiqueta="Pistas" valor={sesion.hints_used} />
      </dl>
      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-tenue">Línea de tiempo</h4>
        {eventos.error && <CajaError mensaje={eventos.error} alReintentar={eventos.reload} />}
        {!eventos.data && eventos.loading && <Cargando />}
        {eventos.data && (
          <ol className="max-h-80 space-y-1.5 overflow-y-auto border-l border-borde pl-4 text-sm">
            {eventos.data.map((e, i) => (
              <li key={i} className="relative">
                <span
                  className={`absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full ${e.type === 'snap_fail' ? 'bg-critico' : e.type === 'snap_ok' ? 'bg-bien' : 'bg-apagada'}`}
                  aria-hidden="true"
                />
                <span className="mr-2 font-mono text-xs tabular-nums text-apagada">{duracion(e.t)}</span>
                {NOMBRE_EVENTO[e.type]}
                {e.part && <span className="text-tenue"> · {nombreNodo(e.part)}</span>}
                {e.target && <span className="text-tenue"> → {nombreNodo(e.target)}</span>}
                {e.detail && <span className="block text-xs text-tenue">{e.detail}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
