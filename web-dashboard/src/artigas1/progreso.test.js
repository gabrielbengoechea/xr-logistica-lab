// B15 (Sprint 03): progreso por estudiante, desde este visor y desde el backend.
import { describe, expect, it, vi } from 'vitest'
import { ESTADO, GestorActividades } from '../../public/artigas1/js/actividades.js'
import { CLAVE_PROGRESO, ProgresoLocal, combinar, progresoDelBackend, progresoDesdeEventos, puntajeDeDetalle } from '../../public/artigas1/js/progreso.js'

const almacen = () => { const m = new Map(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }

describe('B15 · progreso', () => {
  it('lee el puntaje del detalle que manda la telemetría y se queda con el mejor', () => {
    expect(puntajeDeDetalle('completada · 87 puntos · 140 s')).toBe(87)
    expect(puntajeDeDetalle('abandonada')).toBeNull()
    expect(puntajeDeDetalle('no superada · Se terminó el tiempo')).toBeNull()
    const ev = [
      { t: 1, type: 'activity_end', part: 'recepcion', detail: 'completada · 60 puntos · 90 s' },
      { t: 2, type: 'activity_end', part: 'recepcion', detail: 'completada · 91 puntos · 70 s' },
      { t: 3, type: 'activity_end', part: 'balance', detail: 'abandonada' },
      { t: 4, type: 'scan', part: 'B1' },
    ]
    expect(progresoDesdeEventos(ev)).toEqual({ recepcion: { mejor: 91 } })
    expect(combinar({ a: { mejor: 50 } }, { a: { mejor: 40 }, b: { mejor: 70 } })).toEqual({ a: { mejor: 50 }, b: { mejor: 70 } })
  })

  it('en el visor guarda por código, sin mezclar estudiantes, y se puede borrar', () => {
    const st = almacen()
    const p = new ProgresoLocal(st)
    p.guardar('101', 'recepcion', 70); p.guardar('101', 'recepcion', 65); p.guardar('202', 'balance', 80)
    expect(p.leer('101')).toEqual({ recepcion: { mejor: 70 } })
    expect(p.leer('202')).toEqual({ balance: { mejor: 80 } })
    expect(p.leer('303')).toEqual({})
    p.borrar('101')
    expect(p.leer('101')).toEqual({})
    expect(JSON.parse(st.getItem(CLAVE_PROGRESO))).toEqual({ 202: { balance: { mejor: 80 } } })
  })

  it('desde el backend: sesiones del código, sus eventos, y null si no hay backend', async () => {
    const pedir = vi.fn(async (url) => {
      if (url.endsWith('/api/v1/health')) return new Response('{"status":"ok"}')
      if (url.includes('/telemetry/sessions?')) {
        expect(url).toContain('student_id=101')
        expect(url).toContain('scenario=artigas1-web')
        return new Response(JSON.stringify({ sessions: [{ session_id: 'aaaaaaaa1', student_id: '101' }, { session_id: 'bbbbbbbb2', student_id: '101' }], total: 2 }))
      }
      if (url.includes('aaaaaaaa1')) return new Response(JSON.stringify([{ t: 1, type: 'activity_end', part: 'mantenimiento', detail: 'completada · 75 puntos · 200 s' }]))
      return new Response(JSON.stringify([{ t: 1, type: 'activity_end', part: 'recepcion', detail: 'completada · 88 puntos · 60 s' }]))
    })
    expect(await progresoDelBackend({ backend: 'http://aula:8000', codigo: '101', pedir })).toEqual({ mantenimiento: { mejor: 75 }, recepcion: { mejor: 88 } })
    expect(await progresoDelBackend({ backend: null, codigo: '101', pedir })).toBeNull()
    expect(await progresoDelBackend({ backend: 'http://x', codigo: '101', pedir: async () => { throw new TypeError('red') } })).toBeNull()
  })

  it('el gestor restaura lo completado, desbloquea lo que dependía y no toca la actividad en curso', () => {
    const g = new GestorActividades()
    const def = (id, extra = {}) => ({ id, titulo: id, referencia: 10, pasos: () => [{ id: 'p', texto: 'p' }], alEvento() {}, ...extra })
    g.registrar(def('mantenimiento')); g.registrar(def('recepcion')); g.registrar(def('eva', { requiere: ['mantenimiento'] }))
    const oyente = vi.fn(); g.escuchar(oyente)
    g.iniciar('recepcion')
    oyente.mockClear()
    expect(g.restaurar({ mantenimiento: { mejor: 75 }, recepcion: { mejor: 90 }, inexistente: { mejor: 1 } })).toBe(1)
    expect(g.obtener('mantenimiento').estado).toBe(ESTADO.COMPLETADA)
    expect(g.obtener('mantenimiento').resultado).toMatchObject({ completada: true, restaurado: true, puntaje: 75 })
    expect(g.obtener('eva').estado).toBe(ESTADO.DISPONIBLE)
    expect(g.obtener('recepcion').estado).toBe(ESTADO.ACTIVA)
    expect(oyente).not.toHaveBeenCalled()                       // sin eventos: no se manda telemetría falsa
  })
})
