// B17 (Sprint 02): torso oculto al mirar abajo en la Cúpula y vista hacia la estación al salir a la EVA.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { giroHacia, torsoOcultoEnCupula } from '../../public/artigas1/js/vista.js'

describe('B17 · vista', () => {
  it('el torso se oculta solo en la Cúpula y al mirar a los pies, con histéresis', () => {
    expect(torsoOcultoEnCupula(false, -0.9, false)).toBe(false)
    expect(torsoOcultoEnCupula(true, 0, false)).toBe(false)
    expect(torsoOcultoEnCupula(true, -0.7, false)).toBe(true)
    expect(torsoOcultoEnCupula(true, -0.5, true)).toBe(true)      // en la franja intermedia conserva el estado
    expect(torsoOcultoEnCupula(true, -0.5, false)).toBe(false)
    expect(torsoOcultoEnCupula(true, -0.3, true)).toBe(false)
  })

  it('giroHacia: girar ese ángulo deja la mirada horizontal apuntando al objetivo', () => {
    const arriba = new THREE.Vector3(0, 1, 0)
    for (const [mira, hacia] of [[[1, 0, 0], [0, 0, -1]], [[1, -0.3, 0], [-1, 0.2, 0.1]], [[0, 0, 1], [0.5, 0, 0.5]]]) {
      const m = new THREE.Vector3(...mira), h = new THREE.Vector3(...hacia)
      const a = giroHacia(m, h, arriba)
      m.applyAxisAngle(arriba, a)
      const mh = m.setY(0).normalize(), hh = h.setY(0).normalize()
      expect(mh.dot(hh)).toBeGreaterThan(0.9999)
    }
    expect(giroHacia(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), arriba)).toBe(0)   // mirando arriba: no se gira
  })
})
