// B13 (Sprint 03): cada actividad arma y limpia su escenario con preparar()/limpiar(); la Descarga varía.
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { GestorActividades } from '../../public/artigas1/js/actividades.js'
import { CARGA_CARGUERO, DescargaCarguero, FALTANTE, MANIFIESTO, SOBRANTE } from '../../public/artigas1/js/descarga.js'
import { crearEscenarios } from '../../public/artigas1/js/escenarios.js'
import { definirActividades } from '../../public/artigas1/js/misiones.js'

describe('B13 · preparar y limpiar', () => {
  it('preparar corre antes de calcular los pasos y limpiar al terminar y al abandonar', () => {
    const orden = []
    const g = new GestorActividades()
    g.registrar({
      id: 'x', titulo: 'X', referencia: 10,
      preparar: () => orden.push('preparar'),
      pasos: () => { orden.push('pasos'); return [{ id: 'p', texto: 'p' }] },
      limpiar: (a, tipo) => orden.push(`limpiar:${tipo}`),
      alEvento: (a, t) => { if (t === 'hecho') a.completarPaso('p') },
    })
    const oyente = vi.fn((tipo) => orden.push(`oyente:${tipo}`))
    g.escuchar(oyente)
    g.iniciar('x'); g.evento('hecho')
    g.iniciar('x'); g.abandonar()
    expect(orden).toEqual(['preparar', 'pasos', 'oyente:inicio', 'oyente:paso', 'limpiar:fin', 'oyente:fin',
      'preparar', 'pasos', 'oyente:inicio', 'limpiar:abandono', 'oyente:abandono'])
  })

  it('un error al limpiar no frena el aviso a los oyentes', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const g = new GestorActividades()
    g.registrar({ id: 'x', titulo: 'X', referencia: 10, pasos: () => [{ id: 'p', texto: 'p' }], limpiar: () => { throw new Error('x') }, alEvento() {} })
    const oyente = vi.fn()
    g.escuchar(oyente)
    g.iniciar('x'); g.abandonar()
    expect(oyente).toHaveBeenCalledWith('abandono', expect.anything(), undefined)
    err.mockRestore()
  })
})

function contenedores() {
  return CARGA_CARGUERO.map((c) => ({
    datos: { codigo: c.codigo, hueco: null }, posicion: new THREE.Vector3(), casa: new THREE.Vector3(), velocidad: new THREE.Vector3(1, 0, 0),
    malla: { quaternion: new THREE.Quaternion(0, 1, 0, 0) }, mano: null, libre: true, fijo: false,
  }))
}

describe('Descarga con variación (Sprint 03)', () => {
  it('sin variante es la de siempre; con variante cambia sobrante, faltante y manifiesto', () => {
    const d = new DescargaCarguero({ contenedores: contenedores(), escotilla: { bloqueada: false } })
    d.preparar()
    expect([d.sobrante, d.faltante, d.manifiesto]).toEqual([SOBRANTE, FALTANTE, [...MANIFIESTO].sort()])
    d.preparar({ sobrante: 'CNT-0002', faltante: 'CNT-0095' })
    expect(d.manifiesto).toEqual(['CNT-0001', 'CNT-0003', 'CNT-0004', 'CNT-0095'])
    expect(d.manifestado('CNT-0002')).toBe(false)
    expect(d.manifestado('CNT-0004')).toBe(true)
    // un faltante que en realidad llegó no vale: se usa el de siempre
    d.preparar({ sobrante: 'CNT-0001', faltante: 'CNT-0003' })
    expect(d.faltante).toBe(FALTANTE)
  })

  it('el escenario devuelve la carga a la bodega, suelta lo que estaba en la mano y traba la escotilla', () => {
    const cs = contenedores()
    const mano = { sostiene: cs[0] }
    cs[0].mano = mano
    const escotilla = { bloqueada: false }
    const d = new DescargaCarguero({ contenedores: cs, escotilla })
    const inventario = { retirar: vi.fn() }, amarres = { quitar: vi.fn() }
    const esc = crearEscenarios({ inventario, amarres, flotantes: { objetos: [] }, descarga: d, balance: null, filtro: null })
    esc.descarga.preparar({ sobrante: 'CNT-0003', faltante: 'CNT-0091' })
    expect(escotilla.bloqueada).toBe(true)
    expect(mano.sostiene).toBeNull()
    for (const f of cs) {
      expect(f.posicion.toArray()).toEqual(CARGA_CARGUERO.find((c) => c.codigo === f.datos.codigo).posicion)
      expect(f.fijo).toBe(true)
      expect(f.velocidad.length()).toBe(0)
    }
    esc.descarga.limpiar()
    expect(escotilla.bloqueada).toBe(false)
  })

  it('dos intentos seguidos cambian el contenedor sin manifestar y los pasos RFID lo excluyen', () => {
    const d = new DescargaCarguero({ contenedores: contenedores(), escotilla: { bloqueada: false } })
    const g = new GestorActividades()
    definirActividades(g, { inventario: { bultos: [], contenedores: [] }, inspecciones: { activar: () => {} }, descarga: d, semilla: 99 })
    const sobrantes = []
    for (let i = 0; i < 4; i++) {
      expect(g.iniciar('descarga')).toBe(true)
      const rfid = g.activa.pasos.filter((p) => p.id.startsWith('rfid:')).map((p) => p.id.slice(5))
      expect(rfid).toHaveLength(3)
      expect(rfid).not.toContain(d.sobrante)
      expect(rfid).not.toContain(d.faltante)
      sobrantes.push(d.sobrante)
      g.abandonar()
      expect(d.activa).toBe(false)                      // limpiar() terminó la descarga
    }
    for (let i = 1; i < sobrantes.length; i++) expect(sobrantes[i]).not.toBe(sobrantes[i - 1])
  })
})
