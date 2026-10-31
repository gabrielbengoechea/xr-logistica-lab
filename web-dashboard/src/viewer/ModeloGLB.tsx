import { Html, useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { SnapPoint, Vec3 } from '../api/types'
import { aplicarFactor, datosPieza, nombreNodo as nodoLimpio, ocultarAuxiliares, prepararPiezas, type DatosPieza, type FichasPiezas } from '../lib/explotada'
import { nombreNodo } from '../lib/formato'

interface Props {
  url: string
  /** Despiece pedido (0 armado, 1 despiezado); el modelo llega con una transición suave. */
  factor: number
  desplazamientos: Record<string, Vec3>
  /** Nombre, material y masa de cada pieza según el manifest (por nodo). */
  fichas: FichasPiezas
  encajes: SnapPoint[]
  /** Lado mayor del activo (m): el marcador de los encajes se dimensiona con él. */
  tamano: number
  mostrarEncajes: boolean
  resaltada: string | null
  alPasar: (pieza: DatosPieza | null) => void
  alElegir: (pieza: DatosPieza | null) => void
}

const RESALTE = new THREE.Color('#3987e5')

/** Copia los materiales de cada malla para poder resaltar una pieza sin teñir las demás. */
function materialesPropios(raiz: THREE.Object3D) {
  raiz.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
    m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone()
  })
}

function teñir(o: THREE.Object3D, activo: boolean) {
  o.traverse((h) => {
    const m = h as THREE.Mesh
    if (!m.isMesh) return
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const std = mat as THREE.MeshStandardMaterial
      if (!std.emissive) continue
      std.emissive.copy(activo ? RESALTE : new THREE.Color(0, 0, 0))
      std.emissiveIntensity = activo ? 0.35 : 0
    }
  })
}

export function ModeloGLB({ url, factor, desplazamientos, fichas, encajes, tamano, mostrarEncajes, resaltada, alPasar, alElegir }: Props) {
  const { scene } = useGLTF(url)
  const modelo = useMemo(() => {
    const raiz = scene.clone(true)
    ocultarAuxiliares(raiz)
    materialesPropios(raiz)
    return raiz
  }, [scene])
  const piezas = useMemo(() => prepararPiezas(modelo, desplazamientos), [modelo, desplazamientos])
  const actual = useRef(0)

  // Transición suave hacia el factor pedido (≈ 0,4 s), sin depender de los cuadros por segundo.
  useFrame((_, dt) => {
    const objetivo = Math.min(1, Math.max(0, factor))
    if (Math.abs(objetivo - actual.current) < 1e-4) return
    actual.current += (objetivo - actual.current) * (1 - Math.exp(-dt * 9))
    if (Math.abs(objetivo - actual.current) < 1e-3) actual.current = objetivo
    aplicarFactor(piezas, actual.current)
  })

  useEffect(() => {
    const buscado = resaltada ? nodoLimpio(resaltada) : null
    const objetivo = piezas.find((p) => p.nodo === buscado)?.objeto
    piezas.forEach((p) => teñir(p.objeto, p.objeto === objetivo))
  }, [piezas, resaltada])

  const pieza = (e: ThreeEvent<PointerEvent | MouseEvent>) => datosPieza(e.object, fichas)

  return (
    <group>
      <primitive
        object={modelo}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          alPasar(pieza(e))
        }}
        onPointerOut={() => alPasar(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          alElegir(pieza(e))
        }}
      />
      {mostrarEncajes &&
        encajes.map((s) => (
          <group key={s.node} position={s.position}>
            <mesh>
              <sphereGeometry args={[Math.max(0.004, tamano * 0.018), 16, 12]} />
              <meshBasicMaterial color="#fab219" transparent opacity={0.85} depthTest={false} />
            </mesh>
            <Html center position={[0, Math.max(0.004, tamano * 0.018) * 2.6, 0]} className="pointer-events-none select-none" zIndexRange={[10, 0]}>
              <span className="whitespace-nowrap rounded bg-elevada/95 px-1.5 py-0.5 text-[11px] font-medium text-tinta shadow ring-1 ring-borde">
                {nombreNodo(s.node)} · acepta {s.accepts}
              </span>
            </Html>
          </group>
        ))}
    </group>
  )
}
