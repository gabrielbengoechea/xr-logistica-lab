import { celdaGrilla } from './escala'

describe('grilla del visor', () => {
  it('se adapta al tamaño del modelo', () => {
    expect(celdaGrilla(0.6)).toEqual({ celda: 0.01, seccion: 0.1 })
    expect(celdaGrilla(4)).toEqual({ celda: 0.1, seccion: 1 })
    expect(celdaGrilla(114)).toEqual({ celda: 10, seccion: 100 })
  })
})
