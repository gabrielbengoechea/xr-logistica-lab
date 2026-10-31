import type { SessionRecord } from '../api/types'
import { Insignia } from '../components/Insignia'
import { NOMBRE_DISPOSITIVO, duracion, hora } from '../lib/formato'
import type { EstadoSesion } from '../lib/sesiones'

interface Props {
  sesiones: SessionRecord[]
  estadoDe: (s: SessionRecord) => EstadoSesion
  seleccionada: string | null
  alElegir: (id: string) => void
  nombreEscenario: (id: string) => string
}

const ESTADO: Record<EstadoSesion, { tono: 'bien' | 'acento' | 'neutro'; texto: string }> = {
  activa: { tono: 'bien', texto: 'Practicando' },
  terminada: { tono: 'acento', texto: 'Terminada' },
  inactiva: { tono: 'neutro', texto: 'Sin actividad' },
}

/** Sesiones con su avance, errores y puntaje. Las activas laten. */
export function TablaSesiones({ sesiones, estadoDe, seleccionada, alElegir, nombreEscenario }: Props) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <caption className="sr-only">Sesiones de práctica, de la más reciente a la más vieja</caption>
        <thead>
          <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-tenue">
            <th scope="col" className="px-4 py-2 font-medium">Alumno</th>
            <th scope="col" className="px-2 py-2 font-medium">Escenario</th>
            <th scope="col" className="px-2 py-2 font-medium">Estado</th>
            <th scope="col" className="px-2 py-2 font-medium">Avance</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Errores</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Duración</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Puntaje</th>
          </tr>
        </thead>
        <tbody>
          {sesiones.map((s) => {
            const est = ESTADO[estadoDe(s)]
            const sel = s.session_id === seleccionada
            return (
              <tr
                key={s.session_id}
                className={`cursor-pointer border-b border-borde/70 last:border-0 hover:bg-plano ${sel ? 'bg-acento/5' : ''}`}
                onClick={() => alElegir(s.session_id)}
                aria-selected={sel}
              >
                <th scope="row" className="px-4 py-2.5 text-left font-medium">
                  <button type="button" className="text-left hover:underline" onClick={() => alElegir(s.session_id)}>
                    {s.student_id}
                  </button>
                  <div className="text-xs font-normal text-apagada">
                    {hora(s.started_at)} · {NOMBRE_DISPOSITIVO[s.device]}
                  </div>
                </th>
                <td className="max-w-[14rem] px-2 py-2.5">{nombreEscenario(s.scenario)}</td>
                <td className="px-2 py-2.5">
                  <Insignia tono={est.tono} texto={est.texto} latido={est.tono === 'bien'} />
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-rejilla"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={s.parts_total}
                      aria-valuenow={s.parts_placed}
                      aria-label={`${s.parts_placed} de ${s.parts_total} piezas`}
                    >
                      <div className="h-full rounded-full bg-serie" style={{ width: `${Math.round(Math.min(1, Math.max(0, s.metrics.completion)) * 100)}%` }} />
                    </div>
                    <span className="tabular-nums text-xs text-tenue">
                      {s.parts_placed}/{s.parts_total}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{s.assembly_errors}</td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-tenue">{duracion(s.metrics.duration_s)}</td>
                <td className="px-4 py-2.5 text-right text-base font-semibold tabular-nums">{s.metrics.score}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
