import { useMemo, useState } from 'react'
import type { ModelManifest } from '../api/types'
import { BarrasHorizontales } from '../components/BarrasHorizontales'
import { CajaError, Cargando, Seccion, Vacio } from '../components/Estado'
import { Insignia } from '../components/Insignia'
import { TarjetaDato } from '../components/TarjetaDato'
import { useApi } from '../hooks/useApi'
import { usePanelEnVivo } from '../hooks/usePanelEnVivo'
import type { OpcionesSocket } from '../hooks/useTelemetrySocket'
import { duracion, hora, numero } from '../lib/formato'
import { estadoSesion, sesionesOrdenadas } from '../lib/sesiones'
import { DetalleSesion } from './DetalleSesion'
import { FeedEnVivo } from './FeedEnVivo'
import { TablaSesiones } from './TablaSesiones'

/** Panel del docente: quién está practicando, cómo le va a cada uno y qué pasa en este momento en los visores. */
export function PanelDocente({ opcionesSocket }: { opcionesSocket?: OpcionesSocket }) {
  const { estado, socket, cargando, error, recargar, ahora } = usePanelEnVivo(opcionesSocket)
  const manifest = useApi<ModelManifest>('/api/v1/models/manifest')
  const [seleccionada, setSeleccionada] = useState<string | null>(null)

  const nombreEscenario = useMemo(() => {
    const nombres = new Map((manifest.data?.assets ?? []).map((a) => [a.id, a.name]))
    return (id: string) => nombres.get(id) ?? id
  }, [manifest.data])

  const sesiones = useMemo(() => sesionesOrdenadas(estado), [estado])
  const activas = sesiones.filter((s) => estadoSesion(estado, s, ahora) === 'activa').length
  const r = estado.resumen
  const detalle = seleccionada ? estado.sesiones[seleccionada] : undefined

  if (cargando) return <Cargando texto="Trayendo las sesiones…" />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tenue">Las sesiones y los eventos de los visores llegan solos: no hace falta recargar.</p>
        <Insignia
          tono={socket === 'en-vivo' ? 'bien' : socket === 'reconectando' ? 'alerta' : 'neutro'}
          texto={socket === 'en-vivo' ? 'Conectado en vivo' : socket === 'reconectando' ? 'Reconectando…' : 'Conectando…'}
          latido={socket === 'en-vivo'}
        />
      </div>
      {error && <CajaError mensaje={error} alReintentar={recargar} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TarjetaDato etiqueta="Practicando ahora" valor={numero(activas, 0)} detalle="con actividad en los últimos 2 min" />
        <TarjetaDato etiqueta="Sesiones" valor={numero(r?.sessions ?? sesiones.length, 0)} />
        <TarjetaDato etiqueta="Alumnos" valor={numero(r?.students ?? 0, 0)} />
        <TarjetaDato etiqueta="Puntaje promedio" valor={r ? numero(r.avg_score, 0) : '—'} detalle="de 0 a 100" />
        <TarjetaDato etiqueta="Errores de encaje" valor={numero(r?.total_errors ?? 0, 0)} detalle="en todas las sesiones" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Seccion titulo="Sesiones" accion={<span className="text-xs text-tenue">{sesiones.length} en total</span>}>
          {sesiones.length === 0 ? (
            <Vacio titulo="Todavía no hay sesiones">
              Cuando un alumno abra la app en el visor con la URL de este servidor, su sesión aparece acá en vivo.
            </Vacio>
          ) : (
            <TablaSesiones
              sesiones={sesiones}
              estadoDe={(s) => estadoSesion(estado, s, ahora)}
              seleccionada={seleccionada}
              alElegir={setSeleccionada}
              nombreEscenario={nombreEscenario}
            />
          )}
        </Seccion>

        <div className="min-w-0 space-y-5">
          {detalle ? (
            <Seccion titulo="Detalle de la sesión">
              <DetalleSesion sesion={detalle} alCerrar={() => setSeleccionada(null)} nombreEscenario={nombreEscenario} />
            </Seccion>
          ) : null}
          <Seccion titulo="En vivo" accion={<Insignia tono="neutro" texto={`${estado.feed.length} eventos`} />}>
            <FeedEnVivo items={estado.feed} ahora={ahora} />
          </Seccion>
        </div>
      </div>

      {r && r.by_scenario.length > 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Seccion titulo="Por escenario">
            <div className="space-y-6">
              <BarrasHorizontales
                titulo="Puntaje promedio (0 a 100)"
                maximo={100}
                barras={r.by_scenario.map((e) => ({
                  clave: e.scenario,
                  etiqueta: nombreEscenario(e.scenario),
                  valor: e.avg_score,
                  texto: numero(e.avg_score, 0),
                  detalle: `mejor ${e.best_score} · ${e.sessions} sesiones`,
                }))}
              />
              <BarrasHorizontales
                titulo="Errores de encaje por sesión (promedio)"
                barras={r.by_scenario.map((e) => ({
                  clave: e.scenario,
                  etiqueta: nombreEscenario(e.scenario),
                  valor: e.avg_errors,
                  texto: numero(e.avg_errors, 1),
                  detalle: `${e.finished} de ${e.sessions} terminadas · ${duracion(e.avg_duration_s)} en promedio`,
                }))}
              />
            </div>
          </Seccion>
          <Seccion titulo="Por alumno">
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Resumen por alumno</caption>
                <thead>
                  <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-tenue">
                    <th scope="col" className="px-4 py-2 font-medium">Alumno</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Sesiones</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Errores</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Última vez</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Puntaje</th>
                  </tr>
                </thead>
                <tbody>
                  {r.by_student.map((a) => (
                    <tr key={a.student_id} className="border-b border-borde/70 last:border-0">
                      <th scope="row" className="px-4 py-2 text-left font-medium">{a.student_id}</th>
                      <td className="px-2 py-2 text-right tabular-nums">{a.sessions}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{a.total_errors}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-tenue">{hora(a.last_seen)}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{numero(a.avg_score, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Seccion>
        </div>
      )}
    </div>
  )
}
