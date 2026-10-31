import type { EventType } from '../api/types'
import { NOMBRE_EVENTO, haceCuanto, nombreNodo } from '../lib/formato'
import type { ItemFeed } from '../lib/sesiones'

const MARCA: Partial<Record<EventType, { simbolo: string; clase: string; texto: string }>> = {
  snap_ok: { simbolo: '✓', clase: 'bg-bien/15 text-tinta ring-bien/50', texto: 'acierto' },
  snap_fail: { simbolo: '✕', clase: 'bg-critico/10 text-tinta ring-critico/50', texto: 'error' },
  hint: { simbolo: '?', clase: 'bg-alerta/20 text-tinta ring-alerta/60', texto: 'pista' },
}

function Linea({ item }: { item: ItemFeed }) {
  if (item.kind === 'informe' && item.record) {
    const r = item.record
    return (
      <>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acento/10 text-xs ring-1 ring-acento/40" aria-hidden="true">
          ⇪
        </span>
        <p className="min-w-0 flex-1">
          <span className="font-medium">{item.student_id}</span> {r.finished ? 'terminó' : 'mandó su avance'}: {r.parts_placed}/{r.parts_total} piezas,{' '}
          {r.assembly_errors} errores, puntaje <span className="font-semibold tabular-nums">{r.metrics.score}</span>
        </p>
      </>
    )
  }
  const e = item.event!
  const m = MARCA[e.type]
  return (
    <>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ${m?.clase ?? 'bg-plano text-tenue ring-borde'}`}
        aria-label={m?.texto}
      >
        {m?.simbolo ?? '·'}
      </span>
      <p className="min-w-0 flex-1">
        <span className="font-medium">{item.student_id}</span> · {NOMBRE_EVENTO[e.type]}
        {e.part && <span className="text-tenue"> · {nombreNodo(e.part)}</span>}
        {e.target && <span className="text-tenue"> → {nombreNodo(e.target)}</span>}
        {e.detail && e.type === 'snap_fail' && <span className="block text-xs text-tenue">{e.detail}</span>}
      </p>
    </>
  )
}

/** Lo que va pasando en los visores, al instante (WebSocket). */
export function FeedEnVivo({ items, ahora }: { items: ItemFeed[]; ahora: number }) {
  if (items.length === 0) {
    return <p className="text-sm text-tenue">Todavía no llegó nada. Cuando un alumno tome o encaje una pieza en el visor, aparece acá.</p>
  }
  return (
    <ol className="max-h-[28rem] space-y-3 overflow-y-auto pr-1 text-sm" aria-live="polite" aria-relevant="additions">
      {items.map((it) => (
        <li key={it.id} className="flex items-start gap-3">
          <Linea item={it} />
          <time className="shrink-0 text-xs tabular-nums text-apagada" dateTime={it.at}>
            {haceCuanto(it.at, ahora)}
          </time>
        </li>
      ))}
    </ol>
  )
}
