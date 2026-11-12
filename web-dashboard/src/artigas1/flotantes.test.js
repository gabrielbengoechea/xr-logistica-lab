// Pruebas de los objetos sueltos en microgravedad (public/artigas1/js/flotantes.js). Sin DOM ni WebXR.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Barandas } from '../../public/artigas1/js/barandas.js'
import { SistemaColisiones } from '../../public/artigas1/js/colisiones.js'
import { PARAMETROS_FLOTANTES, SistemaFlotantes } from '../../public/artigas1/js/flotantes.js'

const I = new THREE.Matrix4()
const caja = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1))
const LEJOS = new THREE.Vector3(0, 0, 0)
const QUIETO = new THREE.Vector3()

/** Módulo de 2,4 x 2,4 x 6 m (eje Z) hecho con seis paredes de 10 cm. */
function modulo() {
  const s = new SistemaColisiones(0.5)
  s.agregarCaja(caja(1.2, -1.3, -3.1, 1.3, 1.3, 3.1), I)
  s.agregarCaja(caja(-1.3, -1.3, -3.1, -1.2, 1.3, 3.1), I)
  s.agregarCaja(caja(-1.3, 1.2, -3.1, 1.3, 1.3, 3.1), I)
  s.agregarCaja(caja(-1.3, -1.3, -3.1, 1.3, -1.2, 3.1), I)
  s.agregarCaja(caja(-1.3, -1.3, 3.0, 1.3, 1.3, 3.1), I)
  s.agregarCaja(caja(-1.3, -1.3, -3.1, 1.3, 1.3, -3.0), I)
  return s.construir()
}

function sistema(pasillos = []) {
  const col = modulo()
  return new SistemaFlotantes({ colisionadores: () => [col], pasillos })
}

function objeto(sis, x, y, z, radio = 0.08) {
  const malla = new THREE.Object3D()
  malla.position.set(x, y, z)
  return sis.agregar(malla, radio)
}

const avanzar = (sis, segundos, cuerpo = [], vCuerpo = QUIETO, manos = [], dt = 1 / 72) => {
  for (let t = 0; t < segundos; t += dt) {
    sis.gestionarManos(dt, manos)
    sis.actualizar(dt, LEJOS, cuerpo, vCuerpo, manos)
  }
}

describe('objetos flotantes', () => {
  it('derivan y giran despacio: ni clavados ni disparados', () => {
    const sis = sistema()
    const f = objeto(sis, 0.6, 0.3, 0)
    const q0 = f.malla.quaternion.clone()
    const p0 = f.posicion.clone()
    let vMax = 0
    for (let i = 0; i < 60 * 72; i++) {
      sis.actualizar(1 / 72, LEJOS, [], QUIETO)
      vMax = Math.max(vMax, f.velocidad.length())
    }
    expect(vMax).toBeLessThan(0.05)                              // menos de 5 cm/s
    expect(f.posicion.distanceTo(p0)).toBeGreaterThan(0.005)     // se movió
    expect(f.posicion.distanceTo(p0)).toBeLessThan(PARAMETROS_FLOTANTES.correa + 0.3)
    expect(f.malla.quaternion.angleTo(q0)).toBeGreaterThan(0.05) // giró
  })

  it('no atraviesan las paredes aunque los lancen fuerte', () => {
    const sis = sistema()
    const f = objeto(sis, 0, 0.3, 0)
    f.velocidad.set(2.5, 0.4, 1.0)
    f.libre = true
    let xMax = -9
    for (let i = 0; i < 4 * 72; i++) {
      sis.actualizar(1 / 72, LEJOS, [], QUIETO)
      xMax = Math.max(xMax, f.posicion.x)
      expect(Math.abs(f.posicion.x)).toBeLessThanOrEqual(1.2 - f.radio + 0.01)
      expect(Math.abs(f.posicion.y)).toBeLessThanOrEqual(1.2 - f.radio + 0.01)
      expect(Math.abs(f.posicion.z)).toBeLessThanOrEqual(3.0 - f.radio + 0.01)
    }
    expect(xMax).toBeGreaterThan(1.0)                            // llegó a la pared y rebotó
  })

  it('un cuadro largo (50 ms) tampoco los deja pasar', () => {
    const sis = sistema()
    const f = objeto(sis, 0.9, 0, 0, 0.04)
    f.velocidad.set(2.5, 0, 0)
    f.libre = true
    for (let i = 0; i < 40; i++) sis.actualizar(0.05, LEJOS, [], QUIETO)
    expect(f.posicion.x).toBeLessThanOrEqual(1.2 - f.radio + 0.01)
  })

  it('la ventilación los saca del eje de paso', () => {
    const eje = [{ a: new THREE.Vector3(0, 0, -3), b: new THREE.Vector3(0, 0, 3) }]
    const sis = sistema(eje)
    const f = objeto(sis, 0.05, 0.02, 0.5)
    f.velocidad.set(0, 0, 0)
    avanzar(sis, 90)
    expect(Math.hypot(f.posicion.x, f.posicion.y)).toBeGreaterThan(PARAMETROS_FLOTANTES.radioPasillo)
  })

  it('el cuerpo los empuja y nunca quedan adentro del astronauta', () => {
    const sis = sistema()
    const f = objeto(sis, 0.3, 0, 0)
    f.velocidad.set(0, 0, 0)
    const cuerpo = [{ centro: new THREE.Vector3(-0.3, 0, 0), radio: 0.2 }]
    const v = new THREE.Vector3(0.8, 0, 0)
    for (let i = 0; i < 72; i++) {                               // el astronauta avanza 0,8 m hacia el objeto
      cuerpo[0].centro.x += v.x / 72
      sis.actualizar(1 / 72, LEJOS, cuerpo, v)
      expect(f.posicion.distanceTo(cuerpo[0].centro)).toBeGreaterThanOrEqual(0.2 + f.radio - 1e-6)
    }
    expect(f.velocidad.x).toBeGreaterThan(0.5)                   // salió despedido hacia adelante
    expect(f.libre).toBe(true)
  })

  it('se toman con la mano cerrada y salen con la velocidad de la mano', () => {
    const sis = sistema()
    const f = objeto(sis, 0.5, 0.2, 0)
    const mano = { posicion: new THREE.Vector3(0.5, 0.2, 0.12), cerrada: false, agarre: null }
    avanzar(sis, 0.1, [], QUIETO, [mano])
    expect(mano.cercaObjeto).toBe(true)
    mano.cerrada = true
    avanzar(sis, 1 / 72, [], QUIETO, [mano])
    expect(mano.sostiene).toBe(f)
    const desfase = f.posicion.clone().sub(mano.posicion)
    for (let i = 0; i < 20; i++) {                               // la mano se mueve a 0,72 m/s hacia -X
      mano.posicion.x -= 0.01
      avanzar(sis, 1 / 72, [], QUIETO, [mano])
    }
    expect(f.posicion.clone().sub(mano.posicion).distanceTo(desfase)).toBeLessThan(1e-6)
    mano.cerrada = false
    avanzar(sis, 1 / 72, [], QUIETO, [mano])
    expect(mano.sostiene).toBeNull()
    expect(f.velocidad.x).toBeCloseTo(-0.72, 1)
    expect(f.libre).toBe(true)
  })

  it('la baranda tiene prioridad: con una al alcance, la mano no toma el objeto', () => {
    const sis = sistema()
    const f = objeto(sis, 0.5, 0.2, 0)
    const barandas = new Barandas()
    barandas.segmentos.push({ a: new THREE.Vector3(0.5, 0.3, -0.5), b: new THREE.Vector3(0.5, 0.3, 0.5), nombre: 'prueba' })
    const mano = { posicion: new THREE.Vector3(0.5, 0.25, 0.1), cerrada: true, agarre: null }
    sis.gestionarManos(1 / 72, [{ ...mano, cerrada: false }], barandas)
    sis.gestionarManos(1 / 72, [mano], barandas)
    expect(mano.sostiene ?? null).toBeNull()
    expect(f.mano).toBeNull()
  })

  it('lejos de la cabeza no se calculan ni se dibujan', () => {
    const sis = sistema()
    const f = objeto(sis, 0.5, 0.2, 0)
    const p0 = f.posicion.clone()
    for (let i = 0; i < 72; i++) sis.actualizar(1 / 72, new THREE.Vector3(0, 0, 40), [], QUIETO)
    expect(f.posicion.equals(p0)).toBe(true)
    expect(f.malla.visible).toBe(false)
    expect(sis.activos).toBe(0)
  })
})
