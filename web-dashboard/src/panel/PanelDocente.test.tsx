import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MANIFEST, RESUMEN, SocketFalso, fetchFalso, sesion } from '../test/datos'
import { PanelDocente } from './PanelDocente'

const RUTAS = {
  '/api/v1/telemetry/sessions': { sessions: [sesion(), sesion({ session_id: 'sesion-bruno-01', student_id: 'bruno', scenario: 'motor', finished: true, parts_placed: 4, metrics: { ...sesion().metrics, score: 86, completion: 1 } })], total: 2 },
  '/api/v1/telemetry/summary': RESUMEN,
  '/api/v1/models/manifest': MANIFEST,
  '/api/v1/telemetry/sessions/sesion-ana-01/events': [
    { t: 0, type: 'session_start', part: null, target: null, detail: null },
    { t: 12.5, type: 'snap_fail', part: 'Part_Placa_OBC', target: 'Snap_Ranura_EPS', detail: 'Esa pieza no va en este lugar' },
  ],
}

describe('Panel docente', () => {
  beforeEach(() => {
    SocketFalso.todos = []
    vi.stubGlobal('fetch', fetchFalso(RUTAS))
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-10-31T14:02:00Z') })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const montar = () => render(<PanelDocente opcionesSocket={{ url: 'ws://x', crear: SocketFalso.crear }} />)

  it('muestra las sesiones con su estado, el resumen y los gráficos por escenario', async () => {
    montar()
    const tabla = await screen.findByRole('table', { name: /sesiones de práctica/i })
    const filas = within(tabla).getAllByRole('row')
    expect(filas).toHaveLength(3)
    expect(within(tabla).getByText('Practicando')).toBeInTheDocument()
    expect(within(tabla).getByText('Terminada')).toBeInTheDocument()
    expect(within(tabla).getAllByText('CubeSat 1U').length).toBeGreaterThan(0)
    expect(screen.getByText('Puntaje promedio').nextSibling).toHaveTextContent('64')
    expect(screen.getByRole('figure', { name: /puntaje promedio \(0 a 100\)/i })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /resumen por alumno/i })).toBeInTheDocument()
  })

  it('suma al feed lo que llega en vivo y actualiza la fila con el informe nuevo', async () => {
    montar()
    await screen.findByRole('table', { name: /sesiones de práctica/i })
    const ws = SocketFalso.todos[0]!
    act(() => ws.abrir())
    expect(screen.getByText('Conectado en vivo')).toBeInTheDocument()
    act(() =>
      ws.recibir({
        kind: 'live_event',
        data: { session_id: 'sesion-ana-01', student_id: 'ana', scenario: 'cubesat', event: { t: 30, type: 'snap_fail', part: 'Part_Placa_OBC', target: 'Snap_Ranura_EPS', detail: 'Esa pieza no va en este lugar' } },
      }),
    )
    const feed = screen.getByRole('region', { name: 'En vivo' })
    expect(within(feed).getByText(/Error de encaje/)).toBeInTheDocument()
    expect(within(feed).getByLabelText('error')).toBeInTheDocument()

    act(() =>
      ws.recibir({ kind: 'session_saved', data: sesion({ parts_placed: 3, received_at: '2026-10-31T14:02:30Z', metrics: { ...sesion().metrics, score: 77, completion: 0.75 } }) }),
    )
    const tabla = screen.getByRole('table', { name: /sesiones de práctica/i })
    expect(within(tabla).getByText('3/4')).toBeInTheDocument()
    expect(within(tabla).getByText('77')).toBeInTheDocument()
  })

  it('al elegir una sesión muestra su línea de tiempo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    montar()
    await screen.findByRole('table', { name: /sesiones de práctica/i })
    await user.click(screen.getByRole('button', { name: 'ana' }))
    const detalle = await screen.findByRole('region', { name: 'Detalle de la sesión' })
    await waitFor(() => expect(within(detalle).getByText('Esa pieza no va en este lugar')).toBeInTheDocument())
    await user.click(within(detalle).getByRole('button', { name: /cerrar el detalle/i }))
    expect(screen.queryByRole('region', { name: 'Detalle de la sesión' })).not.toBeInTheDocument()
  })

  it('si el backend no responde lo dice y permite reintentar', async () => {
    vi.stubGlobal('fetch', fetchFalso(RUTAS, { '/api/v1/telemetry/sessions': 503 }))
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
