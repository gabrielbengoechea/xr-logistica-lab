import { render, screen } from '@testing-library/react'
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
