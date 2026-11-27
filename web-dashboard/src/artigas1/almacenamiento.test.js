// B01 (Sprint 01): una actividad sin pasos no puede quedar ACTIVA ni bloquear el gestor, y Almacenamiento se
// puede repetir después de una partida completa. Se usan las definiciones reales de js/misiones.js con un
// inventario mínimo de seis contenedores.
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { ESTADO, GestorActividades } from '../../public/artigas1/js/actividades.js'
import { definirActividades } from '../../public/artigas1/js/misiones.js'

function contenedor(n) {
  const destino = `RIV-E1-A${n}`
  return {
    posicion: new THREE.Vector3(0, 0, -2 - n * 0.1), reposo: { posicion: new THREE.Vector3(0, 0, -2 - n * 0.1) }, mano: null,
    datos: { codigo: `CNT-000${n}`, destino, hueco: null, escaneado: false },
  }
}

function mundo({ conReacomodo = true } = {}) {
  const contenedores = [1, 2, 3, 4, 5, 6].map(contenedor)
  const inventario = { bultos: [{ codigo: 'B1', legible: true, ubicacion: 'RIV-E1-A1' }], contenedores }
  const reacomodar = vi.fn((lista) => { for (const f of lista) f.datos.hueco = null; return lista.length })
  const g = new GestorActividades()
  definirActividades(g, { inventario, inspecciones: { activar: () => {} }, ...(conReacomodo ? { reacomodarContenedores: reacomodar } : {}) })
  /** El jugador guarda y amarra cada contenedor de la actividad en curso. */
  const guardarTodo = () => {
    for (const p of [...g.activa.pasos]) {
      const f = contenedores.find((c) => c.datos.codigo === p.id)
      f.datos.hueco = { codigo: f.datos.destino }
      g.evento('amarrado', { codigo: f.datos.codigo, hueco: f.datos.destino, destino: f.datos.destino, correcto: true })
    }
  }
  return { g, contenedores, reacomodar, guardarTodo }
}

describe('B01 · gestor: actividades sin pasos', () => {
  it('no activa una actividad cuyos pasos vienen vacíos y deja libre el gestor', () => {
    const g = new GestorActividades()
    const eventos = []
    g.escuchar((tipo, a, dato) => eventos.push([tipo, a.id, dato]))
    g.registrar({ id: 'vacia', titulo: 'Vacía', pasos: () => [], alEvento() {}, referencia: 10, sinPasos: () => 'Nada para hacer' })
    g.registrar({ id: 'otra', titulo: 'Otra', pasos: () => [{ id: 'x', texto: 'X' }], alEvento() {}, referencia: 10 })
    expect(g.iniciar('vacia')).toBe(false)
    expect(g.obtener('vacia').estado).toBe(ESTADO.DISPONIBLE)
    expect(g.activa).toBeNull()
    expect(g.motivoNoInicio).toBe('Nada para hacer')
    expect(eventos).toEqual([['sin_pasos', 'vacia', 'Nada para hacer']])
    expect(g.iniciar('otra')).toBe(true)
    expect(g.activa.id).toBe('otra')
  })

  it('descarta pasos inválidos y, si no queda ninguno, tampoco la activa', () => {
    const g = new GestorActividades()
    g.registrar({ id: 'rota', titulo: 'Rota', pasos: () => [null, { texto: 'sin id' }, { id: '' }], alEvento() {}, referencia: 10 })
    expect(g.iniciar('rota')).toBe(false)
    expect(g.motivoNoInicio).toContain('no tiene tareas pendientes')
  })

  it('si armar los pasos falla, no queda activa', () => {
    const g = new GestorActividades()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    g.registrar({ id: 'falla', titulo: 'Falla', pasos: () => { throw new Error('x') }, alEvento() {}, referencia: 10 })
    expect(g.iniciar('falla')).toBe(false)
    expect(g.activa).toBeNull()
    err.mockRestore()
  })
})

describe('B01 · Almacenamiento repetido', () => {
  it('escenario original: con los seis contenedores en su hueco, repetir no deja el gestor trabado', () => {
    const { g, contenedores, reacomodar, guardarTodo } = mundo()
    // dos partidas completas: los seis quedan guardados
    for (let i = 0; i < 2; i++) {
      expect(g.iniciar('almacenamiento')).toBe(true)
      guardarTodo()
      expect(g.obtener('almacenamiento').estado).toBe(ESTADO.COMPLETADA)
    }
    expect(contenedores.every((c) => c.datos.hueco)).toBe(true)
    // tercera: antes devolvía true con cero pasos y quedaba ACTIVA para siempre
    expect(g.iniciar('almacenamiento')).toBe(true)
    const a = g.obtener('almacenamiento')
    expect(reacomodar).toHaveBeenCalledTimes(1)
    expect(a.pasos.length).toBe(3)
    expect(a.datos.reacomodados).toBe(3)
    guardarTodo()
    expect(a.estado).toBe(ESTADO.COMPLETADA)
    expect(g.activa).toBeNull()
    // las siguientes actividades siguen funcionando
    expect(g.iniciar('inventario')).toBe(true)
    expect(g.activa.id).toBe('inventario')
  })

  it('sin forma de reacomodar, informa que está completo y no la activa', () => {
    const { g, contenedores } = mundo({ conReacomodo: false })
    for (const c of contenedores) c.datos.hueco = { codigo: c.datos.destino }
    expect(g.iniciar('almacenamiento')).toBe(false)
    expect(g.obtener('almacenamiento').estado).toBe(ESTADO.DISPONIBLE)
    expect(g.motivoNoInicio).toMatch(/ya está completo/)
    expect(g.iniciar('inventario')).toBe(true)
  })

  it('no toca contenedores que alguien tiene en la mano', () => {
    const { g, contenedores, reacomodar } = mundo()
    for (const c of contenedores) { c.datos.hueco = { codigo: c.datos.destino }; c.mano = {} }
    expect(g.iniciar('almacenamiento')).toBe(false)
    expect(reacomodar).not.toHaveBeenCalled()
    expect(g.activa).toBeNull()
  })
})
