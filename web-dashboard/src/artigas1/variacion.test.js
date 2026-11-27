// B07 (Sprint 02): repetir Recepción o Conteo pide otro contenido; la misma semilla reproduce el mismo caso.
import { describe, expect, it } from 'vitest'
import { GestorActividades } from '../../public/artigas1/js/actividades.js'
import { definirActividades } from '../../public/artigas1/js/misiones.js'
import { crearAzar, elegirDistinto, mezclar } from '../../public/artigas1/js/variacion.js'

function inventario() {
  const bultos = []
  for (let i = 1; i <= 12; i++) bultos.push({ codigo: `B-CR-${String(i).padStart(2, '0')}`, legible: true, ubicacion: `CR01-A${i}` })
  // tres estanterías con 4 o más bultos y una con 2
  for (const [e, n] of [['RIV-E1', 6], ['RIV-E2', 5], ['RIV-E3', 4], ['RIV-E4', 2]]) {
    for (let i = 1; i <= n; i++) bultos.push({ codigo: `B-${e}-${i}`, legible: true, ubicacion: `${e}-A${i}` })
  }
  return { bultos, contenedores: [] }
}

function armar(semilla) {
  const g = new GestorActividades()
  definirActividades(g, { inventario: inventario(), inspecciones: { activar: () => {} }, semilla })
  return g
}

const jugar = (g, id) => { g.iniciar(id); const a = g.obtener(id); const r = { pasos: a.pasos.map((p) => p.id), datos: { ...a.datos } }; g.abandonar(); return r }

describe('B07 · variación entre intentos', () => {
  it('Recepción: dos intentos seguidos piden manifiestos distintos, siempre de cinco bultos del carguero', () => {
    const g = armar(42)
    let anterior = null
    for (let i = 0; i < 6; i++) {
      const r = jugar(g, 'recepcion')
      const bultos = r.pasos.filter((p) => p !== 'discrepancia')
      expect(bultos).toHaveLength(5)
      expect(new Set(bultos).size).toBe(5)
      expect(bultos.every((c) => c.startsWith('B-CR-'))).toBe(true)
      if (anterior) expect(bultos.join()).not.toBe(anterior)
      anterior = bultos.join()
    }
  })

  it('Conteo: cambia de estantería entre intentos y solo elige estanterías con 4 bultos o más', () => {
    const g = armar(7)
    let anterior = ''
    for (let i = 0; i < 6; i++) {
      const r = jugar(g, 'inventario')
      expect(['RIV-E1', 'RIV-E2', 'RIV-E3']).toContain(r.datos.estante)
      expect(r.pasos.length).toBeGreaterThanOrEqual(4)
      expect(r.datos.estante).not.toBe(anterior)
      anterior = r.datos.estante
    }
  })

  it('la misma semilla reproduce los mismos contenidos y deja la variante registrada', () => {
    const a = armar(1234), b = armar(1234)
    expect(jugar(a, 'recepcion')).toEqual(jugar(b, 'recepcion'))
    expect(jugar(a, 'inventario').datos.estante).toBe(jugar(b, 'inventario').datos.estante)
    expect(a.obtener('recepcion').datos.variante).toBe('1234-1')
  })

  it('utilidades: el generador es estable y mezclar no pierde elementos', () => {
    const r1 = crearAzar(5), r2 = crearAzar(5)
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()])
    const m = mezclar([1, 2, 3, 4, 5], crearAzar(9))
    expect([...m].sort()).toEqual([1, 2, 3, 4, 5])
    // si la mezcla repite la elección anterior, se cambia
    const id = (x) => String(x)
    for (let s = 0; s < 50; s++) {
      const e = elegirDistinto([1, 2, 3], 2, crearAzar(s), id, ['1', '2'])
      expect(e.map(id).sort().join()).not.toBe('1,2')
    }
  })
})

describe('B11 · ruta sugerida', () => {
  it('recomienda en orden y avanza a medida que se completan; no bloquea nada', () => {
    const g = new GestorActividades()
    const def = (id, extra = {}) => ({ id, titulo: id, referencia: 10, pasos: () => [{ id: 'p', texto: 'p' }], alEvento: (a, t) => { if (t === 'hecho') a.completarPaso('p') }, ...extra })
    for (const id of ['recepcion', 'almacenamiento', 'mantenimiento']) g.registrar(def(id))
    g.registrar(def('eva', { requiere: ['mantenimiento'] }))
    g.ruta = ['recepcion', 'almacenamiento', 'mantenimiento', 'eva']
    expect(g.recomendada().id).toBe('recepcion')
    // se puede hacer otra antes: la ruta solo sugiere
    expect(g.iniciar('almacenamiento')).toBe(true); g.evento('hecho')
    expect(g.recomendada().id).toBe('recepcion')
    g.iniciar('recepcion'); g.evento('hecho')
    expect(g.recomendada().id).toBe('mantenimiento')      // la EVA sigue bloqueada
    g.iniciar('mantenimiento'); g.evento('hecho')
    expect(g.recomendada().id).toBe('eva')
    g.iniciar('eva'); g.evento('hecho')
    expect(g.recomendada()).toBeNull()
  })

  it('las actividades reales traen la ruta del recorrido', () => {
    const g = armar(1)
    expect(g.ruta).toEqual(['recepcion', 'almacenamiento', 'inventario', 'mantenimiento', 'eva'])  // sin balance, descarga ni filtro en este mundo de prueba
    expect(g.recomendada().id).toBe('recepcion')
  })
})
