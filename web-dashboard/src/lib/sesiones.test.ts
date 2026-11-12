import { ESTADO_INICIAL, MAX_FEED, aplicarMensaje, cargarSesiones, estadoSesion, sesionesOrdenadas } from './sesiones'
import { RESUMEN, sesion } from '../test/datos'

describe('estado del panel en vivo', () => {
  it('hello carga el resumen', () => {
    const e = aplicarMensaje(ESTADO_INICIAL, { kind: 'hello', data: RESUMEN })
    expect(e.resumen?.sessions).toBe(2)
    expect(e.resumenViejo).toBe(false)
  })

  it('session_saved actualiza la sesión, suma al feed y marca el resumen como viejo', () => {
    let e = cargarSesiones(ESTADO_INICIAL, [sesion()])
    const nueva = sesion({ parts_placed: 3, received_at: '2026-10-31T14:03:00Z', metrics: { ...sesion().metrics, score: 70 } })
    e = aplicarMensaje(e, { kind: 'session_saved', data: nueva }, '2026-10-31T14:03:00Z')
    expect(e.sesiones['sesion-ana-01']?.parts_placed).toBe(3)
    expect(e.feed[0]?.kind).toBe('informe')
    expect(e.resumenViejo).toBe(true)
  })

  it('un informe viejo no pisa a uno más nuevo', () => {
    let e = cargarSesiones(ESTADO_INICIAL, [sesion({ received_at: '2026-10-31T14:05:00Z', parts_placed: 4 })])
    e = cargarSesiones(e, [sesion({ received_at: '2026-10-31T14:01:00Z', parts_placed: 1 })])
    expect(e.sesiones['sesion-ana-01']?.parts_placed).toBe(4)
  })

  it('live_event va al feed (con tope) y cuenta como actividad', () => {
    let e = ESTADO_INICIAL
    for (let i = 0; i < MAX_FEED + 5; i++) {
      e = aplicarMensaje(
        e,
        { kind: 'live_event', data: { session_id: 'sesion-ana-01', student_id: 'ana', scenario: 'cubesat', event: { t: i, type: 'grab', part: 'Part_X', target: null, detail: null } } },
        '2026-10-31T14:02:00Z',
      )
    }
    expect(e.feed).toHaveLength(MAX_FEED)
    expect(e.feed[0]?.event?.t).toBe(MAX_FEED + 4)
    expect(e.actividad['sesion-ana-01']).toBe('2026-10-31T14:02:00Z')
  })

  it('activa, inactiva o terminada según la última actividad', () => {
    const s = sesion()
    const e = cargarSesiones(ESTADO_INICIAL, [s, sesion({ session_id: 'sesion-bruno', finished: true })])
    const t = Date.parse(s.received_at)
    expect(estadoSesion(e, s, t + 60_000)).toBe('activa')
    expect(estadoSesion(e, s, t + 5 * 60_000)).toBe('inactiva')
    expect(estadoSesion(e, e.sesiones['sesion-bruno']!, t)).toBe('terminada')
  })

  it('ordena por la actividad más reciente', () => {
    let e = cargarSesiones(ESTADO_INICIAL, [
      sesion({ session_id: 'vieja-000001', received_at: '2026-10-31T13:00:00Z' }),
      sesion({ session_id: 'nueva-000001', received_at: '2026-10-31T14:00:00Z' }),
    ])
    expect(sesionesOrdenadas(e).map((s) => s.session_id)).toEqual(['nueva-000001', 'vieja-000001'])
    e = aplicarMensaje(
      e,
      { kind: 'live_event', data: { session_id: 'vieja-000001', student_id: 'x', scenario: 'motor', event: { t: 1, type: 'grab', part: null, target: null, detail: null } } },
      '2026-10-31T14:10:00Z',
    )
    expect(sesionesOrdenadas(e)[0]?.session_id).toBe('vieja-000001')
  })
})
