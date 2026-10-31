import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MANIFEST, fetchFalso } from '../test/datos'
import { Visor } from './Visor'

// La escena WebGL no corre en jsdom: se reemplaza por marcas que dicen qué se pidió dibujar.
vi.mock('./Escena3D', () => ({
  Escena3D: ({ children }: { children: React.ReactNode }) => <div data-testid="escena">{children}</div>,
}))
vi.mock('./ModeloGLB', () => ({
  ModeloGLB: ({ url, factor }: { url: string; factor: number }) => <div data-testid="modelo" data-url={url} data-factor={factor} />,
}))

describe('Visor 3D', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchFalso({ '/api/v1/models/manifest': MANIFEST })))
  afterEach(() => vi.unstubAllGlobals())

  it('carga el primer modelo del manifest y lo despieza desde la ficha', async () => {
    const user = userEvent.setup()
    render(<Visor />)
    const modelo = await screen.findByTestId('modelo')
    expect(modelo).toHaveAttribute('data-url', '/models/glb/cubesat.glb')
    await user.click(screen.getByRole('button', { name: 'Despiezar' }))
    expect(screen.getByTestId('modelo')).toHaveAttribute('data-factor', '1')
  })

  it('avisa si faltan los archivos de un modelo', async () => {
    const user = userEvent.setup()
    render(<Visor />)
    await screen.findByTestId('modelo')
    await user.click(screen.getByRole('button', { name: /Motor trifásico/ }))
    expect(screen.getByText(/faltan los archivos/i)).toBeInTheDocument()
    expect(screen.queryByTestId('modelo')).not.toBeInTheDocument()
  })
})

describe('Visor 3D: modelos de los proyectos', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchFalso({ '/api/v1/models/manifest': MANIFEST })))
  afterEach(() => vi.unstubAllGlobals())

  it('agrupa los modelos por proyecto y muestra la ficha del robot con su RA', async () => {
    const user = userEvent.setup()
    render(<Visor />)
    const nav = await screen.findByRole('navigation', { name: 'Modelos' })
    expect(within(nav).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Laboratorio', 'Terminal portuaria', 'Brazo robótico (RA)'])
    await user.click(within(nav).getByRole('button', { name: /Brazo robótico de 6 ejes/ }))
    expect(screen.getByTestId('modelo')).toHaveAttribute('data-url', '/models/proyectos/robot/robot-6-ejes.glb')
    expect(screen.getByText(/Origen: quest-xr-pilotos/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /usdz/i })).toHaveAttribute('href', '/models/proyectos/robot/robot-6-ejes.usdz')
    expect(screen.queryByRole('link', { name: /fbx/i })).not.toBeInTheDocument()
    expect(screen.getByText('Masa').nextSibling).toHaveTextContent('—') // masa desconocida
  })

  it('un modelo sin piezas no ofrece vista explotada', async () => {
    const user = userEvent.setup()
    render(<Visor />)
    await user.click(await screen.findByRole('button', { name: /Contenedor ISO de 40'/ }))
    expect(screen.getByText(/no tiene vista explotada/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Despiezar' })).not.toBeInTheDocument()
  })
})
