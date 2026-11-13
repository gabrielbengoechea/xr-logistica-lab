// Pruebas de la lógica de juego de Artigas-1 que no necesita navegador: gestor de actividades, cable de
// seguridad, brazos (cinemática inversa) y lectura del escáner. El juego completo se prueba en Chrome con
// artigas1-vr/Tools/pruebas-web/juego.py.
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ESTADO, GestorActividades, formatoTiempo, puntaje } from '../../public/artigas1/js/actividades.js'
import { PARAMETROS_EVA, TetherSystem } from '../../public/artigas1/js/eva.js'
import { Inventario, rayoCaja } from '../../public/artigas1/js/inventario.js'
import { CUERPO, POSES, capsulaEntre, cinematicaMano, codo } from '../../public/artigas1/js/manos.js'

const V = (x, y, z) => new THREE.Vector3(x, y, z)

function gestor() {
  const g = new GestorActividades()
  const def = (id, extra = {}) => ({
    id, titulo: id, modulo: 'rivera', concepto: '', instrucciones: '', referencia: 60,
    pasos: () => [{ id: 'a', texto: 'A' }, { id: 'b', texto: 'B' }],
    alEvento(a, tipo, d) {
      if (tipo === 'hecho') a.completarPaso(d.id)
      if (tipo === 'mal') a.error('mal')
    },
    ...extra,
  })
  g.registrar(def('uno'))
  g.registrar(def('dos', { requiere: ['uno'], limite: 100 }))
  return g
}

describe('gestor de actividades', () => {
  it('arranca con lo que no tiene requisitos disponible y el resto bloqueado', () => {
    const g = gestor()
    expect(g.obtener('uno').estado).toBe(ESTADO.DISPONIBLE)
    expect(g.obtener('dos').estado).toBe(ESTADO.BLOQUEADA)
    expect(g.iniciar('dos')).toBe(false)
    expect(g.impedimento('dos')).toContain('uno')
  })

  it('recorre DISPONIBLE, ACTIVA, PAUSADA y COMPLETADA, y desbloquea la siguiente', () => {
    const g = gestor()
    const visto = []
    g.escuchar((tipo, a) => visto.push(`${tipo}:${a.id}`))
    expect(g.iniciar('uno')).toBe(true)
    expect(g.obtener('uno').estado).toBe(ESTADO.ACTIVA)
    g.tick(10)
    expect(g.pausar()).toBe(true)
    g.tick(50)
    g.evento('hecho', { id: 'a' })                    // en pausa no cuenta
    expect(g.obtener('uno').tiempo).toBe(10)
    expect(g.obtener('uno').hechos).toBe(0)
    expect(g.reanudar()).toBe(true)
    g.evento('mal')
    g.evento('hecho', { id: 'a' })
    g.evento('hecho', { id: 'a' })                    // repetido: no suma
    expect(g.obtener('uno').hechos).toBe(1)
    g.evento('hecho', { id: 'b' })
    const a = g.obtener('uno')
    expect(a.estado).toBe(ESTADO.COMPLETADA)
    expect(a.resultado).toMatchObject({ completada: true, errores: 1, pasos: 2, total: 2, puntaje: 90 })
    expect(g.activa).toBe(null)
    expect(g.obtener('dos').estado).toBe(ESTADO.DISPONIBLE)
    expect(visto).toEqual(expect.arrayContaining(['inicio:uno', 'pausa:uno', 'reanudar:uno', 'error:uno', 'paso:uno', 'desbloqueo:dos', 'fin:uno']))
  })

  it('una sola actividad a la vez; dejarla la devuelve a disponible', () => {
    const g = gestor()
    g.iniciar('uno')
    g.evento('hecho', { id: 'a' })
    g.evento('hecho', { id: 'b' })
    g.iniciar('dos')
    expect(g.iniciar('uno')).toBe(false)
    expect(g.abandonar()).toBe(true)
    expect(g.obtener('dos').estado).toBe(ESTADO.DISPONIBLE)
    expect(g.iniciar('uno')).toBe(true)               // una completada se puede repetir
    expect(g.obtener('uno').intentos).toBe(2)
  })

  it('falla al pasar el límite de tiempo y se puede repetir', () => {
    const g = gestor()
    g.iniciar('uno'); g.evento('hecho', { id: 'a' }); g.evento('hecho', { id: 'b' })
    g.iniciar('dos')
    g.tick(101)
    const a = g.obtener('dos')
    expect(a.estado).toBe(ESTADO.FALLIDA)
    expect(a.resultado.completada).toBe(false)
    expect(a.resultado.puntaje).toBe(0)
    expect(g.impedimento('dos')).toBe('')
  })

  it('puntaje y formato de tiempo', () => {
    expect(puntaje(30, 0, 60)).toBe(100)
    expect(puntaje(90, 2, 60)).toBe(60)               // 20 por errores y 20 por tardar el 50 % más
    expect(puntaje(600, 9, 60)).toBe(0)
    expect(formatoTiempo(125.9)).toBe('02:05')
  })
})

describe('cable de seguridad', () => {
  const cable = () => new TetherSystem(new THREE.Scene(), V(0, 0, 0), PARAMETROS_EVA)

  it('con holgura no toca nada', () => {
    const c = cable()
    const pos = V(5, 0, 0)
    const vel = V(1, 0, 0)
    expect(c.limitar(pos.clone(), pos, vel, 1 / 72)).toBe(false)
    expect(vel.x).toBe(1)
    expect(c.avisando).toBe(false)
  })

  it('avisa desde los 11,5 m', () => {
    const c = cable()
    c.limitar(V(12, 0, 0), V(12, 0, 0), V(0, 0, 0), 1 / 72)
    expect(c.avisando).toBe(true)
    expect(c.tenso).toBe(false)
  })

  it('al llegar al largo devuelve la posición a 14 m y quita la velocidad hacia afuera', () => {
    const c = cable()
    const pos = V(14.4, 0, 0)
    const vel = V(2, 0.5, 0)
    expect(c.limitar(pos.clone(), pos, vel, 1 / 72)).toBe(true)
    expect(pos.x).toBeCloseTo(14, 6)
    expect(vel.x).toBeLessThanOrEqual(0)
    expect(vel.y).toBe(0.5)                           // la velocidad de costado se conserva
  })

  it('en el tramo elástico tira hacia la estación sin pasar de la velocidad de retorno', () => {
    const c = cable()
    const pos = V(13.8, 0, 0)
    const vel = V(0, 0, 0)
    for (let i = 0; i < 72 * 5; i++) c.limitar(pos.clone(), pos, vel, 1 / 72)
    expect(vel.x).toBeCloseTo(-PARAMETROS_EVA.retorno, 6)
  })
})

describe('brazos y manos', () => {
  it('el codo respeta los largos del brazo y del antebrazo', () => {
    const hombro = V(0.2, -0.2, 0)
    const muneca = V(0.25, -0.3, -0.35)
    const c = codo(hombro, muneca, V(0, -1, 0), CUERPO.brazo, CUERPO.antebrazo, new THREE.Vector3())
    expect(c.distanceTo(hombro)).toBeCloseTo(CUERPO.brazo, 5)
    expect(c.distanceTo(muneca)).toBeCloseTo(CUERPO.antebrazo, 5)
    expect(c.y).toBeLessThan(-0.25)                    // dobla hacia el polo (abajo)
  })

  it('si la mano queda más lejos que el brazo, el codo va sobre la recta', () => {
    const hombro = V(0, 0, 0)
    const muneca = V(0, 0, -1)
    const c = codo(hombro, muneca, V(0, -1, 0), CUERPO.brazo, CUERPO.antebrazo, new THREE.Vector3())
    expect(c.x).toBeCloseTo(0, 6)
    expect(c.y).toBeCloseTo(0, 6)
    expect(c.z).toBeCloseTo(-CUERPO.brazo / (CUERPO.brazo + CUERPO.antebrazo), 5)
  })

  it('la cápsula une los dos puntos', () => {
    const a = V(1, 2, 3)
    const b = V(1.3, 2, 3.4)
    const m = capsulaEntre(new THREE.Matrix4(), a, b, 0.05)
    const centro = new THREE.Vector3().setFromMatrixPosition(m)
    expect(centro.distanceTo(a.clone().lerp(b, 0.5))).toBeLessThan(1e-9)
    const eje = V(0, 0, 1).transformDirection(m)
    expect(eje.dot(b.clone().sub(a).normalize())).toBeCloseTo(1, 6)
  })

  it('los dedos se cierran: la punta del índice queda más cerca de la palma en el puño', () => {
    const out = Array.from({ length: 18 }, () => new THREE.Matrix4())
    const abierta = new THREE.Vector3()
    const cerrada = new THREE.Vector3()
    expect(cinematicaMano(POSES.abierta, out, abierta)).toBe(18)
    cinematicaMano(POSES.puno, out, cerrada)
    expect(abierta.length()).toBeGreaterThan(0.12)
    expect(cerrada.length()).toBeLessThan(0.07)
  })
})

describe('lectura del escáner', () => {
  it('rayo contra caja', () => {
    expect(rayoCaja(V(0, 0, 2), V(0, 0, -1), V(0, 0, 0), V(0.5, 0.5, 0.5))).toBeCloseTo(1.5, 6)
    expect(rayoCaja(V(2, 0, 2), V(0, 0, -1), V(0, 0, 0), V(0.5, 0.5, 0.5))).toBe(Infinity)
  })

  it('distingue el frente con etiqueta, el costado y la bolsa dañada', () => {
    const m = new THREE.Matrix4().makeTranslation(1, 0, 0)
    const carga = (nombre, legible, x) => ({ nombre, matriz: new THREE.Matrix4().makeTranslation(x, 0, 0), legible, centro: V(0, 0, 0), mitad: V(0.15, 0.2, 0.1) })
    const inv = new Inventario([carga('R_Bolsa_1', true, 1), carga('R_Bolsa_2', false, 3)], [{ codigo: 'BTC1-0001', descripcion: 'Filtros', categoria: 0, pesoKg: 4, ubicacion: 'RIV-E1-A1' }], [{ nombre: 'REPUESTOS' }])
    void m
    const frente = inv.apuntar(V(1, 0, 1), V(0, 0, -1), 1.6)
    expect(frente).toMatchObject({ tipo: 'bulto', frente: true })
    expect(frente.bulto.codigo).toBe('BTC1-0001')
    expect(frente.distancia).toBeCloseTo(0.9, 6)
    expect(inv.apuntar(V(1, 1, 0), V(0, -1, 0), 1.6).frente).toBe(false)
    expect(inv.apuntar(V(3, 0, 1), V(0, 0, -1), 1.6).bulto.legible).toBe(false)
    expect(inv.apuntar(V(1, 0, 3), V(0, 0, -1), 1.6)).toBe(null)      // fuera de alcance
    expect(inv.huecos.find((h) => h.codigo === 'RIV-E1-A1').ocupado).toBe(true)
    expect(inv.huecos.length).toBe(64)
  })
})
