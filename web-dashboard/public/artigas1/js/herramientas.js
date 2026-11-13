// Herramientas y puntos de agarre (grip points).
//
// Cada objeto que se toma tiene un «agarre»: cómo queda acomodado en la mano y qué pose de dedos le corresponde.
// El agarre se define para la mano derecha en el marco «herramienta» de la mano (+Y hacia el pulgar, -Z hacia
// adelante, palma hacia -X); para la izquierda se usa su espejo (ver agarreParaMano).
//
// Las herramientas se modelan acá, con primitivas y color por vértice: una malla y un material compartido
// por todas (una llamada de dibujo por herramienta), con los ejes pensados para la mano:
//   - tipo pistola (escáner, inspector): mango a lo largo de Y, cañón hacia -Z;
//   - tipo vara (linterna, destornillador, llave, medidor, radio): eje a lo largo de +Y, la punta arriba;
//   - planas (tablet, tarjeta): en el plano XY, con el frente hacia +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const C = {
  amarillo: 0xf2b705, oscuro: 0x23272e, gris: 0x6c737d, claro: 0xd9dde2, rojo: 0xb3261e, azul: 0x0038a8,
  celeste: 0x74acdf, acero: 0xaab2bb, goma: 0x15171a, naranja: 0xe8730c, verde: 0x2e9e4f, lente: 0x101820,
};
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _color = new THREE.Color();
const ESPEJO = new THREE.Matrix4().makeScale(-1, 1, 1);

class Armado {
  constructor() { this.partes = []; }

  _sumar(g, color, pos, rot) {
    const geo = g.index ? g.toNonIndexed() : g;
    _m.compose(new THREE.Vector3(...pos), _q.setFromEuler(_e.set(...rot)), new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(_m);
    _color.setHex(color, THREE.SRGBColorSpace);
    const n = geo.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _color.r; col[i * 3 + 1] = _color.g; col[i * 3 + 2] = _color.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.partes.push(geo);
    return this;
  }

  caja(w, h, d, color, pos = [0, 0, 0], rot = [0, 0, 0]) { return this._sumar(new THREE.BoxGeometry(w, h, d), color, pos, rot); }

  /** Cilindro a lo largo de Y. */
  cil(r1, r2, h, color, pos = [0, 0, 0], rot = [0, 0, 0], lados = 10) { return this._sumar(new THREE.CylinderGeometry(r1, r2, h, lados), color, pos, rot); }

  aro(radio, tubo, color, pos = [0, 0, 0], rot = [0, 0, 0]) { return this._sumar(new THREE.TorusGeometry(radio, tubo, 5, 12), color, pos, rot); }

  terminar() {
    const g = mergeGeometries(this.partes, false);
    for (const p of this.partes) p.dispose();
    g.computeBoundingSphere();
    return g;
  }
}

/** Agarre de la mano derecha: `matriz` es la pose del objeto en el marco «herramienta». */
function agarre(pose, { pos = [0, 0, 0], rot = [0, 0, 0], radioMango = 0.016, punta = null, direccion = null } = {}) {
  const matriz = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1));
  return {
    pose, radioMango, libre: false, matriz, matrizIzquierda: new THREE.Matrix4().multiplyMatrices(ESPEJO, matriz).multiply(ESPEJO),
    punta: punta ? new THREE.Vector3(...punta) : null, direccion: direccion ? new THREE.Vector3(...direccion) : null,
  };
}

/** Agarre libre: el objeto queda como estaba respecto de la mano (bultos y cosas chicas). */
export function agarreLibre(radio) {
  return { pose: radio > 0.07 ? 'caja' : 'pinza', radioMango: 0.012, libre: true, matriz: null, matrizIzquierda: null, punta: null, direccion: null };
}

/** Agarre para un objeto plano del kit (portapapeles, manual): por el borde, con el frente hacia la cara. */
export function agarrePlano(geometria) {
  geometria.computeBoundingBox();
  const t = geometria.boundingBox.getSize(new THREE.Vector3()).toArray();
  const orden = [0, 1, 2].sort((a, b) => t[a] - t[b]);          // fino, medio, largo
  const eje = (i) => new THREE.Vector3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
  // fino -> +Z (hacia la cara), largo -> +Y, medio -> X (con el signo que deja una rotación propia)
  const z = eje(orden[0]);
  const y = eje(orden[2]);
  const x = new THREE.Vector3().crossVectors(y, z);
  const giro = new THREE.Matrix4().makeBasis(x, y, z).invert();   // objeto -> herramienta
  const a = agarre('plano', { pos: [-(t[orden[1]] / 2 - 0.02), 0.03, -0.01], rot: [-0.45, 0, 0], radioMango: 0.004 });
  a.matriz.multiply(giro);
  a.matrizIzquierda.multiplyMatrices(ESPEJO, a.matriz).multiply(ESPEJO);
  return a;
}

/** Matriz del objeto en el marco «herramienta» de esa mano. */
export function agarreParaMano(a, lado) {
  return lado === 'left' ? a.matrizIzquierda : a.matriz;
}

function lienzo(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx: canvas.getContext('2d'), textura };
}

function pantalla(w, h, px, py, pos, rot = [0, 0, 0]) {
  const l = lienzo(px, py);
  const malla = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: l.textura }));
  malla.position.set(...pos);
  malla.rotation.set(...rot);
  malla.userData.lienzo = l;
  return malla;
}

const MODELOS = {
  escaner() {
    const a = new Armado()
      .caja(0.034, 0.105, 0.040, C.oscuro, [0, -0.012, 0.004], [0.16, 0, 0])            // mango
      .caja(0.030, 0.030, 0.016, C.goma, [0, -0.066, 0.012])                            // base del mango
      .caja(0.052, 0.050, 0.112, C.amarillo, [0, 0.064, -0.034])                        // cabezal
      .caja(0.046, 0.040, 0.014, C.oscuro, [0, 0.062, -0.094])                          // marco de la ventana
      .caja(0.036, 0.022, 0.004, C.rojo, [0, 0.062, -0.1025])                           // ventana del lector
      .caja(0.010, 0.026, 0.016, C.naranja, [0, 0.022, -0.026], [0.35, 0, 0])           // gatillo
      .caja(0.054, 0.006, 0.060, C.oscuro, [0, 0.092, -0.030]);                         // lomo
    const malla = { geometria: a.terminar(), radio: 0.085 };
    malla.agarre = agarre('pistola', { pos: [0, 0.004, 0], radioMango: 0.019, punta: [0, 0.062, -0.105], direccion: [0, 0, -1] });
    malla.pantalla = () => pantalla(0.044, 0.034, 176, 136, [0, 0.066, 0.0225]);
    return malla;
  },
  inspector() {
    const a = new Armado()
      .caja(0.032, 0.100, 0.038, C.gris, [0, -0.012, 0.004], [0.16, 0, 0])
      .caja(0.060, 0.062, 0.070, C.claro, [0, 0.070, -0.012])
      .cil(0.024, 0.027, 0.050, C.oscuro, [0, 0.070, -0.070], [Math.PI / 2, 0, 0], 12)   // objetivo
      .cil(0.019, 0.019, 0.004, C.lente, [0, 0.070, -0.097], [Math.PI / 2, 0, 0], 12)
      .caja(0.010, 0.024, 0.014, C.azul, [0, 0.022, -0.024], [0.35, 0, 0])
      .caja(0.064, 0.008, 0.074, C.azul, [0, 0.105, -0.012]);
    const malla = { geometria: a.terminar(), radio: 0.085 };
    malla.agarre = agarre('pistola', { pos: [0, 0.004, 0], radioMango: 0.018, punta: [0, 0.070, -0.10], direccion: [0, 0, -1] });
    malla.pantalla = () => pantalla(0.050, 0.044, 160, 140, [0, 0.070, 0.0235]);
    return malla;
  },
  linterna() {
    const a = new Armado()
      .cil(0.0165, 0.0165, 0.125, C.oscuro, [0, 0.0, 0], [0, 0, 0], 12)
      .cil(0.027, 0.0175, 0.034, C.oscuro, [0, 0.078, 0], [0, 0, 0], 12)
      .cil(0.024, 0.024, 0.004, 0xfff3c4, [0, 0.097, 0], [0, 0, 0], 12)
      .aro(0.0172, 0.0022, C.amarillo, [0, 0.040, 0], [Math.PI / 2, 0, 0])
      .caja(0.008, 0.016, 0.010, C.naranja, [0, 0.020, -0.018]);
    return { geometria: a.terminar(), radio: 0.07, agarre: agarre('cilindro', { pos: [0, 0.01, 0], rot: [-0.6, 0, 0], radioMango: 0.0165, punta: [0, 0.10, 0], direccion: [0, 1, 0] }) };
  },
  destornillador() {
    const a = new Armado()
      .cil(0.0165, 0.0145, 0.095, C.rojo, [0, 0, 0], [0, 0, 0], 10)
      .cil(0.0175, 0.0175, 0.010, C.oscuro, [0, -0.050, 0], [0, 0, 0], 10)
      .cil(0.0040, 0.0040, 0.110, C.acero, [0, 0.102, 0], [0, 0, 0], 6)
      .caja(0.0070, 0.012, 0.0016, C.acero, [0, 0.162, 0]);
    return { geometria: a.terminar(), radio: 0.08, agarre: agarre('cilindro', { pos: [0, 0.01, 0], rot: [-0.6, 0, 0], radioMango: 0.016, punta: [0, 0.168, 0], direccion: [0, 1, 0] }) };
  },
  llave() {
    const a = new Armado()
      .caja(0.022, 0.150, 0.008, C.acero, [0, 0.01, 0])
      .caja(0.044, 0.030, 0.010, C.acero, [0, 0.098, 0])
      .caja(0.014, 0.030, 0.012, C.acero, [-0.022, 0.122, 0])
      .caja(0.014, 0.024, 0.012, C.acero, [0.022, 0.118, 0])
      .cil(0.006, 0.006, 0.014, C.oscuro, [0, 0.098, 0], [Math.PI / 2, 0, 0], 8)
      .caja(0.024, 0.060, 0.010, C.azul, [0, -0.035, 0]);
    return { geometria: a.terminar(), radio: 0.08, agarre: agarre('cilindro', { pos: [0, 0.02, 0], rot: [-0.6, 0, 0], radioMango: 0.011, punta: [0, 0.125, 0], direccion: [0, 1, 0] }) };
  },
  medidor() {
    const a = new Armado()
      .caja(0.070, 0.130, 0.030, C.amarillo, [0, 0, 0])
      .caja(0.076, 0.020, 0.036, C.oscuro, [0, -0.060, 0])
      .caja(0.076, 0.020, 0.036, C.oscuro, [0, 0.060, 0])
      .cil(0.016, 0.016, 0.006, C.oscuro, [0, -0.022, 0.016], [Math.PI / 2, 0, 0], 12)   // selector
      .cil(0.0035, 0.0015, 0.070, C.acero, [0.018, 0.104, 0], [0, 0, 0], 6)              // punta de prueba
      .cil(0.0060, 0.0060, 0.030, C.rojo, [0.018, 0.078, 0], [0, 0, 0], 6);
    const malla = { geometria: a.terminar(), radio: 0.085, agarre: agarre('caja', { pos: [0, 0.0, 0], rot: [-0.6, 0, 0], radioMango: 0.016, punta: [0.018, 0.14, 0], direccion: [0, 1, 0] }) };
    malla.pantalla = () => pantalla(0.052, 0.034, 156, 102, [0, 0.026, 0.0155]);
    return malla;
  },
  radio() {
    const a = new Armado()
      .caja(0.056, 0.110, 0.030, C.oscuro, [0, 0, 0])
      .cil(0.0045, 0.0030, 0.090, C.goma, [-0.018, 0.100, 0], [0, 0, 0], 6)
      .cil(0.008, 0.008, 0.014, C.gris, [0.016, 0.062, 0], [0, 0, 0], 8)
      .caja(0.040, 0.034, 0.002, C.gris, [0, 0.022, 0.016])
      .caja(0.008, 0.030, 0.012, C.naranja, [-0.030, 0.010, 0]);
    return { geometria: a.terminar(), radio: 0.075, agarre: agarre('cilindro', { pos: [0, 0.0, 0], rot: [-0.45, 0, 0], radioMango: 0.016, punta: [0, 0.06, 0], direccion: [0, 1, 0] }) };
  },
  tablet() {
    const a = new Armado()
      .caja(0.270, 0.180, 0.012, C.oscuro, [0, 0, 0])
      .caja(0.020, 0.186, 0.018, C.goma, [-0.136, 0, 0])
      .caja(0.020, 0.186, 0.018, C.goma, [0.136, 0, 0]);
    const malla = { geometria: a.terminar(), radio: 0.13, agarre: agarre('plano', { pos: [-0.118, 0.035, -0.012], rot: [-0.5, 0, 0], radioMango: 0.006 }) };
    malla.pantalla = () => pantalla(0.240, 0.160, 960, 640, [0, 0, 0.0066]);
    return malla;
  },
  tarjeta() {
    const a = new Armado().caja(0.086, 0.054, 0.002, C.claro, [0, 0, 0]).caja(0.086, 0.012, 0.0024, C.azul, [0, 0.021, 0]).caja(0.022, 0.026, 0.0024, C.celeste, [-0.026, -0.006, 0]);
    return { geometria: a.terminar(), radio: 0.045, agarre: agarre('pinza', { pos: [-0.030, 0.040, -0.030], rot: [-0.5, 0, 0], radioMango: 0.002 }) };
  },
};

export const TIPOS_HERRAMIENTA = Object.keys(MODELOS);
/** Qué herramienta reemplaza a cada objeto suelto del kit de Blender (por el nombre del nodo). */
export const REEMPLAZOS = { Escaner: 'escaner', Tableta: 'tablet', Linterna: 'linterna', Destornillador: 'destornillador', Llave: 'llave' };

export class FabricaHerramientas {
  /** @param {THREE.Texture|null} entorno */
  constructor(entorno = null) {
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.2, envMap: entorno, envMapIntensity: 0.6 });
    this._modelos = new Map();
  }

  /**
   * @param {keyof typeof MODELOS} tipo
   * @returns {{malla: THREE.Mesh, radio: number, agarre: object, pantalla: THREE.Mesh|null}}
   */
  crear(tipo) {
    let m = this._modelos.get(tipo);
    if (!m) { m = MODELOS[tipo](); this._modelos.set(tipo, m); }
    const malla = new THREE.Mesh(m.geometria, this.material);
    malla.name = `Herramienta_${tipo}`;
    let p = null;
    if (m.pantalla) { p = m.pantalla(); malla.add(p); }
    return { malla, radio: m.radio, agarre: m.agarre, pantalla: p };
  }
}
