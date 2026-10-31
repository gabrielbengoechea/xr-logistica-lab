import { useMemo } from 'react'
import type { InventoryItem } from '../api/types'
import { ESTADO_COMPONENTE } from './estado'

const COLOR: Record<string, string> = { bien: 'rgb(var(--bien))', acento: 'rgb(var(--acento))', alerta: 'rgb(var(--alerta))' }

function Marcador({ forma, color }: { forma: 'circulo' | 'cuadrado' | 'triangulo'; color: string }) {
  const borde = { stroke: 'rgb(var(--superficie))', strokeWidth: 2 }
  if (forma === 'cuadrado') return <rect x={-6} y={-6} width={12} height={12} rx={2} fill={color} {...borde} />
  if (forma === 'triangulo') return <path d="M0 -8 L7.5 6 L-7.5 6 Z" fill={color} {...borde} />
  return <circle r={6.5} fill={color} {...borde} />
}

/**
 * Planta del depósito virtual (vista desde arriba, ejes de Unity: x a la derecha, z hacia adelante, en metros).
 * Cada componente es un marcador cuya forma y color dicen su estado.
 */
export function MapaDeposito({ items, elegido, alElegir }: { items: InventoryItem[]; elegido: string | null; alElegir: (id: string) => void }) {
  const caja = useMemo(() => {
    const xs = items.map((i) => i.location.position[0])
    const zs = items.map((i) => i.location.position[2])
    const pad = 3
    const minX = Math.min(...xs, 0) - pad
    const maxX = Math.max(...xs, 0) + pad
    const minZ = Math.min(...zs, 0) - pad
    const maxZ = Math.max(...zs, 0) + pad
    return { minX, minZ, ancho: maxX - minX, alto: maxZ - minZ }
  }, [items])
  const escala = 22 // px por metro en el viewBox
  const W = caja.ancho * escala
  const H = caja.alto * escala
  const px = (x: number) => (x - caja.minX) * escala
  // z positivo hacia adelante → abajo en la planta
  const pz = (z: number) => (z - caja.minZ) * escala
  const lineas: number[] = []
  for (let m = Math.ceil(caja.minX); m <= caja.minX + caja.ancho; m += 2) lineas.push(m)
  const lineasZ: number[] = []
  for (let m = Math.ceil(caja.minZ); m <= caja.minZ + caja.alto; m += 2) lineasZ.push(m)

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-lg bg-plano" role="img" aria-label={`Planta del depósito con ${items.length} componentes`}>
        {lineas.map((m) => (
          <line key={`x${m}`} x1={px(m)} x2={px(m)} y1={0} y2={H} stroke="rgb(var(--rejilla))" strokeWidth={m === 0 ? 1.5 : 0.75} />
        ))}
        {lineasZ.map((m) => (
          <line key={`z${m}`} y1={pz(m)} y2={pz(m)} x1={0} x2={W} stroke="rgb(var(--rejilla))" strokeWidth={m === 0 ? 1.5 : 0.75} />
        ))}
        {items.map((i) => {
          const e = ESTADO_COMPONENTE[i.status]
          const [x, , z] = i.location.position
          const sel = i.id === elegido
          return (
            <g
              key={i.id}
              transform={`translate(${px(x)} ${pz(z)})`}
              className="cursor-pointer"
              onClick={() => alElegir(i.id)}
              role="button"
              tabIndex={0}
              aria-label={`${i.name}, ${e.texto}, zona ${i.location.zone}`}
              onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && alElegir(i.id)}
            >
              <title>{`${i.name} · ${e.texto} · ${i.location.zone}`}</title>
              {sel && <circle r={13} fill="none" stroke="rgb(var(--tinta))" strokeWidth={1.5} />}
              <Marcador forma={e.forma} color={COLOR[e.tono] ?? 'rgb(var(--apagada))'} />
              <text y={-12} textAnchor="middle" fontSize={10} fill="rgb(var(--tenue))">
                {i.id}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-tenue">
        {Object.entries(ESTADO_COMPONENTE).map(([k, e]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="-9 -9 18 18" aria-hidden="true">
              <Marcador forma={e.forma} color={COLOR[e.tono] ?? ''} />
            </svg>
            {e.texto}
          </span>
        ))}
        <span>Cuadrícula de 2 m · vista desde arriba</span>
      </figcaption>
    </figure>
  )
}
