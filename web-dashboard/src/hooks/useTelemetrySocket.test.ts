import { act, renderHook } from '@testing-library/react'
import { SocketFalso, RESUMEN } from '../test/datos'
import { esperaReintento, leerMensaje, useTelemetrySocket } from './useTelemetrySocket'

describe('useTelemetrySocket', () => {
  beforeEach(() => {
    SocketFalso.todos = []
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('lee solo los mensajes del contrato', () => {
    expect(leerMensaje(JSON.stringify({ kind: 'hello', data: RESUMEN }))?.kind).toBe('hello')
    expect(leerMensaje('pong')).toBeNull()
    expect(leerMensaje(JSON.stringify({ kind: 'otra_cosa', data: {} }))).toBeNull()
  })

  it('la espera entre reintentos crece con tope', () => {
    expect([0, 1, 2, 3, 10].map((n) => esperaReintento(n, 15000))).toEqual([1000, 2000, 4000, 8000, 15000])
  })

  it('pasa los mensajes, avisa el estado y se reconecta', () => {
    const recibidos: string[] = []
    const { result, unmount } = renderHook(() =>
      useTelemetrySocket((m) => recibidos.push(m.kind), { url: 'ws://x/ws/telemetry', crear: SocketFalso.crear }),
    )
    expect(result.current).toBe('conectando')
    act(() => SocketFalso.todos[0]!.abrir())
    expect(result.current).toBe('en-vivo')
    act(() => SocketFalso.todos[0]!.recibir({ kind: 'hello', data: RESUMEN }))
    act(() => SocketFalso.todos[0]!.recibir('pong'))
    expect(recibidos).toEqual(['hello'])

    act(() => vi.advanceTimersByTime(25_000))
    expect(SocketFalso.todos[0]!.enviados).toContain('ping')

    act(() => SocketFalso.todos[0]!.close())
    expect(result.current).toBe('reconectando')
    expect(SocketFalso.todos).toHaveLength(1)
    act(() => vi.advanceTimersByTime(1000))
    expect(SocketFalso.todos).toHaveLength(2)
    act(() => SocketFalso.todos[1]!.abrir())
    expect(result.current).toBe('en-vivo')

    unmount()
    expect(SocketFalso.todos[1]!.readyState).toBe(3)
    act(() => vi.advanceTimersByTime(60_000))
    expect(SocketFalso.todos).toHaveLength(2) // al desmontar no se reconecta
  })
})
