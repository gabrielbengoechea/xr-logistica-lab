// Pruebas de las cuentas del minijuego B (balance de masas), las mismas que StationMass.cs de Unity.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { centroDeMasa, desvioLateral, mejorUbicacion } from '../../public/artigas1/js/balance.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

describe('balance de masas', () => {
  it('el centro de masa es el promedio pesado por la masa', () => {
    const cm = centroDeMasa([{ masa: 30, posicion: V(1, 0, 0) }, { masa: 10, posicion: V(-1, 0, 0) }])
    expect(cm.x).toBeCloseTo(0.5)
    expect(desvioLateral(V(0.3, 0.4, 7))).toBeCloseTo(0.5)   // el largo del módulo no cuenta
    expect(centroDeMasa([]).length()).toBe(0)
  })

  it('la mejor ubicación compensa la carga corrida y usa huecos distintos', () => {
    const base = { masa: 100, posicion: V(0.2, 0, 0) }           // 100 kg corridos 20 cm a estribor
    const huecos = [
      { codigo: 'E1', posicion: V(1.33, 0, 0) },
      { codigo: 'E2', posicion: V(1.33, 0.4, 0) },
      { codigo: 'B1', posicion: V(-1.33, 0, 0) },
      { codigo: 'B2', posicion: V(-1.33, 0.4, 0) },
      { codigo: 'B3', posicion: V(-1.33, -0.4, 0) },
    ]
    const r = mejorUbicacion(base, [10, 10], huecos)
    expect(new Set(r.huecos).size).toBe(2)
    expect(r.huecos.every((c) => c.startsWith('B'))).toBe(true)
    // con los dos a babor (−1,33 m) quedan 20 − 2·13,3 = −6,6 kg·m sobre 120 kg: unos 5 cm
    expect(r.desvio).toBeLessThan(0.06)
    // los dos a estribor es mucho peor
    const malo = Math.hypot((100 * 0.2 + 10 * 1.33 + 10 * 1.33) / 120, (10 * 0.4) / 120)
    expect(r.desvio).toBeLessThan(malo)
  })
})
