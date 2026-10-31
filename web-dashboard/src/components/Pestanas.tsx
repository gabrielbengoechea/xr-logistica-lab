export interface Pestana<K extends string> {
  id: K
  texto: string
}

interface Props<K extends string> {
  pestanas: Pestana<K>[]
  activa: K
  alCambiar: (id: K) => void
  etiqueta: string
}

/** Pestañas accesibles (role="tablist", flechas para moverse). */
export function Pestanas<K extends string>({ pestanas, activa, alCambiar, etiqueta }: Props<K>) {
  const mover = (dir: 1 | -1) => {
    const i = pestanas.findIndex((p) => p.id === activa)
    const sig = pestanas[(i + dir + pestanas.length) % pestanas.length]
    if (sig) alCambiar(sig.id)
  }
  return (
    <div role="tablist" aria-label={etiqueta} className="flex gap-1 rounded-lg bg-plano p-1 ring-1 ring-borde">
      {pestanas.map((p) => {
        const sel = p.id === activa
        return (
          <button
            key={p.id}
            id={`pestana-${p.id}`}
            role="tab"
            type="button"
            aria-selected={sel}
            aria-controls={`panel-${p.id}`}
            tabIndex={sel ? 0 : -1}
            onClick={() => alCambiar(p.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') mover(1)
              if (e.key === 'ArrowLeft') mover(-1)
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              sel ? 'bg-elevada text-tinta shadow-sm ring-1 ring-borde' : 'text-tenue hover:text-tinta'
            }`}
          >
            {p.texto}
          </button>
        )
      })}
    </div>
  )
}
