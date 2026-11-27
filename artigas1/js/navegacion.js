// Navegación por la estación: en qué módulo está el astronauta, cuáles visitó y una guía que marca el camino
// físico hasta el destino (flechas a lo largo del pasillo), en lugar de saltar sin contexto.
import * as THREE from 'three';

/** Módulos y puntos de interés. `centro` es adonde lleva la guía (y el traslado). */
export const LUGARES = [
  { id: 'tacuarembo', nombre: 'Tacuarembó', rol: 'Taller y laboratorio', contiene: 'Banco de trabajo, tablero de herramientas, filtros de CO₂ y soporte vital.', centro: [0.15, 0.05, 5.6], mira: [0.4, -0.1, -1], zona: 'interior' },
  { id: 'nodo', nombre: 'Nodo Montevideo', rol: 'Módulo central y comunicaciones', contiene: 'Balance de masa, consola de comunicaciones, esclusa de salida y acceso a la Cúpula.', centro: [0.2, 0.1, 2.4], mira: [-1, -0.05, -0.35], zona: 'interior' },
  { id: 'cupula', nombre: 'Cúpula Faro', rol: 'Observación', contiene: 'Siete ventanas y una central: Uruguay y el Río de la Plata.', centro: [0.05, -1.95, 2.11], mira: [0.25, -0.75, -1], zona: 'interior' },
  { id: 'rivera', nombre: 'Rivera', rol: 'Depósito y almacenamiento', contiene: 'Racks de babor, estribor, piso y techo con la carga asegurada.', centro: [0.1, 0.1, 0.0], mira: [0, -0.05, -1], zona: 'interior' },
  { id: 'colonia', nombre: 'Colonia', rol: 'Módulo logístico: recepción', contiene: 'Recepción de carga, portal RFID, cuarentena y manifiesto.', centro: [-0.2, 0.15, -5.6], mira: [0.2, -0.1, -1], zona: 'interior' },
  { id: 'carguero', nombre: 'Carguero Charrúa', rol: 'Vehículo de carga CR-01', contiene: 'Bodega con los bultos a descargar.', centro: [0.05, 0.1, -9.3], mira: [0, -0.05, -1], zona: 'interior' },
  { id: 'esclusa', nombre: 'Esclusa', rol: 'Acceso al exterior', contiene: 'Salida y regreso de la caminata espacial.', centro: [0.85, 0.0, 2.11], mira: [1, 0, 0], zona: 'interior' },
  { id: 'junta_solar', nombre: 'Paneles solares', rol: 'Exterior · energía', contiene: 'Dos alas con junta giratoria que siguen al sol.', centro: [0.45, 2.82, -6.3], mira: [-0.3, 0, -1], zona: 'exterior' },
  { id: 'antena', nombre: 'Antena principal', rol: 'Exterior · comunicaciones', contiene: 'Plato orientable sobre el Nodo.', centro: [0.45, 2.82, 1.9], mira: [-1, 0, 0.2], zona: 'exterior' },
  { id: 'conector_radiador', nombre: 'Radiadores', rol: 'Exterior · control térmico', contiene: 'Hojas en acordeón y conector de fluido.', centro: [2.5, 0.75, 5.2], mira: [-1, 0, 0], zona: 'exterior' },
];
export const LUGAR = Object.fromEntries(LUGARES.map((l) => [l.id, l]));

/** Módulo interior que contiene el punto. */
export function moduloEn(p) {
  if (p.y < -1.43 && p.z > 0.7 && p.z < 3.5) return 'cupula';
  if (p.z > 3.54) return 'tacuarembo';
  if (p.z > 0.68) return 'nodo';
  if (p.z > -4.88) return 'rivera';
  if (p.z > -8.72) return 'colonia';
  return 'carguero';
}

/**
 * Camino por adentro desde `desde` hasta el lugar: primero al eje del módulo, después por el pasillo.
 * @returns {THREE.Vector3[]}
 */
export function rutaInterior(desde, idDestino) {
  const destino = new THREE.Vector3(...LUGAR[idDestino].centro);
  const puntos = [desde.clone()];
  const empalme = new THREE.Vector3(0, 0, 2.11);                 // donde el túnel de la Cúpula y la esclusa dan al pasillo
  if (moduloEn(desde) === 'cupula') {
    puntos.push(new THREE.Vector3(0, desde.y, 2.11), empalme.clone());
  } else if (Math.hypot(desde.x, desde.y) > 0.35) {
    puntos.push(new THREE.Vector3(0, 0, desde.z));
  }
  if (idDestino === 'cupula' || idDestino === 'esclusa') {
    puntos.push(empalme.clone());
  } else {
    puntos.push(new THREE.Vector3(0, 0, destino.z));
  }
  puntos.push(destino);
  // sin tramos nulos
  return puntos.filter((p, i) => i === 0 || p.distanceTo(puntos[i - 1]) > 0.05);
}

/** Camino por afuera: se engancha al punto más cercano de la ruta de pasamanos y la sigue hasta el final. */
export function rutaExterior(desde, puntosRuta) {
  let mejor = 0;
  let dMejor = Infinity;
  for (let i = 0; i < puntosRuta.length; i++) {
    const d = puntosRuta[i].distanceToSquared(desde);
    if (d < dMejor) { dMejor = d; mejor = i; }
  }
  return [desde.clone(), ...puntosRuta.slice(mejor).map((p) => p.clone())];
}

const _a = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const ADELANTE = new THREE.Vector3(0, 0, -1);
const UNO = new THREE.Vector3(1, 1, 1);

export class Navegacion {
  /** @param {THREE.Scene} escena */
  constructor(escena) {
    this.visitados = new Set();
    this.actual = '';
    this.destino = '';
    /** @type {THREE.Vector3[]} */
    this.ruta = [];
    this.alLlegar = null;
    this.alCambiarModulo = null;
    this._proveedor = null;
    this._reloj = 0;
    this._fase = 0;
    const flecha = new THREE.ConeGeometry(0.05, 0.14, 4);
    flecha.rotateX(-Math.PI / 2);                                // la punta hacia -Z
    this.flechas = new THREE.InstancedMesh(flecha, new THREE.MeshBasicMaterial({ color: 0x74acdf, transparent: true, opacity: 0.85, depthWrite: false }), 48);
    this.flechas.name = 'Guia_Navegacion';
    this.flechas.frustumCulled = false;
    this.flechas.count = 0;
    this.meta = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 24), new THREE.MeshBasicMaterial({ color: 0xfcd116, transparent: true, opacity: 0.9, depthWrite: false }));
    this.meta.visible = false;
    escena.add(this.flechas, this.meta);
  }

  /**
   * Empieza a guiar. `proveedor(desde)` devuelve el camino actualizado (se recalcula a medida que el astronauta avanza).
   * @param {string} id @param {(desde: THREE.Vector3) => THREE.Vector3[]} proveedor
   */
  guiar(id, proveedor) {
    this.destino = id;
    this._proveedor = proveedor;
    this._reloj = 1;
  }

  cancelar() {
    this.destino = '';
    this._proveedor = null;
    this.ruta = [];
    this.flechas.count = 0;
    this.meta.visible = false;
  }

  /** Metros que faltan por la ruta. */
  get distancia() {
    let d = 0;
    for (let i = 1; i < this.ruta.length; i++) d += this.ruta[i].distanceTo(this.ruta[i - 1]);
    return d;
  }

  /** @param {number} dt @param {THREE.Vector3} cabeza @param {boolean} afuera */
  actualizar(dt, cabeza, afuera) {
    const modulo = afuera ? 'exterior' : moduloEn(cabeza);
    if (modulo !== this.actual) {
      this.actual = modulo;
      const nuevo = !this.visitados.has(modulo);
      this.visitados.add(modulo);
      if (this.alCambiarModulo) this.alCambiarModulo(modulo, nuevo);
    }
    if (!this._proveedor) return;
    this._reloj += dt;
    this._fase = (this._fase + dt * 0.9) % 1;
    if (this._reloj > 0.2) {
      this._reloj = 0;
      this.ruta = this._proveedor(cabeza);
    }
    const fin = this.ruta[this.ruta.length - 1];
    if (!fin) return;
    if (fin.distanceTo(cabeza) < 0.6) {                          // ya adentro del módulo de destino, no en su escotilla
      const id = this.destino;
      this.cancelar();
      if (this.alLlegar) this.alLlegar(id);
      return;
    }
    // flechas cada 0,55 m, que avanzan hacia el destino
    let n = 0;
    let recorrido = 0.5 + this._fase * 0.55;
    let acumulado = 0;
    for (let i = 1; i < this.ruta.length && n < 48; i++) {
      const a = this.ruta[i - 1];
      const b = this.ruta[i];
      const largo = a.distanceTo(b);
      _a.subVectors(b, a).multiplyScalar(1 / Math.max(largo, 1e-6));
      _q.setFromUnitVectors(ADELANTE, _a);
      while (recorrido < acumulado + largo && n < 48) {
        const t = recorrido - acumulado;
        _m.compose(_s.copy(a).addScaledVector(_a, t), _q, UNO);
        this.flechas.setMatrixAt(n++, _m);
        recorrido += 0.55;
      }
      acumulado += largo;
    }
    this.flechas.count = n;
    this.flechas.instanceMatrix.needsUpdate = true;
    this.meta.visible = true;
    this.meta.position.copy(fin);
    this.meta.lookAt(cabeza);
  }
}
