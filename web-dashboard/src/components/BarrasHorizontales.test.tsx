import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BarrasHorizontales } from './BarrasHorizontales'

describe('BarrasHorizontales', () => {
  const barras = [
    { clave: 'a', etiqueta: 'CubeSat', valor: 50, texto: '50', detalle: '3 sesiones' },
    { clave: 'b', etiqueta: 'Motor', valor: 100, texto: '100' },
  ]

  it('dibuja cada barra a escala con su valor rotulado', () => {
    const { container } = render(<BarrasHorizontales titulo="Puntaje" barras={barras} maximo={100} />)
    expect(screen.getByRole('figure', { name: 'Puntaje' })).toBeInTheDocument()
    const rellenos = container.querySelectorAll<HTMLSpanElement>('span.bg-serie')
    expect(rellenos[0]?.style.width).toBe('50%')
    expect(rellenos[1]?.style.width).toBe('100%')
    expect(screen.getByRole('button', { name: 'CubeSat: 50, 3 sesiones' })).toBeInTheDocument()
  })

  it('muestra el tooltip al pasar el mouse', async () => {
    const user = userEvent.setup()
    render(<BarrasHorizontales titulo="Puntaje" barras={barras} />)
    await user.hover(screen.getByRole('button', { name: /CubeSat/ }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('CubeSat50 · 3 sesiones')
    await user.unhover(screen.getByRole('button', { name: /CubeSat/ }))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
