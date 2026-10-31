import * as THREE from 'three'
import { aplicarFactor, datosPieza, ease, factorEscalonado, fichasDe, nombreNodo, ocultarAuxiliares, prepararPiezas } from './explotada'

function conjunto() {
  const raiz = new THREE.Group()
  raiz.name = 'Forklift'
  const carro = new THREE.Group()
  carro.name = 'Part_Carro'
  carro.userData = { pieza: 'Carro portahorquillas', material: 'Acero', masa_kg: 110, explotar: [1.6, 0, 0] }
  const horquillas = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.2), new THREE.MeshStandardMaterial())
  horquillas.name = 'Part_Horquillas'
  horquillas.position.set(0, 0, 0.4)
  horquillas.userData = { explotar: [0, 0, 0.5] }
  const sinDatos = new THREE.Group()
  sinDatos.name = 'Part_Sin_Datos'
  carro.add(horquillas)
  raiz.add(carro, sinDatos)
  return { raiz, carro, horquillas }
}

describe('vista explotada (igual que ExplodedViewMath.cs)', () => {
  it('las curvas van de 0 a 1 y la cúbica pasa por 0,5', () => {
    for (const c of ['lineal', 'suave', 'cubica'] as const) {
      expect(ease(0, c)).toBe(0)
      expect(ease(1, c)).toBe(1)
      expect(ease(2, c)).toBe(1)
    }
    expect(ease(0.5, 'cubica')).toBeCloseTo(0.5)
  })

  it('el escalonado reparte los turnos', () => {
    expect(factorEscalonado(0.3, 0, 5, 0.4)).toBeCloseTo(0.5)
    expect(factorEscalonado(0.39, 4, 5, 0.4)).toBe(0)
    expect(factorEscalonado(1, 4, 5, 0.4)).toBe(1)
    expect(factorEscalonado(0.42, 2, 5, 0)).toBeCloseTo(0.42)
  })

  it('una pieza hija suma su desplazamiento al del padre', () => {
    const { raiz, horquillas } = conjunto()
    const piezas = prepararPiezas(raiz)
    expect(piezas.map((p) => p.nodo)).toEqual(['Part_Carro', 'Part_Horquillas'])
    aplicarFactor(piezas, 1, 0, 'lineal')
    raiz.updateWorldMatrix(true, true)
    const p = horquillas.getWorldPosition(new THREE.Vector3())
    expect(p.x).toBeCloseTo(1.6)
    expect(p.z).toBeCloseTo(0.9)
    aplicarFactor(piezas, 0, 0, 'lineal')
    expect(horquillas.position.z).toBeCloseTo(0.4)
  })

  it('respeta la rotación del padre: el desplazamiento está en el espacio de la raíz', () => {
    const { raiz, carro, horquillas } = conjunto()
    carro.rotation.y = Math.PI / 2
    const piezas = prepararPiezas(raiz)
    aplicarFactor(piezas, 1, 0, 'lineal')
    raiz.updateWorldMatrix(true, true)
    const antes = new THREE.Vector3(0.4, 0, 0) // (0,0,0.4) girado 90° alrededor de Y
    const p = horquillas.getWorldPosition(new THREE.Vector3())
    expect(p.x).toBeCloseTo(1.6 + antes.x)
    expect(p.z).toBeCloseTo(0.5, 5)
  })

  it('el manifest puede reemplazar los desplazamientos del glTF', () => {
    const { raiz, carro } = conjunto()
    const piezas = prepararPiezas(raiz, { Part_Carro: [0, 2, 0] })
    aplicarFactor(piezas, 1, 0, 'lineal')
    expect(carro.position.y).toBeCloseTo(2)
    expect(carro.position.x).toBeCloseTo(0)
  })

  it('los datos de la pieza salen de los extras (subiendo hasta la Part_ más cercana)', () => {
    const { horquillas, carro } = conjunto()
    expect(datosPieza(carro)).toEqual({ nodo: 'Part_Carro', nombre: 'Carro portahorquillas', material: 'Acero', masaKg: 110 })
    expect(datosPieza(horquillas)?.nombre).toBe('Horquillas')
    expect(datosPieza(new THREE.Object3D())).toBeNull()
  })
})

describe('modelos de otros proyectos', () => {
  it('oculta colisiones, niveles de detalle bajos y planos de sombra', () => {
    const raiz = new THREE.Group()
    const nombres = ['STS_Structure_LOD0', 'STS_Structure_LOD1', 'STS_Spreader_LOD2001', 'UCX_Pata_Mar_D', 'ShadowCatcher', 'Trolley']
    for (const n of nombres) {
      const o = new THREE.Object3D()
      o.name = n
      raiz.add(o)
    }
    expect(ocultarAuxiliares(raiz)).toBe(4)
    expect(raiz.children.filter((o) => o.visible).map((o) => o.name)).toEqual(['STS_Structure_LOD0', 'Trolley'])
  })

  it('despieza nodos con cualquier nombre si el manifest los nombra (con los nombres limpios del GLTFLoader)', () => {
    const raiz = new THREE.Group()
    const hombro = new THREE.Group()
    hombro.name = 'Shoulder_Joint'
    const carro = new THREE.Group()
    carro.name = nombreNodo('Trolley.001')
    raiz.add(hombro, carro)
    expect(carro.name).toBe('Trolley001')
    const piezas = prepararPiezas(raiz, { Shoulder_Joint: [0, 0.2, 0], 'Trolley.001': [0, 0, 3] })
    expect(piezas.map((p) => p.nodo).sort()).toEqual(['Shoulder_Joint', 'Trolley001'])
    aplicarFactor(piezas, 1, 0, 'lineal')
    expect(hombro.position.y).toBeCloseTo(0.2)
    expect(carro.position.z).toBeCloseTo(3)
  })

  it('los datos de la pieza salen del manifest subiendo por la jerarquía', () => {
    const brazo = new THREE.Group()
    brazo.name = 'Upper_Arm'
    const malla = new THREE.Mesh()
    malla.name = 'Upper_Arm_Mesh'
    brazo.add(malla)
    const fichas = fichasDe([{ node: 'Upper_Arm', name: 'Brazo', material: 'Aluminio fundido', mass_kg: null }])
    expect(datosPieza(malla, fichas)).toEqual({ nodo: 'Upper_Arm', nombre: 'Brazo', material: 'Aluminio fundido', masaKg: null })
    expect(datosPieza(malla)).toBeNull()
  })
})
