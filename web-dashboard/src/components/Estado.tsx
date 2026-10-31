import type { ReactNode } from 'react'

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-6 text-sm text-tenue">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-borde border-t-acento" aria-hidden="true" />
      {texto}
    </div>
  )
}

export function CajaError({ mensaje, alReintentar }: { mensaje: string; alReintentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-critico/40 bg-critico/5 p-4 text-sm">
      <p>
        <span className="font-semibold">No se pudieron traer los datos.</span> {mensaje}
      </p>
      {alReintentar && (
        <button type="button" onClick={alReintentar} className="rounded-md bg-elevada px-3 py-1.5 font-medium ring-1 ring-borde hover:bg-plano">
          Reintentar
        </button>
      )}
    </div>
  )
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-borde p-6 text-center text-sm text-tenue">
      <p className="font-medium text-tinta">{titulo}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  )
}

/** Caja con título para las secciones del tablero. */
export function Seccion({ titulo, accion, children, className = '' }: { titulo: string; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl bg-superficie ring-1 ring-borde ${className}`} aria-label={titulo}>
      <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {accion}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}
