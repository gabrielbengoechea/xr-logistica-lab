// Pruebas de lo agregado en el pulido de Artigas-1 que no necesita navegador: ubicación de los carteles, tablet
// del mapa mirando a los ojos y el trinquete de los contenedores. El juego completo se prueba en Chrome con
// artigas1-vr/Tools/pruebas-web/juego.py.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { PARAMETROS_AVISO, distanciaCartel, distanciaLibre } from '../../public/artigas1/js/avisos.js'
import { poseTabletMirandoALosOjos } from '../../public/artigas1/js/mapa.js'
import { ALCANCE_TRINQUETE, Amarres, DIENTES } from '../../public/artigas1/js/amarre.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

/** Pared plana en z = zPared (todo lo que esté a menos de `maxDist` del plano la toca). */
const pared = (zPared) => ({
  activo: true,
  puntoMasCercano: (p, maxDist, out) => {
    const d = Math.abs(p.z - zPared)
    if (d > maxDist) return Infinity
    out.set(p.x, p.y, zPared)
    return d
  },
})

describe('carteles', () => {
  it('sin obstáculos quedan a la distancia cómoda', () => {
    const libre = distanciaLibre([], V(0, 0, 0), V(0, 0, -1), 1.2)
    expect(libre).toBe(1.2)
    expect(distanciaCartel(libre)).toBe(PARAMETROS_AVISO.distancia)
  })

  it('con una pared cerca quedan antes de la pared, nunca más cerca que el mínimo', () => {
    const libre = distanciaLibre([pared(-0.7)], V(0, 0, 0), V(0, 0, -1), 1.2)
    expect(libre).toBeLessThan(0.7)
    expect(distanciaCartel(libre)).toBeLessThan(0.7)
    expect(distanciaCartel(0.1)).toBe(PARAMETROS_AVISO.minima)
  })
})

describe('tablet del mapa en la mano', () => {
  const cabeza = V(0, 0, 0)
  const arriba = V(0, 1, 0)

  it('mira a los ojos desde cualquier posición de la mano', () => {
    for (const mano of [V(-0.2, -0.35, -0.3), V(-0.4, -0.1, -0.25), V(-0.1, -0.5, -0.15)]) {
      const m = poseTabletMirandoALosOjos(mano, cabeza, arriba, 'left')
      const centro = V(0, 0, 0).setFromMatrixPosition(m)
      const normal = V(0, 0, 1).transformDirection(m)
      expect(normal.dot(cabeza.clone().sub(centro).normalize())).toBeGreaterThan(0.995)   // menos de 6° de desvío
      // no se ladea: su borde de abajo es horizontal
      expect(Math.abs(V(1, 0, 0).transformDirection(m).dot(arriba))).toBeLessThan(1e-6)
      // la mano queda en el borde: a media tablet del centro
      expect(centro.distanceTo(mano)).toBeLessThan(0.2)
    }
  })

  it('con la mano izquierda se extiende hacia la derecha (el centro del cuerpo)', () => {
    const mano = V(-0.2, -0.35, -0.3)
    const izq = V(0, 0, 0).setFromMatrixPosition(poseTabletMirandoALosOjos(mano, cabeza, arriba, 'left'))
    const der = V(0, 0, 0).setFromMatrixPosition(poseTabletMirandoALosOjos(mano, cabeza, arriba, 'right'))
    expect(izq.x).toBeGreaterThan(mano.x)
    expect(der.x).toBeLessThan(mano.x)
  })
})

describe('trinquete', () => {
  const contenedor = () => {
    const malla = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.4))
    malla.position.set(0.9, 0, -2)
    return { malla, posicion: malla.position, mano: null, datos: { codigo: 'CT-01' } }
  }
  const mano = (posicion) => ({ posicion, sostiene: null, ocupada: false, gatilloUsado: false, gatilloNuevo: true })

  it('apoyado queda flojo; con los dientes necesarios queda amarrado una sola vez', () => {
    const a = new Amarres()
    const f = contenedor()
    let amarrados = 0
    a.alAmarrar = () => amarrados++
    a.apoyar(f)
    expect(f.datos.amarre.amarrado).toBe(false)
    const p = a.posicionTrinquete(f)
    // el trinquete está del lado del pasillo (más cerca del eje de la estación)
    expect(Math.hypot(p.x, p.y)).toBeLessThan(Math.hypot(f.posicion.x, f.posicion.y))
    for (let i = 0; i < DIENTES + 2; i++) {
      const m = mano(p.clone())
      a.actualizar(1 / 72, [m])
      if (i < DIENTES) expect(m.gatilloUsado).toBe(true)
    }
    expect(f.datos.amarre.amarrado).toBe(true)
    expect(f.datos.amarre.dientes).toBe(DIENTES)
    expect(amarrados).toBe(1)
  })

  it('lejos del trinquete, con una herramienta en la mano o sacado del hueco, el gatillo no amarra', () => {
    const a = new Amarres()
    const f = contenedor()
    a.apoyar(f)
    const p = a.posicionTrinquete(f)
    a.actualizar(1 / 72, [mano(p.clone().add(V(ALCANCE_TRINQUETE + 0.05, 0, 0)))])
    a.actualizar(1 / 72, [{ ...mano(p.clone()), sostiene: {} }])
    expect(f.datos.amarre.dientes).toBe(0)
    a.quitar(f)
    a.actualizar(1 / 72, [mano(p.clone())])
    expect(f.datos.amarre.dientes).toBe(0)
  })
})
