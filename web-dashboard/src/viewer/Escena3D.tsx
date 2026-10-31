import { Bounds, ContactShadows, Grid, Html, OrbitControls, useBounds } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, type ReactNode } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { celdaGrilla } from '../lib/escala'

/** Reflejos de estudio generados en el momento (sin descargar mapas HDR): sin esto el metal se ve negro. */
function EntornoEstudio() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const sala = new RoomEnvironment()
    const textura = pmrem.fromScene(sala, 0.04).texture
    scene.environment = textura
    scene.environmentIntensity = 0.7
    return () => {
      scene.environment = null
      textura.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

function CargandoModelo() {
  return (
    <Html center>
      <span className="rounded-md bg-elevada px-3 py-1.5 text-xs text-tenue shadow ring-1 ring-borde">Cargando el modelo…</span>
    </Html>
  )
}

/**
 * Escena del visor: luces de estudio sin mapas de entorno externos (funciona sin internet en el aula),
 * grilla de 1 m, sombra de contacto y cámara orbital que encuadra el modelo.
 */
/**
 * Al cambiar de modelo, la cámara vuelve a una vista de tres cuartos (de frente, a la derecha y un poco desde arriba)
 * antes de encuadrar: si no, Bounds conserva la dirección del modelo anterior y una grúa de 114 m puede quedar vista
 * desde arriba.
 */
function EncuadreInicial({ clave }: { clave: string }) {
  const bounds = useBounds()
  const { camera, controls } = useThree()
  useEffect(() => {
    const id = window.setTimeout(() => {
      const caja = bounds.refresh().getSize()
      const radio = Math.max(caja.size.length() / 2, 0.05)
      const centro = caja.center
      camera.position.copy(centro).add(new THREE.Vector3(1, 0.6, 1.35).normalize().multiplyScalar(radio * 3))
      camera.lookAt(centro)
      const orbita = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null
      orbita?.target?.copy(centro)
      orbita?.update?.()
      bounds.refresh().clip().fit()
    }, 0)
    return () => window.clearTimeout(id)
  }, [clave, bounds, camera, controls])
  return null
}

export function Escena3D({ children, claveEncuadre, tamano = 4 }: { children: ReactNode; claveEncuadre: string; tamano?: number }) {
  const { celda, seccion } = celdaGrilla(tamano)
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [3, 2.2, 3.5], fov: 40, near: 0.01, far: 5000 }} aria-label="Visor 3D del modelo">
      <color attach="background" args={['#1a1a19']} />
      <EntornoEstudio />
      <hemisphereLight args={['#eef2ff', '#3a3a36', 0.6]} />
      <directionalLight position={[4, 6, 3]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-5, 3, -4]} intensity={0.6} />
      <Suspense fallback={<CargandoModelo />}>
        <Bounds key={claveEncuadre} fit clip observe margin={1.25}>
          <EncuadreInicial clave={claveEncuadre} />
          {children}
        </Bounds>
        <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={tamano * 3} blur={2.2} far={tamano} />
      </Suspense>
      <Grid
        args={[20, 20]}
        cellSize={celda}
        sectionSize={seccion}
        cellColor="#2c2c2a"
        sectionColor="#4a4a46"
        fadeDistance={tamano * 4}
        infiniteGrid
        position={[0, -0.001, 0]}
      />
      <OrbitControls makeDefault enableDamping minDistance={0.2} maxDistance={40} />
    </Canvas>
  )
}
