import { lazy, Suspense, useMemo, useState } from 'react'
import type { ModelManifest, Vec3 } from '../api/types'
import { CajaError, Cargando, Vacio } from '../components/Estado'
import { useApi } from '../hooks/useApi'
import { apiUrl } from '../lib/api'
import { fichasDe, type DatosPieza } from '../lib/explotada'
import { FichaActivo } from './FichaActivo'

// three.js va en su propio paquete: el panel del docente carga sin esperarlo.
const Escena3D = lazy(() => import('./Escena3D').then((m) => ({ default: m.Escena3D })))
const ModeloGLB = lazy(() => import('./ModeloGLB').then((m) => ({ default: m.ModeloGLB })))

/** Visor de los modelos del manifest: lista, escena 3D con vista explotada y ficha. */
export function Visor() {
  const manifest = useApi<ModelManifest>('/api/v1/models/manifest')
  const [elegido, setElegido] = useState<string | null>(null)
  const [despiece, setDespiece] = useState(0)
  const [mostrarEncajes, setMostrarEncajes] = useState(false)
  const [resaltada, setResaltada] = useState<string | null>(null)
  const [pasando, setPasando] = useState<DatosPieza | null>(null)
  const [pieza, setPieza] = useState<DatosPieza | null>(null)

  const activos = useMemo(() => manifest.data?.assets ?? [], [manifest.data])
  const activo = activos.find((a) => a.id === elegido) ?? activos[0]
  const desplazamientos = useMemo<Record<string, Vec3>>(
    () => Object.fromEntries((activo?.parts ?? []).map((p) => [p.node, p.explode_offset])),
    [activo],
  )
  const fichas = useMemo(() => fichasDe(activo?.parts ?? []), [activo])
  // Colecciones en el orden del manifest (laboratorio primero, después cada proyecto).
  const grupos = useMemo(() => {
    const nombres = manifest.data?.collections ?? {}
    const orden = [...Object.keys(nombres), ...activos.map((a) => a.collection).filter((c) => !(c in nombres))]
    return [...new Set(orden)]
      .map((c) => ({ id: c, nombre: nombres[c] ?? activos.find((a) => a.collection === c)?.collection_name ?? c, activos: activos.filter((a) => a.collection === c) }))
      .filter((g) => g.activos.length > 0)
  }, [manifest.data, activos])

  if (manifest.error) return <CajaError mensaje={manifest.error} alReintentar={manifest.reload} />
  if (!manifest.data) return <Cargando texto="Leyendo el manifest de modelos…" />
  if (!activo) return <Vacio titulo="El manifest no tiene modelos">Generalos con python3 models/tools/generar_modelos.py</Vacio>

  const elegir = (id: string) => {
    setElegido(id)
    setDespiece(0)
    setPieza(null)
    setResaltada(null)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_22rem]">
      <nav aria-label="Modelos" className="rounded-xl bg-superficie p-2 ring-1 ring-borde lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto">
        {grupos.map((g) => (
          <section key={g.id} aria-labelledby={`grupo-${g.id}`} className="mb-2 last:mb-0">
            <h2 id={`grupo-${g.id}`} className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-tenue">
              {g.nombre}
            </h2>
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
              {g.activos.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => elegir(a.id)}
                    aria-current={a.id === activo.id ? 'true' : undefined}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${a.id === activo.id ? 'bg-acento/10 ring-1 ring-acento/40' : 'hover:bg-plano'}`}
                  >
                    <span className="block font-medium leading-snug">{a.name}</span>
                    <span className="block text-xs text-apagada">
                      {a.parts.length ? `${a.parts.length} piezas` : 'sin despiece'}
                      {a.files.usdz ? ' · RA' : ''}
                      {a.available ? '' : ' · archivos faltantes'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="relative h-[28rem] overflow-hidden rounded-xl ring-1 ring-borde lg:h-[calc(100vh-11rem)] lg:min-h-[32rem]">
        {activo.available ? (
          <Suspense fallback={<Cargando texto="Preparando el visor 3D…" />}>
            <Escena3D claveEncuadre={activo.id} tamano={Math.max(...activo.dimensions_m)}>
              <ModeloGLB
                url={apiUrl(activo.urls.glb)}
                factor={despiece}
                desplazamientos={desplazamientos}
                fichas={fichas}
                encajes={activo.snap_points}
                tamano={Math.max(...activo.dimensions_m)}
                mostrarEncajes={mostrarEncajes}
                resaltada={resaltada ?? pasando?.nodo ?? null}
                alPasar={setPasando}
                alElegir={setPieza}
              />
            </Escena3D>
          </Suspense>
        ) : (
          <Vacio titulo="Faltan los archivos del modelo en el servidor" />
        )}
        {pasando && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-elevada/95 px-3 py-1.5 text-xs shadow ring-1 ring-borde">
            <span className="font-semibold">{pasando.nombre}</span> · {pasando.material}
          </div>
        )}
        <p className="pointer-events-none absolute bottom-3 left-3 text-[11px] text-[#c3c2b7]">Arrastrá para girar · rueda para acercar · click en una pieza para ver sus datos</p>
      </div>

      <aside className="rounded-xl bg-superficie p-4 ring-1 ring-borde lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto">
        <FichaActivo
          activo={activo}
          despiece={despiece}
          alCambiarDespiece={setDespiece}
          mostrarEncajes={mostrarEncajes}
          alMostrarEncajes={setMostrarEncajes}
          resaltada={resaltada}
          alResaltar={setResaltada}
          elegida={pieza}
        />
      </aside>
    </div>
  )
}
