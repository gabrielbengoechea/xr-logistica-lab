import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CUBESAT } from '../test/datos'
import { FichaActivo } from './FichaActivo'

describe('FichaActivo', () => {
  function montar(despiece = 0) {
    const props = {
      activo: CUBESAT,
      despiece,
      alCambiarDespiece: vi.fn(),
      mostrarEncajes: false,
      alMostrarEncajes: vi.fn(),
      resaltada: null,
      alResaltar: vi.fn(),
      elegida: null,
    }
    render(<FichaActivo {...props} />)
    return props
  }

  it('muestra los datos del activo, las piezas y los archivos', () => {
    montar()
    expect(screen.getByRole('heading', { name: 'CubeSat 1U' })).toBeInTheDocument()
    expect(screen.getByText('2 · 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Computadora de a bordo/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /glb/i })).toHaveAttribute('href', '/models/glb/cubesat.glb')
  })

  it('despieza, mueve el deslizador, muestra encajes y resalta piezas', async () => {
    const user = userEvent.setup()
    const p = montar()
    await user.click(screen.getByRole('button', { name: 'Despiezar' }))
    expect(p.alCambiarDespiece).toHaveBeenCalledWith(1)
    await user.click(screen.getByRole('checkbox', { name: /mostrar los encajes/i }))
    expect(p.alMostrarEncajes).toHaveBeenCalledWith(true)
    await user.hover(screen.getByRole('button', { name: /Computadora de a bordo/ }))
    expect(p.alResaltar).toHaveBeenCalledWith('Part_Placa_OBC')
  })

  it('con el conjunto despiezado el botón vuelve a armar', async () => {
    const user = userEvent.setup()
    const p = montar(1)
    await user.click(screen.getByRole('button', { name: 'Armar' }))
    expect(p.alCambiarDespiece).toHaveBeenCalledWith(0)
    expect(screen.getByRole('slider')).toHaveValue('100')
  })
})
