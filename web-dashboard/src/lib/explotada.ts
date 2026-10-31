import * as THREE from 'three'
import type { Vec3 } from '../api/types'

/**
 * Vista explotada en el visor web: la misma matemática que vr-client/Assets/Scripts/Core/ExplodedViewMath.cs.
 * Los desplazamientos `explotar` del glTF (extras → userData) están en el espacio de la raíz del activo; acá se
 * pasan al espacio del padre de cada pieza, así una pieza hija (las horquillas del carro) suma su movimiento al
 * de su padre.
 */

export type Curva = 'lineal' | 'suave' | 'cubica'

export function ease(t: number, curva: Curva = 'cubica'): number {
  const x = Math.min(1, Math.max(0, t))
  switch (curva) {
    case 'suave':
      return x * x * (3 - 2 * x)
    case 'cubica':
      return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
    default:
      return x
  }
}

/** Factor de la pieza `i` de `n` con escalonado (0: todas juntas). */
export function factorEscalonado(global: number, i: number, n: number, escalonado: number): number {
  const g = Math.min(1, Math.max(0, global))
  if (n <= 1 || escalonado <= 0) return g
  const s = Math.min(1, escalonado)
  const ventana = Math.max(1 - s, 1e-4)
  const inicio = (s * i) / (n - 1)
  return Math.min(1, Math.max(0, (g - inicio) / ventana))
}

export interface PiezaExplotada {
  objeto: THREE.Object3D
  nodo: string
  armada: THREE.Vector3
  /** Desplazamiento completo en el espacio del padre. */
  desplazamiento: THREE.Vector3
}

function esVec3(v: unknown): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x))
}

/**
 * Recorre el activo y prepara sus piezas (Part_* con userData.explotar, o con el desplazamiento que diga
 * `porNodo`, que viene del manifest). Hay que llamarlo con el modelo armado.
 */
export function prepararPiezas(raiz: THREE.Object3D, porNodo: Record<string, Vec3> = {}): PiezaExplotada[] {
  raiz.updateWorldMatrix(true, true)
  const raizInv = new THREE.Matrix4().copy(raiz.matrixWorld).invert()
  const piezas: PiezaExplotada[] = []
  raiz.traverse((o) => {
    if (!o.name.startsWith('Part_')) return
    const datos = porNodo[o.name] ?? (o.userData as { explotar?: unknown }).explotar
    if (!esVec3(datos)) return
    // espacio de la raíz → mundo → espacio del padre: solo la parte lineal de las matrices (sin traslación)
    const enRaiz = new THREE.Vector3(...datos)
    const aMundo = new THREE.Matrix3().setFromMatrix4(raiz.matrixWorld)
    const padreInv = o.parent ? new THREE.Matrix4().copy(o.parent.matrixWorld).invert() : raizInv
    const local = enRaiz.clone().applyMatrix3(aMundo).applyMatrix3(new THREE.Matrix3().setFromMatrix4(padreInv))
    piezas.push({ objeto: o, nodo: o.name, armada: o.position.clone(), desplazamiento: local })
  })
  return piezas
}

/** Lleva todas las piezas al factor pedido (0 armado, 1 despiezado). */
export function aplicarFactor(piezas: PiezaExplotada[], factor: number, escalonado = 0.2, curva: Curva = 'cubica'): void {
  const n = piezas.length
  piezas.forEach((p, i) => {
    const k = ease(factorEscalonado(factor, i, n, escalonado), curva)
    p.objeto.position.copy(p.armada).addScaledVector(p.desplazamiento, k)
  })
}

/** Datos de la pieza para el panel (extras del glTF que escribe models/tools/generar_modelos.py). */
export interface DatosPieza {
  nodo: string
  nombre: string
  material: string
  masaKg: number | null
}

export function datosPieza(o: THREE.Object3D): DatosPieza | null {
  let actual: THREE.Object3D | null = o
  while (actual && !actual.name.startsWith('Part_')) actual = actual.parent
  if (!actual) return null
  const u = actual.userData as { pieza?: unknown; material?: unknown; masa_kg?: unknown }
  return {
    nodo: actual.name,
    nombre: typeof u.pieza === 'string' ? u.pieza : actual.name.replace(/^Part_/, '').replace(/_/g, ' '),
    material: typeof u.material === 'string' ? u.material : '—',
    masaKg: typeof u.masa_kg === 'number' ? u.masa_kg : null,
  }
}
