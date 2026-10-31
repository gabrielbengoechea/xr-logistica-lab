/** Número grande con su etiqueta (no es un gráfico: un solo dato se lee mejor así). */
export function TarjetaDato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-xl bg-superficie p-4 ring-1 ring-borde">
      <p className="text-xs font-medium uppercase tracking-wide text-tenue">{etiqueta}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums leading-tight">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-apagada">{detalle}</p>}
    </div>
  )
}
