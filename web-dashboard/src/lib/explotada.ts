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

/** El GLTFLoader limpia los nombres de los nodos (saca puntos, corchetes…): «Trolley.001» llega como «Trolley001». */
export const nombreNodo = (n: string): string => THREE.PropertyBinding.sanitizeNodeName(n)

/**
 * Mallas que no son el objeto visible: colisiones del kit portuario (UCX_*), niveles de detalle bajos (*_LOD1, *_LOD2)
 * y planos que solo reciben sombra (ShadowCatcher). Devuelve cuántas ocultó.
 */
export function ocultarAuxiliares(raiz: THREE.Object3D): number {
  let n = 0
  raiz.traverse((o) => {
    if (/^UCX_/.test(o.name) || /^ShadowCatcher/.test(o.name) || /_LOD[1-9](\d{3})?$/.test(o.name)) {
      o.visible = false
      n++
    }
  })
  return n
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
 * Recorre el activo y prepara sus piezas: las que nombra `porNodo` (el manifest; cualquier nombre de nodo) y las
 * Part_* con userData.explotar (modelos del laboratorio). Hay que llamarlo con el modelo armado.
 */
export function prepararPiezas(raiz: THREE.Object3D, porNodo: Record<string, Vec3> = {}): PiezaExplotada[] {
  raiz.updateWorldMatrix(true, true)
  const raizInv = new THREE.Matrix4().copy(raiz.matrixWorld).invert()
  const limpio: Record<string, Vec3> = {}
  for (const [k, v] of Object.entries(porNodo)) limpio[nombreNodo(k)] = v
  const piezas: PiezaExplotada[] = []
  raiz.traverse((o) => {
    const delManifest = limpio[o.name]
    if (!delManifest && !o.name.startsWith('Part_')) return
    const datos = delManifest ?? (o.userData as { explotar?: unknown }).explotar
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

/** Datos de las piezas según el manifest, por nombre de nodo tal como lo deja el GLTFLoader. */
export type FichasPiezas = Record<string, { nombre: string; material: string; masaKg: number | null }>

export function fichasDe(partes: { node: string; name: string; material: string; mass_kg: number | null }[]): FichasPiezas {
  return Object.fromEntries(partes.map((p) => [nombreNodo(p.node), { nombre: p.name, material: p.material, masaKg: p.mass_kg }]))
}

/**
 * La pieza a la que pertenece un objeto tocado: sube por la jerarquía hasta un nodo del manifest (`fichas`) o una
 * Part_* con extras del glTF.
 */
export function datosPieza(o: THREE.Object3D, fichas: FichasPiezas = {}): DatosPieza | null {
  let actual: THREE.Object3D | null = o
  while (actual && !fichas[actual.name] && !actual.name.startsWith('Part_')) actual = actual.parent
  if (!actual) return null
  const f = fichas[actual.name]
  if (f) return { nodo: actual.name, nombre: f.nombre, material: f.material, masaKg: f.masaKg }
  const u = actual.userData as { pieza?: unknown; material?: unknown; masa_kg?: unknown }
  return {
    nodo: actual.name,
    nombre: typeof u.pieza === 'string' ? u.pieza : actual.name.replace(/^Part_/, '').replace(/_/g, ' '),
    material: typeof u.material === 'string' ? u.material : '—',
    masaKg: typeof u.masa_kg === 'number' ? u.masa_kg : null,
  }
}
