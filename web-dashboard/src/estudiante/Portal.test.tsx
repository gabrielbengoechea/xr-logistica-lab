import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Portal } from './Portal'
import { GRUPOS } from './simuladores'

describe('Portal de estudiantes', () => {
  it('muestra los simuladores agrupados, cada uno con su enlace para entrar', () => {
    render(<Portal />)
    expect(screen.getByRole('heading', { level: 1, name: 'Elegí a qué simulador entrar' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Recorrer un lugar',
      'Practicar una tarea',
      'Explorar sobre la mesa',
    ])
    const total = GRUPOS.reduce((n, g) => n + g.simuladores.length, 0)
    const enlaces = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('https://'))
    expect(enlaces).toHaveLength(total)
    const estiba = screen.getByRole('link', { name: 'Estiba' })
    expect(estiba).toHaveAttribute('href', 'https://gabrielbengoechea.github.io/Estiba-VR/')
    expect(within(estiba).getByRole('list', { name: 'Funciona en' })).toHaveTextContent('Celular')
    expect(screen.getByRole('link', { name: 'Soy docente' })).toHaveAttribute('href', '#panel')
  })

  it('filtra por el dispositivo con el que entra el estudiante', async () => {
    const user = userEvent.setup()
    render(<Portal />)
    await user.click(screen.getByRole('button', { name: 'Celular' }))
    expect(screen.getByRole('button', { name: 'Celular' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('link', { name: 'Terminal de Montevideo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Motor de avión' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Realidad aumentada' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cualquiera' }))
    expect(screen.getByRole('link', { name: 'Terminal de Montevideo' })).toBeInTheDocument()
  })

  it('cada simulador tiene su imagen en public/simuladores', async () => {
    const { existsSync } = await import('node:fs')
    for (const s of GRUPOS.flatMap((g) => g.simuladores)) {
      expect(existsSync(`public${s.imagen}`), s.imagen).toBe(true)
    }
  })
})
