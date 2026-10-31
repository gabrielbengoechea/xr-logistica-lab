export type TonoInsignia = 'bien' | 'alerta' | 'critico' | 'neutro' | 'acento'

const TONOS: Record<TonoInsignia, string> = {
  bien: 'bg-bien/10 text-tinta ring-bien/40',
  alerta: 'bg-alerta/15 text-tinta ring-alerta/50',
  critico: 'bg-critico/10 text-tinta ring-critico/40',
  neutro: 'bg-plano text-tenue ring-borde',
  acento: 'bg-acento/10 text-tinta ring-acento/40',
}

const PUNTOS: Record<TonoInsignia, string> = {
  bien: 'bg-bien',
  alerta: 'bg-alerta',
  critico: 'bg-critico',
  neutro: 'bg-apagada',
  acento: 'bg-acento',
}

/** Estado con punto de color Y texto: el color nunca va solo. */
export function Insignia({ tono, texto, latido = false }: { tono: TonoInsignia; texto: string; latido?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TONOS[tono]}`}>
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {latido && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${PUNTOS[tono]}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${PUNTOS[tono]}`} />
      </span>
      {texto}
    </span>
  )
}
