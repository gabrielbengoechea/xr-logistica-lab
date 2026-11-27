// Manos del astronauta: lectura de los controles y un guante articulado por cada uno.
//
// Cada mano tiene palma, pulgar y cuatro dedos de tres falanges. Los dedos se mueven por cinemática directa
// hacia una pose objetivo que depende de lo que hace la mano (libre, apuntar, puño, baranda, pistola, cilindro,
// tablet…). Con controles no hay seguimiento de dedos: las poses salen del grip, el gatillo y lo que la mano
// sostiene, y se mezclan de a poco (sin saltos).
//
// Lo que se ve es un guante de astronauta modelado en Blender (artigas1-vr/Blender/guante.py): una sola malla
// cerrada por mano, con palma de goma, yemas, refuerzos en los nudillos, costuras y puño, que se deforma con 16
// huesos (palma, 12 falanges y 3 del pulgar). Los huesos salen de las mismas matrices de la cinemática, así que
// el guante coincide con las poses y los puntos de agarre. Mientras el guante no cargó (o si no carga) se ven
// las cápsulas de antes.
//
// Las manos son las del traje y salen de un cuerpo que se ve en primera persona: guante, puño de aluminio,
// antebrazo y brazo (cinemática inversa de dos huesos desde el hombro), y debajo de la cabeza el torso con la
// unidad de control del pecho y las piernas, que en gravedad cero quedan flexionadas hacia atrás. Todo va en
// la misma llamada de dibujo, con un color por pieza.
//
// Marcos de referencia:
//   - «herramienta» (mano.objeto): +Y hacia el pulgar, -Z hacia adelante (nudillos); la palma derecha mira a -X
//     y la izquierda a +X. Los objetos tomados se acomodan en este marco (ver js/herramientas.js).
//   - «modelo» de la mano derecha: dedos hacia -Z, palma hacia -Y, pulgar del lado -X. La izquierda es su espejo.
import * as THREE from 'three';
import { ManoGuante, cargarDatosGuante, geometriaGuante, materialGuante, rigida } from './guante.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { dibujarBandera } from './bandera.js';

/** Curvatura de cada falange (radianes) de índice, medio, anular y meñique; abanico; y pulgar [abre, f1, f2, f3]. */
export const POSES = {
  abierta: { dedos: [[0.05, 0.05, 0.03], [0.04, 0.05, 0.03], [0.05, 0.06, 0.03], [0.07, 0.07, 0.04]], abanico: 1.5, pulgar: [0.45, 0.05, 0.05, 0.05] },
  relajada: { dedos: [[0.22, 0.34, 0.20], [0.28, 0.40, 0.24], [0.34, 0.44, 0.26], [0.38, 0.46, 0.28]], abanico: 1.0, pulgar: [0.15, 0.20, 0.18, 0.12] },
  puno: { dedos: [[1.42, 1.62, 1.05], [1.45, 1.66, 1.08], [1.47, 1.66, 1.08], [1.48, 1.62, 1.05]], abanico: 0.3, pulgar: [-0.25, 0.55, 0.60, 0.75] },
  senalar: { dedos: [[0.04, 0.05, 0.03], [1.42, 1.62, 1.05], [1.45, 1.64, 1.06], [1.46, 1.60, 1.04]], abanico: 0.4, pulgar: [-0.25, 0.60, 0.70, 0.70] },
  boton: { dedos: [[0.10, 0.12, 0.08], [1.05, 1.30, 0.85], [1.15, 1.36, 0.90], [1.20, 1.36, 0.90]], abanico: 0.5, pulgar: [-0.10, 0.45, 0.55, 0.50] },
  baranda: { dedos: [[1.05, 1.38, 0.92], [1.08, 1.42, 0.95], [1.10, 1.42, 0.95], [1.12, 1.40, 0.92]], abanico: 0.4, pulgar: [-0.30, 0.50, 0.55, 0.60] },
  apoyo: { dedos: [[0.02, 0.04, 0.02], [0.02, 0.04, 0.02], [0.03, 0.05, 0.03], [0.05, 0.06, 0.04]], abanico: 1.2, pulgar: [0.40, 0.04, 0.04, 0.04] },
  cilindro: { dedos: [[1.00, 1.32, 0.88], [1.04, 1.36, 0.92], [1.06, 1.36, 0.92], [1.08, 1.34, 0.90]], abanico: 0.4, pulgar: [-0.20, 0.45, 0.50, 0.55] },
  pistola: { dedos: [[0.42, 0.62, 0.36], [1.04, 1.36, 0.92], [1.06, 1.36, 0.92], [1.08, 1.34, 0.90]], abanico: 0.4, pulgar: [-0.20, 0.45, 0.50, 0.45] },
  pistolaGatillo: { dedos: [[0.74, 1.05, 0.62], [1.04, 1.36, 0.92], [1.06, 1.36, 0.92], [1.08, 1.34, 0.90]], abanico: 0.4, pulgar: [-0.20, 0.45, 0.50, 0.45] },
  pinza: { dedos: [[0.62, 0.72, 0.42], [0.58, 0.66, 0.40], [0.66, 0.74, 0.46], [0.72, 0.78, 0.48]], abanico: 0.6, pulgar: [-0.05, 0.42, 0.40, 0.42] },
  plano: { dedos: [[0.30, 0.34, 0.22], [0.32, 0.36, 0.22], [0.34, 0.38, 0.24], [0.36, 0.40, 0.26]], abanico: 1.1, pulgar: [0.05, 0.36, 0.20, 0.25] },
  caja: { dedos: [[0.48, 0.52, 0.34], [0.50, 0.54, 0.34], [0.52, 0.56, 0.36], [0.54, 0.58, 0.38]], abanico: 1.4, pulgar: [0.35, 0.22, 0.26, 0.24] },
  // tablet del mapa tomada por el borde: dedos por detrás, curvados alrededor del marco; pulgar apoyado adelante
  tableta: { dedos: [[0.95, 0.55, 0.30], [1.00, 0.58, 0.32], [1.05, 0.60, 0.34], [1.10, 0.62, 0.36]], abanico: 0.55, pulgar: [0.10, 0.30, 0.20, 0.15] },
};

// Mano derecha en el marco «modelo» (metros). Medidas de una mano adulta media.
const DEDOS = [
  { base: [-0.030, 0.000, -0.046], largos: [0.042, 0.026, 0.021], radio: 0.0086, abanico: 0.10 },
  { base: [-0.010, 0.001, -0.051], largos: [0.046, 0.030, 0.022], radio: 0.0089, abanico: 0.02 },
  { base: [0.010, 0.000, -0.048], largos: [0.042, 0.028, 0.021], radio: 0.0083, abanico: -0.06 },
  { base: [0.028, -0.001, -0.041], largos: [0.033, 0.021, 0.018], radio: 0.0073, abanico: -0.15 },
];
const PULGAR = { base: [-0.033, -0.006, 0.014], largos: [0.040, 0.032, 0.026], radio: 0.0100 };
const PIEZAS_PALMA = [
  { pos: [0.000, 0.000, 0.000], escala: [0.041, 0.0135, 0.0190] },    // palma
  { pos: [-0.024, -0.008, 0.018], escala: [0.0165, 0.0140, 0.0105] }, // eminencia del pulgar
  { pos: [0.002, 0.001, 0.058], escala: [0.0290, 0.0190, 0.0110] },   // muñeca
];
const PIEZAS_PALMA_N = 3;
export const PIEZAS_POR_MANO = PIEZAS_PALMA.length + DEDOS.length * 3 + 3;   // 18
/** Puño del guante, antebrazo y brazo. */
export const PIEZAS_BRAZO = 3;
export const PIEZAS_POR_LADO = PIEZAS_POR_MANO + PIEZAS_BRAZO;                 // 21
const MANOS_MAX = 3;                                                           // izquierda, derecha y la de escritorio
/** Torso, unidad de control del pecho, cadera, dos muslos, dos piernas y dos botas. */
export const PIEZAS_CUERPO = 9;
/** Rodamientos de aluminio del traje (anillos): dos por brazo (hombro y sobre el codo) y el de la cintura. */
const AROS = MANOS_MAX * 2 + 1 + 4;
const ARO_CINTURA = MANOS_MAX * 2;
/** Rodamientos de las piernas: sobre cada rodilla y en el tobillo, donde empieza la bota. */
const AROS_PIERNA = ARO_CINTURA + 1;
/** Medidas del cuerpo (metros), desde los ojos. */
export const CUERPO = { hombroAbajo: 0.20, hombroAncho: 0.185, brazo: 0.30, antebrazo: 0.27, radioBrazo: 0.052, radioAntebrazo: 0.044 };
const COLOR_TRAJE = 0xe9e9e4;
const COLOR_GOMA = 0x6c7178;        // yemas y palma del guante
const COLOR_PUNO = 0x74acdf;        // aro del puño, celeste
const COLOR_EQUIPO = 0x9aa0a6;
const COLOR_BOTA = 0x4a4f57;
const COLOR_ARO = 0xb4bac2;         // rodamientos de aluminio anodizado
/** Rugosidad y metalicidad por tipo de pieza: tela técnica, goma, puño anodizado, equipo, rodamientos. */
const MATERIAL_PIEZA = { tela: [0.88, 0.0], goma: [0.95, 0.0], puno: [0.45, 0.55], equipo: [0.55, 0.35], aro: [0.38, 0.8], bota: [0.9, 0.0] };
const LARGO_BASE = 5;                                                          // la cápsula unitaria mide 5 de punta a punta
/** Pieza de la cinemática que mueve cada hueso del guante: palma, 12 falanges y 3 del pulgar. */
export const PIEZA_DE_HUESO = [0, ...Array.from({ length: 15 }, (_, i) => PIEZAS_PALMA_N + i)];
/** Color, rugosidad y metalicidad de cada zona del guante (tela, goma, yema, refuerzo, puño). */
export const ZONAS_GUANTE = [
  { color: 0xeceae4, rugosidad: 0.92, metal: 0.0 },   // tela técnica blanca
  { color: 0x5a6068, rugosidad: 0.96, metal: 0.0 },   // goma de agarre de la palma y los dedos
  { color: 0x3d4248, rugosidad: 0.90, metal: 0.0 },   // yemas reforzadas
  { color: 0x8e98a4, rugosidad: 0.58, metal: 0.35 },  // refuerzos aluminizados del dorso y los nudillos
  { color: 0xc8ced4, rugosidad: 0.80, metal: 0.05 },  // puño
];
/** Cuánto se infla el guante presurizado de la caminata (metros, a lo largo de la normal). */
const INFLADO_PRESURIZADO = 0.0022;

/** Presets para acomodar el marco «herramienta» al espacio de agarre del control (se elige en la tablet). */
export const CALIBRACIONES = [
  new THREE.Euler(-Math.PI / 2, 0, 0), new THREE.Euler(0, 0, 0), new THREE.Euler(Math.PI / 2, 0, 0), new THREE.Euler(Math.PI, 0, 0),
  new THREE.Euler(-Math.PI / 2, Math.PI, 0), new THREE.Euler(0, Math.PI, 0), new THREE.Euler(Math.PI / 2, Math.PI, 0), new THREE.Euler(Math.PI, Math.PI, 0),
];

const ESPEJO = new THREE.Matrix4().makeScale(-1, 1, 1);
const _a = new THREE.Matrix4();
const _b = new THREE.Matrix4();
const _c = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _s = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _cero = new THREE.Matrix4().makeScale(0, 0, 0);
const _w = new THREE.Vector3();
const _h = new THREE.Vector3();
const _e = new THREE.Vector3();
const _d = new THREE.Vector3();
const _polo = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _color = new THREE.Color();
const _q2 = new THREE.Quaternion();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _ejeZ = new THREE.Vector3(0, 0, 1);

/**
 * Matriz de una cápsula entre `a` y `b`. `rx` y `ry` son los radios de la sección; `ejeX` orienta el radio `rx`
 * (para secciones ovaladas, como el torso). La cápsula unitaria mide 5 a lo largo de Z y 1 de radio.
 */
export function capsulaEntre(out, a, b, rx, ry = rx, ejeX = null) {
  _z.subVectors(b, a);
  const largo = _z.length();
  if (largo < 1e-6) _z.set(0, 0, 1); else _z.multiplyScalar(1 / largo);
  if (ejeX) _x.copy(ejeX).addScaledVector(_z, -ejeX.dot(_z));
  else _x.set(1, 0, 0).addScaledVector(_z, -_z.x);
  if (_x.lengthSq() < 1e-8) _x.set(0, 1, 0).addScaledVector(_z, -_z.y);
  _x.normalize();
  _y.crossVectors(_z, _x);
  const sz = (largo + Math.min(rx, ry) * 1.2) / LARGO_BASE;
  out.makeBasis(_x, _y, _z);
  const e = out.elements;
  e[0] *= rx; e[1] *= rx; e[2] *= rx;
  e[4] *= ry; e[5] *= ry; e[6] *= ry;
  e[8] *= sz; e[9] *= sz; e[10] *= sz;
  return out.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

/** Matriz de un anillo (toro de radio 1 en el plano XY) centrado en `centro`, perpendicular a `eje`, de radio `r`. */
function aroEn(out, centro, eje, r) {
  _q2.setFromUnitVectors(_ejeZ, _v2.copy(eje).normalize());
  return out.compose(centro, _q2, _v3.set(r, r, r));
}

/**
 * Codo de un brazo de dos huesos entre el hombro y la muñeca. Si la muñeca queda más lejos que el brazo
 * estirado, el codo va sobre la recta (el brazo se estira para no despegarse de la mano).
 * @param {THREE.Vector3} hombro @param {THREE.Vector3} muneca @param {THREE.Vector3} polo  Hacia dónde dobla el codo.
 * @param {number} l1 Largo del brazo. @param {number} l2 Largo del antebrazo. @param {THREE.Vector3} out
 */
export function codo(hombro, muneca, polo, l1, l2, out) {
  _d.subVectors(muneca, hombro);
  const real = _d.length();
  if (real < 1e-5) return out.copy(hombro).addScaledVector(polo, l1);
  _d.multiplyScalar(1 / real);
  if (real >= l1 + l2 - 1e-4) return out.copy(hombro).addScaledVector(_d, real * l1 / (l1 + l2));
  const d = Math.max(real, Math.abs(l1 - l2) + 1e-4);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _polo.copy(polo).addScaledVector(_d, -polo.dot(_d));
  if (_polo.lengthSq() < 1e-8) _polo.set(0, -1, 0).addScaledVector(_d, _d.y);
  _polo.normalize();
  return out.copy(hombro).addScaledVector(_d, a).addScaledVector(_polo, h);
}

function copiarPose(p) {
  return { dedos: p.dedos.map((d) => d.slice()), abanico: p.abanico, pulgar: p.pulgar.slice() };
}

/** Acerca `actual` a `meta` (mezcla exponencial). `indice` reemplaza la pose del índice (gatillo). */
function mezclarPose(actual, meta, k, indice = null) {
  for (let d = 0; d < 4; d++) {
    const m = d === 0 && indice ? indice : meta.dedos[d];
    for (let j = 0; j < 3; j++) actual.dedos[d][j] += (m[j] - actual.dedos[d][j]) * k;
  }
  actual.abanico += (meta.abanico - actual.abanico) * k;
  for (let j = 0; j < 4; j++) actual.pulgar[j] += (meta.pulgar[j] - actual.pulgar[j]) * k;
}

/**
 * Matrices de las 18 piezas de la mano derecha en el marco «modelo» y posición de la punta del índice.
 * @param {ReturnType<typeof copiarPose>} pose @param {THREE.Matrix4[]} out @param {THREE.Vector3} punta
 * @param {number} grosor 1 = mano desnuda; más = guante.
 */
export function cinematicaMano(pose, out, punta, grosor = 1) {
  let n = 0;
  for (const p of PIEZAS_PALMA) {
    out[n++].makeScale(p.escala[0] * grosor, p.escala[1] * grosor, p.escala[2] * (0.5 + 0.5 * grosor)).setPosition(p.pos[0], p.pos[1], p.pos[2]);
  }
  for (let d = 0; d < 4; d++) {
    const def = DEDOS[d];
    const c = pose.dedos[d];
    _a.makeTranslation(def.base[0], def.base[1], def.base[2]).multiply(_r.makeRotationY(def.abanico * pose.abanico));
    for (let j = 0; j < 3; j++) {
      _a.multiply(_r.makeRotationX(-c[j]));
      const l = def.largos[j];
      const rad = def.radio * (1 - 0.07 * j) * grosor;
      out[n++].copy(_a).multiply(_t.makeTranslation(0, 0, -l / 2)).multiply(_s.makeScale(rad, rad, (l + rad * 1.3) / LARGO_BASE));
      _a.multiply(_t.makeTranslation(0, 0, -l));
    }
    if (d === 0) punta.setFromMatrixPosition(_a);
  }
  // pulgar: sale hacia adelante y al costado, y flexiona hacia el índice
  const p = pose.pulgar;
  _a.makeTranslation(PULGAR.base[0], PULGAR.base[1], PULGAR.base[2]).multiply(_r.makeRotationY(0.85 + p[0])).multiply(_r.makeRotationZ(1.0));
  for (let j = 0; j < 3; j++) {
    _a.multiply(_r.makeRotationX(-p[j + 1]));
    const l = PULGAR.largos[j];
    const rad = PULGAR.radio * (1 - 0.06 * j) * grosor;
    out[n++].copy(_a).multiply(_t.makeTranslation(0, 0, -l / 2)).multiply(_s.makeScale(rad, rad, (l + rad * 1.3) / LARGO_BASE));
    _a.multiply(_t.makeTranslation(0, 0, -l));
  }
  return n;
}

function crearMano(indice) {
  const objeto = new THREE.Object3D();          // marco «herramienta»
  objeto.name = `Mano_${indice}`;
  return {
    indice, lado: indice === 0 ? 'left' : 'right', objeto, posicion: new THREE.Vector3(), punta: new THREE.Vector3(),
    cerrada: false, grip: 0, gatillo: 0, gatilloApretado: false, gatilloNuevo: false, ejes: [0, 0], botones: [false, false, false],
    agarre: null, cerca: null, sostiene: null, cercaObjeto: false, objetoCercano: null, nuevoAgarre: false, apunta: false,
    ocupada: false, sostieneMapa: false,
    conectada: false, fuente: null, apuntador: null, virtual: false,
    muneca: new THREE.Vector3(), codo: new THREE.Vector3(), hombro: new THREE.Vector3(),
    pose: copiarPose(POSES.relajada), _matrices: Array.from({ length: PIEZAS_POR_MANO }, () => new THREE.Matrix4()),
    _puntaLocal: new THREE.Vector3(), _radioMango: 0.016,
  };
}

/**
 * Módulo de control del pecho (DCM) y parche de la bandera, en geometría propia: lo que se ve al mirar hacia abajo.
 * Marco local del pecho: X a la derecha del cuerpo, Y arriba, -Z adelante. Una malla con color por vértice para el
 * equipo y un plano con textura (lienzo 2D, sin imágenes externas) para la pantalla y los rótulos.
 */
function crearPechoYParche() {
  const piezas = [];
  const color = new THREE.Color();
  const sumar = (g, hex, m) => {
    const geo = g.index ? g.toNonIndexed() : g;
    geo.applyMatrix4(m);
    color.setHex(hex, THREE.SRGBColorSpace);
    const n = geo.getAttribute('position').count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geo.deleteAttribute('uv');
    piezas.push(geo);
  };
  // se arma con la tapa hacia arriba (+Y) y el frente hacia -Z; después todo el módulo se inclina hacia los ojos
  const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const inclinacion = 0.55;
  sumar(new THREE.BoxGeometry(0.24, 0.10, 0.075), 0x9aa0a6, T(0, 0, 0));
  sumar(new THREE.BoxGeometry(0.25, 0.012, 0.085), 0x6e757d, T(0, 0.056, 0));                              // tapa
  sumar(new THREE.BoxGeometry(0.15, 0.06, 0.08), 0x7b838d, T(0, -0.01, 0.075));                            // soporte contra el pecho
  // perillas de temperatura y de modo, válvula de purga (roja) y conectores de agua y oxígeno a los costados
  for (const [x, hex] of [[-0.09, 0x2b3038], [0.09, 0x2b3038], [0.0, 0xc8102e]]) sumar(new THREE.CylinderGeometry(0.012, 0.014, 0.016, 12), hex, T(x, 0.07, -0.028));
  for (const s of [-1, 1]) {
    sumar(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 12).rotateZ(Math.PI / 2), 0x0038a8, T(s * 0.135, -0.01, 0));
    sumar(new THREE.TorusGeometry(0.018, 0.004, 6, 14).rotateY(Math.PI / 2), 0xb4bac2, T(s * 0.152, -0.01, 0));
  }
  const geo = mergeGeometries(piezas, false);
  geo.computeVertexNormals();
  const pecho = new THREE.Group();
  pecho.name = 'Traje_Pecho';
  pecho.matrixAutoUpdate = false;
  const modulo = new THREE.Group();
  modulo.rotation.x = inclinacion;
  pecho.add(modulo);
  modulo.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 })));

  // lienzo: pantalla del módulo (izquierda) y bandera (derecha)
  const lienzo = document.createElement('canvas');
  lienzo.width = 512; lienzo.height = 128;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#0c1116'; ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#7fe0a0'; ctx.font = 'bold 30px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('ARTIGAS-1', 16, 34);
  ctx.fillStyle = '#9fb6c8'; ctx.font = '600 22px monospace';
  ctx.fillText('EV1 · ART1-01', 16, 74);
  ctx.fillText('XR LOGÍSTICA LAB', 16, 106);
  ctx.fillStyle = '#e8e8e3'; ctx.fillRect(256, 0, 256, 128);
  dibujarBandera(ctx, 268, 14, 232, 100);
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const plano = (u0, u1, ancho, alto, emisivo) => {
    const g = new THREE.PlaneGeometry(ancho, alto);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + (u1 - u0) * uv.getX(i));
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0, emissive: emisivo ? 0xffffff : 0x000000, emissiveMap: emisivo ? tex : null, emissiveIntensity: emisivo ? 0.6 : 0 }));
  };
  // pantalla sobre la tapa, detrás de las perillas (queda mirando hacia los ojos por la inclinación del módulo)
  const pantalla = plano(0, 0.5, 0.11, 0.055, true);
  pantalla.rotation.x = -Math.PI / 2;
  pantalla.position.set(0, 0.0625, 0.012);
  modulo.add(pantalla);
  const parche = plano(0.5, 1, 0.075, 0.0375, false);
  parche.name = 'Traje_Parche_Bandera';
  parche.matrixAutoUpdate = false;
  parche.visible = false;
  pecho.visible = false;
  return { pecho, parche };
}

/**
 * Torso rígido del traje (fibra de vidrio), calzón y aro del cuello, torneados con un perfil y aplastados de adelante
 * hacia atrás. Marco local: origen en los ojos, X a la derecha del cuerpo, Y arriba, -Z adelante.
 *
 * El torso cierra arriba, debajo del mentón, sin aro del cuello: el aro queda dentro del casco (que en primera persona
 * no se dibuja), y a 20 cm de los ojos tapaba el pecho. Así, al mirar hacia abajo se ven el pecho y el módulo de
 * control. Los hombros salen de una pieza transversal (el yugo) que llega hasta las mangas.
 */
function crearTorso() {
  const tela = [], metal = [];
  const color = new THREE.Color();
  const sumar = (lista, g, hex, m = null) => {
    const geo = g.index ? g.toNonIndexed() : g;
    if (m) geo.applyMatrix4(m);
    color.setHex(hex, THREE.SRGBColorSpace);
    const n = geo.getAttribute('position').count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
    lista.push(geo);
  };
  const PROFUNDO = 0.70;                                    // el torso es más ancho que profundo
  const aplastar = new THREE.Matrix4().makeScale(1, 1, PROFUNDO);
  const V2 = (r, y) => new THREE.Vector2(r, y);
  // torso rígido, del aro del cuello a la cintura (radio, altura desde los ojos); el torno va de abajo hacia arriba
  // para que las normales queden hacia afuera
  const perfilTorso = [V2(0.0, -0.248), V2(0.09, -0.252), V2(0.14, -0.262), V2(0.178, -0.278), V2(0.200, -0.30), V2(0.212, -0.34), V2(0.212, -0.40), V2(0.200, -0.47), V2(0.184, -0.54), V2(0.172, -0.585)];
  sumar(tela, new THREE.LatheGeometry(perfilTorso.reverse(), 28), 0xe9e9e4, aplastar);
  // calzón (debajo del rodamiento de la cintura) hasta la cadera
  const perfilCalzon = [V2(0.170, -0.595), V2(0.172, -0.64), V2(0.160, -0.69), V2(0.130, -0.73), V2(0.07, -0.755)];
  sumar(tela, new THREE.LatheGeometry(perfilCalzon.reverse(), 24), 0xdfe0da, new THREE.Matrix4().makeScale(1, 1, 0.78));
  // costuras horizontales del torso y franja de la cintura
  for (const [r, y] of [[0.212, -0.37], [0.192, -0.50]]) sumar(tela, new THREE.TorusGeometry(r + 0.001, 0.0028, 4, 40).rotateX(Math.PI / 2), 0xb8bab4, new THREE.Matrix4().makeTranslation(0, y, 0).premultiply(aplastar));
  // yugo de los hombros: une el torso con las mangas (los hombros del cuerpo están a 0,185 m del centro)
  sumar(tela, new THREE.CapsuleGeometry(0.052, 0.26, 4, 12).rotateZ(Math.PI / 2), 0xe9e9e4, new THREE.Matrix4().makeScale(1, 0.8, 0.9).setPosition(0, -0.262, 0.045));
  // anclajes del cable de seguridad a los costados de la cintura
  for (const s of [-1, 1]) sumar(metal, new THREE.TorusGeometry(0.016, 0.004, 6, 14).rotateY(Math.PI / 2), 0x8c939b, new THREE.Matrix4().makeTranslation(s * 0.178, -0.62, -0.02));
  const grupo = new THREE.Group();
  grupo.name = 'Traje_Torso';
  grupo.matrixAutoUpdate = false;
  // las normales de cada pieza ya vienen suaves (y applyMatrix4 las transforma): no se recalculan
  const gTela = mergeGeometries(tela, false);
  const gMetal = mergeGeometries(metal, false);
  grupo.add(new THREE.Mesh(gTela, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 })));
  grupo.add(new THREE.Mesh(gMetal, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.8 })));
  for (const m of grupo.children) m.frustumCulled = false;
  grupo.visible = false;
  return grupo;
}

export class Manos {
  /**
   * @param {THREE.WebGLRenderer} renderer @param {THREE.Object3D} rig @param {THREE.Scene} escena
   * @param {THREE.Camera} camara  La mano de escritorio va sujeta a la cámara.
   */
  constructor(renderer, rig, escena, camara) {
    this.renderer = renderer;
    this.rig = rig;
    this.camara = camara;
    /** Estado que consumen la locomoción y la interacción: una entrada por mano activa. */
    this.lista = [];
    this.grosor = 1.12;                           // guante de cabina; 1,28 con el guante presurizado de la caminata
    this.calibracion = 0;
    /** Se puede apagar el cuerpo en primera persona (queda solo el guante con su puño). */
    this.cuerpoVisible = true;
    /** Oculta solo torso y piernas (los brazos siguen): en la Cúpula, al mirar abajo, el cuerpo tapaba la ventana (B17). */
    this.ocultarTorso = false;
    this._porIndice = [];
    this._frente = new THREE.Vector3(0, 0, -1);
    this._material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.0 });
    // rugosidad y metalicidad por pieza (atributo por instancia): la tela es mate, los rodamientos brillan
    // Tercer valor del atributo (costuras de la tela): 0 sin costuras; 0,5 dos costuras; ±1 además el fuelle de la
    // articulación (los pliegues de tela del codo y la rodilla) en el extremo +Z o -Z de la cápsula. Se calcula en
    // las coordenadas de la cápsula unitaria (Z de -2,5 a 2,5): no hace falta textura ni UV.
    this._material.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aRugMetal;\nvarying vec3 vRugMetal;\nvarying float vLargo;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRugMetal = aRugMetal;\nvLargo = position.z;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vRugMetal;
varying float vLargo;
float banda(float z, float c, float a) { float w = max(fwidth(z), 1e-4); return 1.0 - smoothstep(a - w, a + w, abs(z - c)); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        if (vRugMetal.z != 0.0) {
          float costura = max(banda(vLargo, -0.7, 0.035), banda(vLargo, 0.7, 0.035));
          diffuseColor.rgb *= 1.0 - 0.22 * costura;
          if (abs(vRugMetal.z) > 0.75) {
            // fuelle: pliegues cada 0,22 unidades entre 0,9 y 1,9 del extremo; el sombreado sigue el pliegue
            float z = vLargo * sign(vRugMetal.z);
            float dentro = smoothstep(0.85, 1.0, z) * (1.0 - smoothstep(1.8, 1.95, z));
            float w = fwidth(z) * 4.0;
            float pliegue = 0.5 + 0.5 * cos(z * 6.2831853 / 0.22);
            pliegue = mix(pliegue, 0.5, clamp(w / 0.22, 0.0, 1.0));      // lejos, el pliegue se funde (sin titileo)
            diffuseColor.rgb *= 1.0 - 0.20 * dentro * pliegue;
          }
        }`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vRugMetal.x;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vRugMetal.y;');
    };
    const capsula = new THREE.CapsuleGeometry(1, 3, 3, 8);
    capsula.rotateX(Math.PI / 2);                 // a lo largo de Z
    const total = MANOS_MAX * PIEZAS_POR_LADO + PIEZAS_CUERPO;
    const rugMetal = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
    capsula.setAttribute('aRugMetal', rugMetal);
    this.malla = new THREE.InstancedMesh(capsula, this._material, total);
    this.malla.name = 'Manos_y_Cuerpo';
    this.malla.frustumCulled = false;
    this.malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < this.malla.count; i++) this.malla.setMatrixAt(i, _cero);
    // un color por pieza: guante blanco con palma y yemas de goma, puño celeste, mangas blancas
    for (let m = 0; m < MANOS_MAX; m++) {
      const base = m * PIEZAS_POR_LADO;
      for (let i = 0; i < PIEZAS_POR_LADO; i++) {
        const yema = i >= PIEZAS_PALMA.length && i < PIEZAS_POR_MANO && (i - PIEZAS_PALMA.length) % 3 === 2;
        const goma = i === 0 || i === 1 || yema, puno = i === PIEZAS_POR_MANO;
        this.malla.setColorAt(base + i, _color.set(goma ? COLOR_GOMA : puno ? COLOR_PUNO : COLOR_TRAJE));
        // antebrazo (codo en -Z) y brazo (codo en +Z): fuelle del lado del codo
        const costuras = i === PIEZAS_POR_MANO + 1 ? -1 : i === PIEZAS_POR_MANO + 2 ? 1 : 0;
        rugMetal.setXYZ(base + i, ...MATERIAL_PIEZA[goma ? 'goma' : puno ? 'puno' : 'tela'], costuras);
      }
    }
    const cuerpo = MANOS_MAX * PIEZAS_POR_LADO;
    // muslos con la rodilla en +Z y piernas con la rodilla en -Z (el fuelle va del lado de la rodilla)
    const piezas = [['tela', COLOR_TRAJE, 0.5], ['equipo', COLOR_EQUIPO, 0], ['tela', COLOR_TRAJE, 0], ['tela', COLOR_TRAJE, 1], ['tela', COLOR_TRAJE, 1],
      ['tela', COLOR_TRAJE, -1], ['tela', COLOR_TRAJE, -1], ['bota', COLOR_BOTA, 0], ['bota', COLOR_BOTA, 0]];
    piezas.forEach(([tipo, c, costuras], i) => { this.malla.setColorAt(cuerpo + i, _color.set(c)); rugMetal.setXYZ(cuerpo + i, ...MATERIAL_PIEZA[tipo], costuras); });
    this.malla.instanceColor.needsUpdate = true;
    escena.add(this.malla);
    // rodamientos: anillos de aluminio en una malla instanciada aparte (una llamada de dibujo)
    this.aros = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.085, 6, 24), new THREE.MeshStandardMaterial({ color: COLOR_ARO, roughness: MATERIAL_PIEZA.aro[0], metalness: MATERIAL_PIEZA.aro[1] }), AROS);
    this.aros.name = 'Traje_Rodamientos';
    this.aros.frustumCulled = false;
    this.aros.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < AROS; i++) this.aros.setMatrixAt(i, _cero);
    escena.add(this.aros);
    // módulo de control del pecho y parche de la bandera en el brazo izquierdo (ver crearPechoYParche)
    const { pecho, parche } = crearPechoYParche();
    this.pecho = pecho;
    this.parche = parche;
    this.torso = crearTorso();
    escena.add(pecho, parche, this.torso);

    for (let i = 0; i < 2; i++) {
      const agarre = renderer.xr.getControllerGrip(i);
      const mano = crearMano(i);
      mano.apuntador = renderer.xr.getController(i);
      agarre.add(mano.objeto);
      rig.add(agarre, mano.apuntador);
      agarre.addEventListener('connected', (e) => {
        mano.lado = e.data.handedness === 'left' ? 'left' : 'right';
        mano.fuente = e.data;
        mano.conectada = true;
        this._rearmar();
      });
      agarre.addEventListener('disconnected', () => {
        mano.conectada = false;
        mano.agarre = null;
        mano.cerrada = false;                     // al quedar abierta, la interacción suelta lo que tuviera
        this._rearmar();
      });
      this._porIndice.push(mano);
    }
    // Mano de escritorio: una mano derecha delante de la cámara, para jugar y probar sin visor.
    this.escritorio = crearMano(2);
    this.escritorio.virtual = true;
    this.escritorio.lado = 'right';
    this.escritorio.objeto.position.set(0.21, -0.17, -0.42);
    this.escritorio.objeto.rotation.set(0.45, 0.18, 0);
    this.escritorio.apuntador = camara;
    camara.add(this.escritorio.objeto);
    this.usarEscritorio = true;
    this.calibrar(this._leerCalibracion());
    this._rearmar();
    /** Guantes (uno por mano) cuando termina de cargar guante.bin; hasta entonces, las cápsulas. */
    this.guantes = null;
    this.escena = escena;
  }

  /**
   * Carga el guante modelado en Blender y lo pone en las tres manos. Si falla, quedan las cápsulas.
   * @param {string} base  Carpeta de guante.json y guante.bin (con la barra final).
   * @param {THREE.Texture|null} entorno
   */
  async cargarGuante(base, entorno = null) {
    const d = await cargarDatosGuante(base);
    const pose = d.info.pose;
    const mats = Array.from({ length: PIEZAS_POR_MANO }, () => new THREE.Matrix4());
    cinematicaMano({ dedos: pose.dedos.map((x) => x.slice()), abanico: pose.abanico, pulgar: pose.pulgar.slice() }, mats, new THREE.Vector3(), 1);
    const reposo = PIEZA_DE_HUESO.map((pieza) => rigida(new THREE.Matrix4(), mats[pieza]));
    // el esqueleto del .bin tiene que ser el mismo que el de la cinemática
    const desvio = Math.max(...reposo.map((m, i) => _v.setFromMatrixPosition(m).distanceTo(_w.fromArray(d.info.centros[i]))));
    if (desvio > 0.0005) throw new Error(`guante: los huesos del modelo no coinciden con la cinemática (${(desvio * 1000).toFixed(2)} mm)`);
    const geos = {
      derecha: geometriaGuante(d, false, 0, ZONAS_GUANTE),
      izquierda: geometriaGuante(d, true, 0, ZONAS_GUANTE),
      derechaP: geometriaGuante(d, false, INFLADO_PRESURIZADO, ZONAS_GUANTE),
      izquierdaP: geometriaGuante(d, true, INFLADO_PRESURIZADO, ZONAS_GUANTE),
    };
    const material = materialGuante(entorno);
    this.guantes = [0, 1, 2].map(() => new ManoGuante(geos, reposo, material));
    for (const g of this.guantes) this.escena.add(g.malla);
    this.desvioGuante = desvio;
    this.verticesGuante = d.info.vertices;
    return this.guantes;
  }

  _leerCalibracion() {
    try { return Number(window.localStorage.getItem('artigas1.calibracionManos')) || 0; } catch { return 0; }
  }

  /** Elige cómo se acomoda la mano respecto del control (0 a 7). Se guarda en este navegador. */
  calibrar(n) {
    this.calibracion = ((n % CALIBRACIONES.length) + CALIBRACIONES.length) % CALIBRACIONES.length;
    for (const m of this._porIndice) m.objeto.rotation.copy(CALIBRACIONES[this.calibracion]);
    try { window.localStorage.setItem('artigas1.calibracionManos', String(this.calibracion)); } catch { /* sin almacenamiento: no se guarda */ }
  }

  /** Guante presurizado de la caminata espacial (más grueso) o guante de cabina. La mano siempre es la del traje. */
  ponerGuantes(si) {
    this.grosor = si ? 1.28 : 1.12;
  }

  _rearmar() {
    const xr = this._porIndice.filter((m) => m.conectada);
    this.lista = xr.length || !this.usarEscritorio ? xr : [this.escritorio];
  }

  mano(lado) {
    return this.lista.find((m) => m.lado === lado) || null;
  }

  /** Lee los controles. Se llama una vez por cuadro, antes de la interacción y la locomoción. */
  leer() {
    this._rearmar();
    for (const m of this.lista) {
      m.objeto.updateWorldMatrix(true, false);
      m.posicion.setFromMatrixPosition(m.objeto.matrixWorld);
      if (m.virtual) continue;                    // la de escritorio la maneja el teclado
      const gp = m.fuente?.gamepad;
      const b = gp ? gp.buttons : [];
      m.gatillo = b[0] ? b[0].value : 0;
      m.grip = b[1] ? b[1].value : 0;
      // la mano que sostiene la tablet del mapa no toma nada más ni se agarra de la estación
      m.cerrada = !m.ocupada && !!b[1] && (b[1].pressed || b[1].value > 0.6);
      m.ejes[0] = gp && gp.axes.length >= 4 ? gp.axes[2] : 0;
      m.ejes[1] = gp && gp.axes.length >= 4 ? gp.axes[3] : 0;
      m.botones[0] = !!b[4]?.pressed;             // A o X
      m.botones[1] = !!b[5]?.pressed;             // B o Y
      m.botones[2] = !!b[3]?.pressed;             // clic del stick
    }
    for (const m of this.lista) {
      // gatillo con histéresis: se arma al 60 % y se suelta al 30 %
      const antes = m.gatilloApretado;
      if (m.gatillo > 0.6) m.gatilloApretado = true; else if (m.gatillo < 0.3) m.gatilloApretado = false;
      m.gatilloNuevo = m.gatilloApretado && !antes;
    }
  }

  _poseObjetivo(m) {
    if (m.sostieneMapa) return { meta: POSES.tableta };
    if (m.sostiene) {
      const pose = m.sostiene.agarre?.pose || (m.sostiene.radio > 0.07 ? 'caja' : 'pinza');
      if (pose === 'pistola') return { meta: POSES.pistola, indice: m.gatillo > 0.05 ? POSES.pistolaGatillo.dedos[0] : null, mezclaIndice: m.gatillo };
      return { meta: POSES[pose] || POSES.cilindro };
    }
    if (m.agarre) return { meta: m.agarre.tipo === 'baranda' ? POSES.baranda : POSES.apoyo };
    if (m.apunta) return { meta: POSES.boton };
    if (m.grip > 0.5 || m.cerrada) return { meta: m.gatillo > 0.4 ? POSES.puno : POSES.senalar };
    if (m.cerca || m.cercaObjeto) return { meta: POSES.abierta };
    return { meta: POSES.relajada, indice: m.gatillo > 0.05 ? POSES.boton.dedos[1] : null, mezclaIndice: m.gatillo };
  }

  /** Después de la interacción: poses, matrices de las piezas y vibración. */
  mostrar(dt = 1 / 72) {
    const k = 1 - Math.exp(-16 * dt);
    const activas = new Set(this.lista);
    // marco del cuerpo: arriba es el del rig; el frente sigue a la cabeza con un poco de retraso
    this.camara.updateWorldMatrix(true, false);
    const ojos = _h.setFromMatrixPosition(this.camara.matrixWorld);
    const arriba = _p1.set(0, 1, 0).applyQuaternion(this.rig.quaternion);
    this.camara.getWorldDirection(_w);
    _w.addScaledVector(arriba, -_w.dot(arriba));
    if (_w.lengthSq() > 0.02) this._frente.lerp(_w.normalize(), 1 - Math.exp(-6 * dt));
    this._frente.addScaledVector(arriba, -this._frente.dot(arriba)).normalize();
    const frente = this._frente;
    const derechaCuerpo = _p2.crossVectors(frente, arriba).normalize();
    const g = 0.86 + 0.14 * this.grosor;          // mangas un poco más gruesas con el traje presurizado
    let parcheDibujado = false;
    for (const m of [...this._porIndice, this.escritorio]) {
      const base = m.indice * PIEZAS_POR_LADO;
      const guante = this.guantes ? this.guantes[m.indice] : null;
      if (!activas.has(m)) {
        if (m._visible !== false) {
          for (let i = 0; i < PIEZAS_POR_LADO; i++) this.malla.setMatrixAt(base + i, _cero);
          for (let i = 0; i < 2; i++) this.aros.setMatrixAt(m.indice * 2 + i, _cero);
          m._visible = false;
        }
        if (guante) guante.malla.visible = false;
        continue;
      }
      m._visible = true;
      const o = this._poseObjetivo(m);
      let indice = null;
      if (o.indice) {
        // el índice acompaña al gatillo: mezcla entre su pose y la de apretar
        indice = m._indiceTmp || (m._indiceTmp = [0, 0, 0]);
        for (let j = 0; j < 3; j++) indice[j] = o.meta.dedos[0][j] + (o.indice[j] - o.meta.dedos[0][j]) * Math.min(1, o.mezclaIndice);
      }
      mezclarPose(m.pose, o.meta, k, indice);
      cinematicaMano(m.pose, m._matrices, m._puntaLocal, this.grosor);
      // modelo -> herramienta: la palma derecha mira a -X; la izquierda es el espejo
      const derecha = m.lado !== 'left';
      const mango = (m.sostiene?.agarre?.radioMango ?? m._radioMango) + 0.0135 * this.grosor;
      _b.makeRotationZ(-Math.PI / 2).setPosition(mango, -0.012, 0.012);
      m.objeto.updateWorldMatrix(true, false);
      for (let i = 0; i < PIEZAS_POR_MANO; i++) {
        _c.multiplyMatrices(_b, m._matrices[i]);
        if (!derecha) _c.premultiply(ESPEJO).multiply(ESPEJO);
        _c.premultiply(m.objeto.matrixWorld);
        if (i === 2) m.muneca.setFromMatrixPosition(_c);
        // con el guante cargado, las cápsulas de la mano no se dibujan (quedan el puño, los brazos y el cuerpo)
        this.malla.setMatrixAt(base + i, guante ? _cero : _c);
      }
      if (guante) {
        guante.usar(!derecha, this.grosor > 1.2);
        guante.malla.visible = true;
        for (let h = 0; h < PIEZA_DE_HUESO.length; h++) {
          const hueso = guante.huesos[h];
          rigida(_c, m._matrices[PIEZA_DE_HUESO[h]]).premultiply(_b);
          if (!derecha) _c.premultiply(ESPEJO).multiply(ESPEJO);
          hueso.matrixWorld.multiplyMatrices(m.objeto.matrixWorld, _c);
        }
      }
      _v.copy(m._puntaLocal).applyMatrix4(_b);
      if (!derecha) _v.x = -_v.x;
      m.punta.copy(_v).applyMatrix4(m.objeto.matrixWorld);
      // --- puño, antebrazo y brazo: de la muñeca al hombro de ese lado
      const muneca = m.muneca;
      const lado = derecha ? 1 : -1;
      const hombro = m.hombro.copy(ojos).addScaledVector(arriba, -CUERPO.hombroAbajo).addScaledVector(derechaCuerpo, lado * CUERPO.hombroAncho).addScaledVector(frente, -0.03);
      _polo.copy(arriba).multiplyScalar(-0.75).addScaledVector(derechaCuerpo, lado * 0.55).addScaledVector(frente, -0.35);
      const elCodo = codo(hombro, muneca, _e.copy(_polo), CUERPO.brazo, CUERPO.antebrazo, m.codo);
      _d.subVectors(muneca, elCodo).normalize();
      this.malla.setMatrixAt(base + PIEZAS_POR_MANO, capsulaEntre(_c, _w.copy(muneca).addScaledVector(_d, -0.006), _e.copy(muneca).addScaledVector(_d, 0.006), 0.041 * g));
      if (this.cuerpoVisible) {
        this.malla.setMatrixAt(base + PIEZAS_POR_MANO + 1, capsulaEntre(_c, elCodo, muneca, CUERPO.radioAntebrazo * g));
        this.malla.setMatrixAt(base + PIEZAS_POR_MANO + 2, capsulaEntre(_c, hombro, elCodo, CUERPO.radioBrazo * g));
        // rodamientos del traje: uno cerca del hombro y otro sobre el codo, apenas más anchos que la manga
        _d.subVectors(elCodo, hombro).normalize();
        this.aros.setMatrixAt(m.indice * 2, aroEn(_c, _w.copy(hombro).addScaledVector(_d, 0.05), _d, CUERPO.radioBrazo * g * 1.02));
        this.aros.setMatrixAt(m.indice * 2 + 1, aroEn(_c, _w.copy(elCodo).addScaledVector(_d, -0.07), _d, CUERPO.radioBrazo * g * 0.99));
        if (!derecha) {
          // parche de la bandera: en la cara de afuera del brazo izquierdo, a un tercio del hombro
          // hacia afuera: del eje del torso al brazo, perpendicular al brazo (cara del deltoides)
          _w.copy(hombro).addScaledVector(_d, 0.10);
          _x.copy(_w).sub(ojos).addScaledVector(arriba, 0.40).addScaledVector(frente, 0.04);
          _x.addScaledVector(arriba, -_x.dot(arriba) * 0.6);
          _x.addScaledVector(_d, -_x.dot(_d)).normalize();
          // el largo de la bandera corre a lo largo del brazo: así el parche plano no se hunde en la manga curva
          _y.crossVectors(_x, _d);
          _w.addScaledVector(_x, CUERPO.radioBrazo * g + 0.003);
          this.parche.matrix.makeBasis(_d, _y, _x).setPosition(_w);
          this.parche.matrixWorldNeedsUpdate = true;
          this.parche.visible = true;
          parcheDibujado = true;
        }
      } else {
        this.malla.setMatrixAt(base + PIEZAS_POR_MANO + 1, _cero);
        this.malla.setMatrixAt(base + PIEZAS_POR_MANO + 2, _cero);
        for (let i = 0; i < 2; i++) this.aros.setMatrixAt(m.indice * 2 + i, _cero);
      }
      if (m.nuevoAgarre) {
        m.nuevoAgarre = false;
        this.vibrar(m, 0.5, 40);
      }
    }
    if (!parcheDibujado) this.parche.visible = false;
    this._cuerpo(ojos, arriba, frente, derechaCuerpo, g);
    this.malla.instanceMatrix.needsUpdate = true;
    this.aros.instanceMatrix.needsUpdate = true;
  }

  /** Torso, unidad de control, cadera y piernas debajo de la cabeza: se ven al mirar hacia abajo. */
  _cuerpo(ojos, arriba, frente, derecha, g) {
    const base = MANOS_MAX * PIEZAS_POR_LADO;
    if (!this.cuerpoVisible || this.ocultarTorso) {
      if (this._cuerpoDibujado !== false) {
        for (let i = 0; i < PIEZAS_CUERPO; i++) this.malla.setMatrixAt(base + i, _cero);
        for (let i = ARO_CINTURA; i < AROS; i++) this.aros.setMatrixAt(i, _cero);
        this._cuerpoDibujado = false;
      }
      this.pecho.visible = false;
      this.torso.visible = false;
      return;
    }
    this._cuerpoDibujado = true;
    const P = (out, abajo, adelante, alCostado) => out.copy(ojos).addScaledVector(arriba, -abajo).addScaledVector(frente, adelante).addScaledVector(derecha, alCostado);
    // torso rígido y calzón: malla torneada propia (ver crearTorso), en el marco del cuerpo con origen en los ojos
    this.malla.setMatrixAt(base, _cero);
    _z.copy(frente).negate();
    this.torso.matrix.makeBasis(derecha, arriba, _z).multiply(_s.makeScale(g, 1, g)).setPosition(P(_w, 0, -0.045, 0));
    this.torso.matrixWorldNeedsUpdate = true;
    this.torso.visible = true;
    // unidad de control sobre el pecho: malla propia con pantalla, perillas y conectores (la cápsula queda apagada)
    this.malla.setMatrixAt(base + 1, _cero);
    _z.copy(frente).negate();
    this.pecho.matrix.makeBasis(derecha, arriba, _z).setPosition(P(_w, 0.385, 0.075 * g + 0.105, 0));
    this.pecho.matrixWorldNeedsUpdate = true;
    this.pecho.visible = true;
    // rodamiento de la cintura, entre el torso y la cadera
    // anillo ovalado: X hacia la derecha del cuerpo, Z (el eje) hacia arriba
    _y.crossVectors(arriba, derecha);
    _c.makeBasis(derecha, _y, arriba).multiply(_s.makeScale(0.168 * g, 0.12 * g, 0.16)).setPosition(P(_w, 0.59, -0.05, 0));
    this.aros.setMatrixAt(ARO_CINTURA, _c);
    // la cadera la cubre el calzón del torso
    this.malla.setMatrixAt(base + 2, _cero);
    // piernas: en gravedad cero quedan flexionadas, con las rodillas adelante y los pies atrás
    for (let i = 0; i < 2; i++) {
      const lado = i ? 1 : -1;
      const cadera = P(_w, 0.68, -0.06, lado * 0.095);
      const rodilla = P(_e, 0.98, 0.12, lado * 0.11);
      this.malla.setMatrixAt(base + 3 + i, capsulaEntre(_c, cadera, rodilla, 0.078 * g));
      const tobillo = P(_w, 1.30, -0.16, lado * 0.11);
      this.malla.setMatrixAt(base + 5 + i, capsulaEntre(_c, rodilla, tobillo, 0.062 * g));
      // rodamientos: sobre la rodilla (en el muslo) y en el tobillo, donde empieza la bota
      _d.subVectors(rodilla, cadera).normalize();
      this.aros.setMatrixAt(AROS_PIERNA + i * 2, aroEn(_c, _v.copy(rodilla).addScaledVector(_d, -0.12), _d, 0.079 * g));
      _d.subVectors(tobillo, rodilla).normalize();
      this.aros.setMatrixAt(AROS_PIERNA + i * 2 + 1, aroEn(_c, _v.copy(tobillo).addScaledVector(_d, -0.035), _d, 0.058 * g));
      this.malla.setMatrixAt(base + 7 + i, capsulaEntre(_c, tobillo, P(_e, 1.34, -0.02, lado * 0.11), 0.052 * g, 0.045 * g, derecha));
    }
  }

  /** Oculta (o vuelve a mostrar) las manos y el cuerpo de primera persona mientras se dibuja otra cámara. */
  ocultarParaTercera(ocultar) {
    this.malla.visible = !ocultar;
    this.aros.visible = !ocultar;
    if (ocultar) { this._torsoAntes = this.torso.visible; this.torso.visible = false; } else this.torso.visible = this._torsoAntes ?? this.torso.visible;
    if (ocultar) { this._pechoAntes = this.pecho.visible; this._parcheAntes = this.parche.visible; this.pecho.visible = false; this.parche.visible = false; } else { this.pecho.visible = this._pechoAntes ?? this.pecho.visible; this.parche.visible = this._parcheAntes ?? this.parche.visible; }
    if (!this.guantes) return;
    for (const g of this.guantes) {
      if (!g) continue;
      if (ocultar) { g._visibleAntes = g.malla.visible; g.malla.visible = false; } else g.malla.visible = g._visibleAntes ?? g.malla.visible;
    }
  }

  vibrar(mano, fuerza, ms) {
    const actuador = mano.fuente?.gamepad?.hapticActuators?.[0];
    if (actuador && typeof actuador.pulse === 'function') actuador.pulse(fuerza, ms).catch(() => {});
  }

  vibrarTodas(fuerza, ms) {
    for (const m of this.lista) this.vibrar(m, fuerza, ms);
  }
}
