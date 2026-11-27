// B28 (Sprint 03): órbita acelerada en la Cúpula.
import { describe, expect, it } from 'vitest'
import { FACTOR_ORBITA, PERIODO_ORBITA_MIN, SEGUNDOS_POR_VUELTA, SOL, direccionSol } from '../../public/artigas1/js/entorno.js'

describe('B28 · órbita acelerada', () => {
  it('92 minutos en 30 segundos', () => {
    expect(FACTOR_ORBITA).toBe(Math.round(PERIODO_ORBITA_MIN * 60 / SEGUNDOS_POR_VUELTA))
    expect(FACTOR_ORBITA).toBe(184)
  })
  it('el sol da la vuelta alrededor del eje norte-sur y vuelve al atardecer de siempre', () => {
    expect(direccionSol(0).distanceTo(SOL)).toBeLessThan(1e-9)
    expect(direccionSol(Math.PI * 2).distanceTo(SOL)).toBeLessThan(1e-9)
    const medio = direccionSol(Math.PI)
    expect(medio.z).toBeCloseTo(SOL.z, 9)                    // el componente norte-sur no cambia
    expect(medio.x).toBeCloseTo(-SOL.x, 9)
    expect(medio.y).toBeCloseTo(-SOL.y, 9)
    expect(direccionSol(1.234).length()).toBeCloseTo(1, 9)
  })
})
