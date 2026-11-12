import { apiUrl } from '../lib/api'
import type { ModelAsset } from '../api/types'
import { bytes, kilos, medidas, numero } from '../lib/formato'
import type { DatosPieza } from '../lib/explotada'

interface Props {
  activo: ModelAsset
  despiece: number
  alCambiarDespiece: (v: number) => void
  mostrarEncajes: boolean
  alMostrarEncajes: (v: boolean) => void
  resaltada: string | null
  alResaltar: (nodo: string | null) => void
  elegida: DatosPieza | null
}

/** Datos del activo, controles del visor y lista de piezas (pasar el mouse resalta la pieza en 3D). */
export function FichaActivo({ activo, despiece, alCambiarDespiece, mostrarEncajes, alMostrarEncajes, resaltada, alResaltar, elegida }: Props) {
  const despiezado = despiece >= 0.5
  return (
    <div className="space-y-5 text-sm">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-tenue">
          {activo.collection === 'laboratorio' ? activo.category : `${activo.collection_name} · ${activo.category}`}
        </p>
        <h2 className="mt-0.5 text-lg font-semibold leading-snug">{activo.name}</h2>
        <p className="mt-1 text-tenue">{activo.description}</p>
        {activo.source && <p className="mt-1 text-xs text-apagada">Origen: {activo.source}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <dt className="text-xs text-tenue">Medidas</dt>
          <dd className="tabular-nums">{medidas(activo.dimensions_m)}</dd>
        </div>
        <div>
          <dt className="text-xs text-tenue">Masa</dt>
          <dd className="tabular-nums">{kilos(activo.mass_kg)}</dd>
        </div>
        <div>
          <dt className="text-xs text-tenue">Piezas · encajes</dt>
          <dd className="tabular-nums">
            {activo.parts.length} · {activo.snap_points.length}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-tenue">Triángulos</dt>
          <dd className="tabular-nums">{numero(activo.triangles, 0)}</dd>
        </div>
      </dl>

      {activo.parts.length === 0 ? (
        <p className="rounded-lg bg-plano p-3 text-tenue">Este modelo es de una sola pieza: no tiene vista explotada.</p>
      ) : (
      <fieldset className="space-y-3 rounded-lg bg-plano p-3">
        <legend className="sr-only">Controles del visor</legend>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="despiece" className="font-medium">
            Vista explotada
          </label>
          <button
            type="button"
            onClick={() => alCambiarDespiece(despiezado ? 0 : 1)}
            className="rounded-md bg-acento px-3 py-1 text-xs font-semibold text-acento-tinta hover:opacity-90"
          >
            {despiezado ? 'Armar' : 'Despiezar'}
          </button>
        </div>
        <input
          id="despiece"
          type="range"
          min={0}
          max={100}
          value={Math.round(despiece * 100)}
          onChange={(e) => alCambiarDespiece(Number(e.target.value) / 100)}
          className="w-full accent-[rgb(var(--acento))]"
          aria-valuetext={`${Math.round(despiece * 100)} % despiezado`}
        />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={mostrarEncajes} onChange={(e) => alMostrarEncajes(e.target.checked)} className="accent-[rgb(var(--acento))]" />
          Mostrar los encajes ({activo.snap_points.length})
        </label>
      </fieldset>
      )}

      {elegida && (
        <div className="rounded-lg p-3 ring-1 ring-acento/50" aria-live="polite">
          <p className="text-xs text-tenue">Pieza elegida</p>
          <p className="font-semibold">{elegida.nombre}</p>
          <p className="text-tenue">
            {elegida.material}
            {elegida.masaKg != null ? ` · ${kilos(elegida.masaKg)}` : ''}
          </p>
        </div>
      )}

      {activo.parts.length > 0 && (
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-tenue">Piezas</h3>
        <ul className="divide-y divide-borde/70" onMouseLeave={() => alResaltar(null)}>
          {activo.parts.map((p) => (
            <li key={p.node}>
              <button
                type="button"
                onMouseEnter={() => alResaltar(p.node)}
                onFocus={() => alResaltar(p.node)}
                onBlur={() => alResaltar(null)}
                className={`flex w-full items-baseline justify-between gap-3 px-1 py-1.5 text-left ${resaltada === p.node ? 'text-acento' : ''}`}
              >
                <span className={p.parent ? 'pl-3' : ''}>
                  {p.parent && <span className="mr-1 text-apagada" aria-hidden="true">└</span>}
                  {p.name}
                  <span className="block text-xs text-apagada">{p.material}</span>
                </span>
                <span className="shrink-0 tabular-nums text-xs text-tenue">{kilos(p.mass_kg)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-tenue">Archivos</h3>
        <ul className="flex flex-wrap gap-2">
          {(['glb', 'usdz', 'fbx', 'blend'] as const).filter((k) => activo.urls[k]).map((k) => (
            <li key={k}>
              <a href={activo.urls[k] ? apiUrl(activo.urls[k]) : undefined} download title={k === 'usdz' ? 'Para ver en realidad aumentada en iPhone o iPad' : undefined} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ring-1 ring-borde hover:bg-plano">
                <span className="font-semibold uppercase">{k}</span>
                <span className="text-apagada">{bytes(activo.sizes_bytes[k])}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
