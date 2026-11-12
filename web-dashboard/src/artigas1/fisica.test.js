// Pruebas de la física del recorrido de Artigas-1 (public/artigas1/js): colisiones y locomoción en 0G.
// Son módulos sin DOM ni WebXR, así que corren acá con Vitest.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Barandas } from '../../public/artigas1/js/barandas.js'
import { SistemaColisiones, puntoMasCercanoEnTriangulo } from '../../public/artigas1/js/colisiones.js'
import { Locomocion0G, PARAMETROS, responderChoque } from '../../public/artigas1/js/locomocion.js'

const I = new THREE.Matrix4()
const caja = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1))

/** Habitación de 4 x 2,4 x 2,4 m hecha con seis paredes de 10 cm. */
function habitacion() {
  const s = new SistemaColisiones(0.5)
  s.agregarCaja(caja(2, -1.3, -1.3, 2.1, 1.3, 1.3), I)
  s.agregarCaja(caja(-2.1, -1.3, -1.3, -2, 1.3, 1.3), I)
  s.agregarCaja(caja(-2.1, 1.2, -1.3, 2.1, 1.3, 1.3), I)
  s.agregarCaja(caja(-2.1, -1.3, -1.3, 2.1, -1.2, 1.3), I)
  s.agregarCaja(caja(-2.1, -1.3, 1.2, 2.1, 1.3, 1.3), I)
  s.agregarCaja(caja(-2.1, -1.3, -1.3, 2.1, 1.3, -1.2), I)
  return s.construir()
}

function astronauta(sistema, barandas = new Barandas()) {
  const rig = new THREE.Group()
  const cabeza = new THREE.Object3D()
  rig.add(cabeza)
  const loco = new Locomocion0G({ rig, cabeza, colisionadores: () => [sistema], estructura: sistema, barandas })
  return { rig, loco }
}

const CERO = new THREE.Vector3()

describe('colisiones', () => {
  it('encuentra el punto más cercano en cara, arista y vértice', () => {
    const t = [0, 0, 0, 1, 0, 0, 0, 1, 0]
    const cerca = (p, x, y, z) => {
      expect(p.x).toBeCloseTo(x, 6)
      expect(p.y).toBeCloseTo(y, 6)
      expect(p.z).toBeCloseTo(z, 6)
    }
    cerca(puntoMasCercanoEnTriangulo(0.2, 0.2, 1, ...t), 0.2, 0.2, 0)
    cerca(puntoMasCercanoEnTriangulo(0.5, -1, 0, ...t), 0.5, 0, 0)
    cerca(puntoMasCercanoEnTriangulo(-1, -1, 0, ...t), 0, 0, 0)
  })

  it('saca una esfera de adentro de una pared y devuelve la normal', () => {
    const s = habitacion()
    const c = new THREE.Vector3(1.9, 0, 0)
    expect(s.resolverEsfera(c, 0.2)).toBe(true)
    expect(c.x).toBeCloseTo(1.8, 4)
    expect(s.normalesContacto[0].x).toBeCloseTo(-1, 4)
    expect(s.resolverEsfera(new THREE.Vector3(0, 0, 0), 0.2)).toBe(false)
  })

  it('no resuelve nada cuando está inactivo (escotilla abierta)', () => {
    const s = habitacion()
    s.activo = false
    expect(s.resolverEsfera(new THREE.Vector3(1.95, 0, 0), 0.2)).toBe(false)
  })
})

describe('locomoción en 0G', () => {
  it('el choque devuelve una fracción de la velocidad normal y conserva la tangencial', () => {
    const v = new THREE.Vector3(1, 0, 1)
    responderChoque(v, new THREE.Vector3(-1, 0, 0))
    expect(v.x).toBeCloseTo(-PARAMETROS.restitucion, 5)
    expect(v.z).toBeCloseTo(1 - PARAMETROS.friccionContacto, 5)
    const lento = new THREE.Vector3(0.1, 0, 0)
    responderChoque(lento, new THREE.Vector3(-1, 0, 0))
    expect(lento.x).toBeCloseTo(0, 6)
  })

  it('conserva la velocidad sin empuje y frena con el freno', () => {
    const { loco } = astronauta(habitacion())
    for (let i = 0; i < 36; i++) loco.actualizar(1 / 72, [], new THREE.Vector3(1, 0, 0), false)
    const v0 = loco.velocidad.length()
    expect(v0).toBeGreaterThan(0.5)
    for (let i = 0; i < 36; i++) loco.actualizar(1 / 72, [], CERO, false)
    expect(loco.velocidad.length()).toBeGreaterThan(v0 * 0.97)
    for (let i = 0; i < 144; i++) loco.actualizar(1 / 72, [], CERO, true)
    expect(loco.velocidad.length()).toBe(0)
  })

  it.each([0.5, 3, 30])('no atraviesa la pared a %s m/s, ni con cuadros de 50 ms', (v) => {
    for (const dt of [1 / 72, 0.05]) {
      const { rig, loco } = astronauta(habitacion())
      loco.velocidad.set(v, 0.3 * v, 0)
      let max = 0
      for (let t = 0; t < 4; t += dt) {
        loco.actualizar(dt, [], CERO, false)
        max = Math.max(max, Math.abs(rig.position.x), Math.abs(rig.position.y), Math.abs(rig.position.z))
      }
      expect(max).toBeLessThanOrEqual(2 - PARAMETROS.radioCabeza + 0.01)
    }
  })

  it('toma una baranda, el cuerpo sigue a la mano y al soltar sale con ese impulso', () => {
    const barandas = new Barandas()
    barandas.segmentos.push({ a: new THREE.Vector3(-0.5, 0.5, 0.3), b: new THREE.Vector3(0.5, 0.5, 0.3), nombre: 'prueba' })
    const { rig, loco } = astronauta(habitacion(), barandas)
    const mano = { posicion: new THREE.Vector3(0, 0.5, 0.3), cerrada: true, agarre: null }
    loco.actualizar(1 / 72, [mano], CERO, false)
    expect(mano.agarre?.tipo).toBe('baranda')
    for (let i = 0; i < 20; i++) {
      mano.posicion.copy(mano.agarre.ancla).x -= 0.01 // la mano tira 1 cm por cuadro
      loco.actualizar(1 / 72, [mano], CERO, false)
    }
    expect(rig.position.x).toBeCloseTo(0.2, 3)
    mano.cerrada = false
    loco.actualizar(1 / 72, [mano], CERO, false)
    expect(loco.velocidad.x).toBeCloseTo(0.72, 2)
  })

  it('se apoya en una pared si no hay baranda, y no toma nada en el aire', () => {
    const { loco } = astronauta(habitacion())
    const pared = { posicion: new THREE.Vector3(1.95, 0, 0), cerrada: true, agarre: null }
    const aire = { posicion: new THREE.Vector3(0, 0, 0), cerrada: true, agarre: null }
    loco.actualizar(1 / 72, [pared, aire], CERO, false)
    expect(pared.agarre?.tipo).toBe('apoyo')
    expect(aire.agarre).toBeNull()
  })
})
