import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { INVENTARIO, MANIFEST, RESUMEN, SocketFalso, fetchFalso } from './test/datos'

vi.mock('./viewer/Escena3D', () => ({ Escena3D: () => <div data-testid="escena" /> }))

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', Object.assign(SocketFalso, { OPEN: 1 }))
    vi.stubGlobal(
      'fetch',
      fetchFalso({
        '/api/v1/telemetry/sessions': { sessions: [], total: 0 },
        '/api/v1/telemetry/summary': { ...RESUMEN, by_scenario: [], by_student: [] },
        '/api/v1/models/manifest': MANIFEST,
        '/api/v1/inventory': INVENTARIO,
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sin hash abre la portada de estudiantes y «Soy docente» lleva al tablero', async () => {
    const user = userEvent.setup()
    window.location.hash = ''
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Elegí a qué simulador entrar' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Soy docente' }))
    expect(await screen.findByText('Todavía no hay sesiones')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Panel docente' })).toHaveAttribute('aria-selected', 'true')
  })

  it('arranca en el panel docente con #panel y cambia de sección con las pestañas', async () => {
    const user = userEvent.setup()
    window.location.hash = '#panel'
    render(<App />)
    expect(await screen.findByText('Todavía no hay sesiones')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Inventario' }))
    expect(screen.getByRole('tab', { name: 'Inventario' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('img', { name: /planta del depósito/i })).toBeInTheDocument()
    expect(window.location.hash).toBe('#inventario')
    await user.click(screen.getByRole('tab', { name: 'Visor 3D' }))
    expect(await screen.findByRole('navigation', { name: 'Modelos' })).toBeInTheDocument()
  })
})

describe('App: el panel sigue escuchando', () => {
  beforeEach(() => {
    SocketFalso.todos = []
    vi.stubGlobal('WebSocket', Object.assign(SocketFalso, { OPEN: 1 }))
    vi.stubGlobal(
      'fetch',
      fetchFalso({
        '/api/v1/telemetry/sessions': { sessions: [], total: 0 },
        '/api/v1/telemetry/summary': { ...RESUMEN, by_scenario: [], by_student: [] },
        '/api/v1/models/manifest': MANIFEST,
        '/api/v1/inventory': INVENTARIO,
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lo que llega mientras se mira el inventario aparece al volver al panel', async () => {
    const user = userEvent.setup()
    window.location.hash = '#panel'
    render(<App />)
    await screen.findByText('Todavía no hay sesiones')
    await user.click(screen.getByRole('tab', { name: 'Inventario' }))
    const ws = SocketFalso.todos[0]!
    act(() => ws.abrir())
    act(() => ws.recibir({ kind: 'live_event', data: { session_id: 'sesion-ana-01', student_id: 'ana', scenario: 'cubesat', event: { t: 3, type: 'hint', part: null, target: null, detail: null } } }))
    await user.click(screen.getByRole('tab', { name: 'Panel docente' }))
    expect(screen.getByText(/Pidió una pista/)).toBeInTheDocument()
    expect(SocketFalso.todos).toHaveLength(1)
  })
})
