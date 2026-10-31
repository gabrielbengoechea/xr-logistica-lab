import { useId, useState } from 'react'

export interface Barra {
  clave: string
  etiqueta: string
  valor: number
  /** Texto del valor (con unidad) para la etiqueta y el tooltip. */
  texto: string
  detalle?: string
}

interface Props {
  titulo: string
  barras: Barra[]
  /** Máximo de la escala (por defecto, el mayor valor). */
  maximo?: number
}

/**
 * Barras horizontales de una sola serie (sin leyenda: el título la nombra). Barra fina con punta redondeada,
 * valor rotulado a la derecha en tinta de texto, rejilla tenue y tooltip al pasar el mouse o con el foco.
 */
export function BarrasHorizontales({ titulo, barras, maximo }: Props) {
  const id = useId()
  const [sobre, setSobre] = useState<string | null>(null)
  const max = Math.max(maximo ?? 0, ...barras.map((b) => b.valor), 1e-9)
  const activa = barras.find((b) => b.clave === sobre)
  return (
    <figure className="relative" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="mb-3 text-xs font-medium text-tenue">
        {titulo}
      </figcaption>
      <ul className="space-y-2.5">
        {barras.map((b) => {
          const ancho = `${Math.max(0, Math.min(1, b.valor / max)) * 100}%`
          return (
            <li key={b.clave}>
              <button
                type="button"
                className="group grid w-full grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 rounded-md py-0.5 text-left"
                onMouseEnter={() => setSobre(b.clave)}
                onMouseLeave={() => setSobre(null)}
                onFocus={() => setSobre(b.clave)}
                onBlur={() => setSobre(null)}
                aria-label={`${b.etiqueta}: ${b.texto}${b.detalle ? `, ${b.detalle}` : ''}`}
              >
                <span className="truncate text-sm">{b.etiqueta}</span>
                <span className="relative h-5">
                  <span className="absolute inset-0 rounded bg-rejilla/60" aria-hidden="true" />
                  <span
                    className={`absolute inset-y-0 left-0 rounded bg-serie transition-[width,opacity] ${sobre && sobre !== b.clave ? 'opacity-50' : ''}`}
                    style={{ width: ancho }}
                    aria-hidden="true"
                  />
                </span>
                <span className="text-right text-sm tabular-nums text-tenue group-hover:text-tinta">{b.texto}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {activa && (
        <div role="tooltip" className="pointer-events-none absolute right-0 top-0 rounded-md bg-elevada px-3 py-2 text-xs shadow-lg ring-1 ring-borde">
          <p className="font-semibold">{activa.etiqueta}</p>
          <p className="tabular-nums text-tenue">
            {activa.texto}
            {activa.detalle ? ` · ${activa.detalle}` : ''}
          </p>
        </div>
      )}
    </figure>
  )
}
