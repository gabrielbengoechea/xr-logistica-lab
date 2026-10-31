import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { INVENTARIO, fetchFalso } from '../test/datos'
import { Inventario } from './Inventario'

describe('Inventario', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('ubica cada componente en la planta con su estado en texto', async () => {
    vi.stubGlobal('fetch', fetchFalso({ '/api/v1/inventory': INVENTARIO }))
    render(<Inventario />)
    expect(await screen.findByRole('img', { name: /planta del depósito con 2 componentes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rack A1, En mantenimiento, zona A-Racks' })).toBeInTheDocument()
    expect(screen.getAllByText('En mantenimiento').length).toBeGreaterThan(0)
  })

  it('filtra por zona pidiéndole al backend', async () => {
    const user = userEvent.setup()
    const f = fetchFalso({ '/api/v1/inventory': INVENTARIO })
    vi.stubGlobal('fetch', f)
    render(<Inventario />)
    await screen.findByRole('img', { name: /planta/i })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Zona' }), 'Muelle')
    await waitFor(() => expect(f).toHaveBeenLastCalledWith('/api/v1/inventory?zone=Muelle', expect.anything()))
  })
})
