import { useState } from 'react'
import type { InventoryResponse } from '../api/types'
import { CajaError, Cargando, Seccion, Vacio } from '../components/Estado'
import { Insignia } from '../components/Insignia'
import { useApi } from '../hooks/useApi'
import { numero } from '../lib/formato'
import { ESTADO_COMPONENTE } from './estado'
import { MapaDeposito } from './MapaDeposito'

/** Inventario del depósito virtual: planta con la ubicación de cada componente y tabla filtrable por zona. */
export function Inventario() {
  const [zona, setZona] = useState('')
  const inv = useApi<InventoryResponse>(`/api/v1/inventory${zona ? `?zone=${encodeURIComponent(zona)}` : ''}`)
  const [elegido, setElegido] = useState<string | null>(null)
  const [zonas, setZonas] = useState<string[]>([])
  if (inv.data && zonas.length === 0 && inv.data.zones.length > 0) setZonas(inv.data.zones)

  if (inv.error) return <CajaError mensaje={inv.error} alReintentar={inv.reload} />
  if (!inv.data) return <Cargando texto="Leyendo el inventario…" />
  const items = inv.data.items

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Seccion titulo="Planta del depósito">
        {items.length ? <MapaDeposito items={items} elegido={elegido} alElegir={setElegido} /> : <Vacio titulo="No hay componentes en esta zona" />}
      </Seccion>
      <Seccion
        titulo="Componentes"
        accion={
          <label className="flex items-center gap-2 text-xs text-tenue">
            Zona
            <select value={zona} onChange={(e) => setZona(e.target.value)} className="rounded-md bg-elevada px-2 py-1 text-sm text-tinta ring-1 ring-borde">
              <option value="">Todas</option>
              {zonas.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
        }
      >
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Componentes del inventario</caption>
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-tenue">
                <th scope="col" className="px-4 py-2 font-medium">Componente</th>
                <th scope="col" className="px-2 py-2 font-medium">Zona</th>
                <th scope="col" className="px-2 py-2 font-medium">Estado</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Cant.</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Posición (m)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const e = ESTADO_COMPONENTE[i.status]
                return (
                  <tr
                    key={i.id}
                    onClick={() => setElegido(i.id)}
                    className={`cursor-pointer border-b border-borde/70 last:border-0 hover:bg-plano ${i.id === elegido ? 'bg-acento/5' : ''}`}
                  >
                    <th scope="row" className="px-4 py-2 text-left font-medium">
                      {i.name}
                      <span className="block font-mono text-xs font-normal text-apagada">{i.sku}</span>
                    </th>
                    <td className="px-2 py-2">{i.location.zone}</td>
                    <td className="px-2 py-2">
                      <Insignia tono={e.tono} texto={e.texto} />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{i.quantity}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-tenue">
                      {i.location.position.map((v) => numero(v, 1)).join(' · ')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-tenue">{numero(inv.data.total, 0)} componentes</p>
      </Seccion>
    </div>
  )
}
