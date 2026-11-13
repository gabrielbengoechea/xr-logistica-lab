// Exterior de la Estación Artigas-1: lo que se ve y se recorre en la caminata espacial.
//
// La geometría sale de la distribución interior: cada módulo (Tacuarembó, Nodo Montevideo, Rivera, Colonia y
// el carguero Charrúa) tiene su casco, del radio que envuelve a su interior, sobre el mismo eje. Encima van la
// viga dorsal, los dos paneles solares con su junta giratoria, los radiadores, las antenas, las cámaras, las
// luces de navegación y los pasamanos amarillos por donde se avanza.
//
// Costo: toda la parte fija es UNA malla con un material propio (luz del sol y resplandor de la Tierra
// calculados en el shader, sin luces de escena); las partes que se mueven (dos alas, dos antenas) suman una
// malla cada una y comparten el material. El grupo solo se dibuja en la caminata y desde la Cúpula.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SistemaColisiones } from './colisiones.js';

const COLOR = {
  blanco: 0xd9dbd6, manta: 0xc9c2ad, gris: 0x7b838d, oscuro: 0x2b3038, amarillo: 0xf2b705, dorado: 0xb8893a,
  azul: 0x0038a8, rojo: 0xff2a1a, verde: 0x21e06a, luz: 0xffffff, radiador: 0xeeeeea, celda: 0x0a1030,
};
const TIPO = { normal: 0, luz: 1, baliza: 2, celda: 3 };

/** Cascos por módulo: [z0, z1, radio]. Los radios envuelven la geometría interior medida. */
export const CASCOS = [
  { id: 'tacuarembo', z0: 3.56, z1: 6.86, radio: 2.10 },
  { id: 'nodo', z0: 0.66, z1: 3.56, radio: 1.76, sinAbajo: true },
  { id: 'rivera', z0: -4.90, z1: 0.66, radio: 2.10 },
  { id: 'colonia', z0: -8.72, z1: -4.90, radio: 1.72 },
  { id: 'carguero', z0: -11.62, z1: -8.72, radio: 2.04 },
];
/** Escotilla de la esclusa: a estribor del Nodo. */
export const ESCLUSA = { exterior: new THREE.Vector3(1.78, 0, 2.11), salida: new THREE.Vector3(2.55, 0, 2.11), interior: new THREE.Vector3(0.85, 0, 2.11), ancla: new THREE.Vector3(1.86, -0.55, 2.11) };
const VIGA_Y = 2.32;
export const PUNTOS_EXTERIORES = {
  junta_solar: new THREE.Vector3(0.0, 2.78, -6.52),
  antena: new THREE.Vector3(0.0, 2.72, 1.72),
  conector_radiador: new THREE.Vector3(2.16, 0.55, 5.20),
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const _v = new THREE.Vector3();
const UNO = new THREE.Vector3(1, 1, 1);

class Armado {
  constructor() { this.partes = []; }

  sumar(g, color, tipo = TIPO.normal, matriz = null) {
    const geo = g.index ? g.toNonIndexed() : g;
    if (matriz) geo.applyMatrix4(matriz);
    _c.setHex(color, THREE.SRGBColorSpace);
    const n = geo.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    const tip = new Float32Array(n);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; tip[i] = tipo; }
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aTipo', new THREE.BufferAttribute(tip, 1));
    this.partes.push(geo);
    return this;
  }

  caja(w, h, d, color, pos, rot = [0, 0, 0], tipo = TIPO.normal) {
    return this.sumar(new THREE.BoxGeometry(w, h, d), color, tipo, _m.compose(new THREE.Vector3(...pos), _q.setFromEuler(_e.set(...rot)), UNO).clone());
  }

  /** Cilindro entre dos puntos. */
  tubo(a, b, radio, color, lados = 6, tipo = TIPO.normal) {
    const d = new THREE.Vector3().subVectors(b, a);
    const g = new THREE.CylinderGeometry(radio, radio, d.length(), lados, 1, true);
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return this.sumar(g, color, tipo, new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, UNO));
  }

  esfera(radio, color, pos, tipo = TIPO.normal) {
    return this.sumar(new THREE.SphereGeometry(radio, 8, 6), color, tipo, new THREE.Matrix4().makeTranslation(...pos));
  }

  terminar() {
    const g = mergeGeometries(this.partes, false);
    for (const p of this.partes) p.dispose();
    g.computeBoundingSphere();
    return g;
  }
}

/** Tramo de casco: cilindro a lo largo de Z. `sinAbajo` deja abierto el arco que ocupa la Cúpula. */
function casco(z0, z1, r0, r1, lados, sinAbajo = false) {
  // Con sinAbajo queda abierto un arco de 105° centrado en -Y (medido: de -143° a -37° en el plano XY).
  const inicio = sinAbajo ? 0.92 : 0;
  const largo = sinAbajo ? Math.PI * 2 - 1.84 : Math.PI * 2;
  const g = new THREE.CylinderGeometry(r1, r0, z1 - z0, lados, 1, true, inicio, largo);
  g.rotateX(Math.PI / 2);                                            // el cilindro de three corre por Y: se acuesta sobre Z
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}

function crearMaterial(sol, colorSol) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uSol: { value: sol.clone() }, uSolColor: { value: new THREE.Vector3(colorSol.r, colorSol.g, colorSol.b) }, uTiempo: { value: 0 } },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aTipo;
      varying vec3 vN; varying vec3 vC; varying float vT; varying vec2 vUv; varying vec3 vW;
      void main() {
        vC = aColor; vT = aTipo; vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      precision highp float;
      uniform vec3 uSol; uniform vec3 uSolColor; uniform float uTiempo;
      varying vec3 vN; varying vec3 vC; varying float vT; varying vec2 vUv; varying vec3 vW;
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 base = vC;
        float celda = step(2.5, vT) * step(vT, 3.5);
        if (celda > 0.5) {
          vec2 g = fract(vUv);
          float adentro = step(0.05, g.x) * step(0.05, g.y);
          base = mix(vec3(0.42, 0.40, 0.34), vec3(0.015, 0.03, 0.12), adentro);
        }
        float d = max(dot(n, uSol), 0.0);
        float tierra = max(-n.y, 0.0);                                  // resplandor de la Tierra, desde abajo
        vec3 luz = uSolColor * d * 1.7 + vec3(0.10, 0.17, 0.32) * tierra * 0.6 + vec3(0.03, 0.035, 0.045);
        vec3 c = base * luz;
        vec3 v = normalize(cameraPosition - vW);
        float brillo = pow(max(dot(n, normalize(v + uSol)), 0.0), 48.0) * step(0.0, dot(n, uSol));
        c += uSolColor * brillo * mix(0.18, 0.9, celda);
        if (vT > 0.5 && vT < 1.5) c = vC * 2.2;                          // luz fija
        if (vT > 1.5 && vT < 2.5) c = vC * (0.15 + 2.6 * step(0.82, fract(uTiempo * 0.55)));   // baliza
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** Pasamanos exteriores: [a, b]. El orden sigue las rutas de la caminata. */
function pasamanos() {
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  const lista = [];
  const R = 1.76 + 0.09;
  // alrededor de la esclusa
  lista.push([P(1.86, -0.55, 1.55), P(1.86, 0.55, 1.55)], [P(1.86, -0.55, 2.67), P(1.86, 0.55, 2.67)], [P(1.86, 0.62, 1.75), P(1.86, 0.62, 2.47)]);
  // del costado del Nodo a la viga dorsal (arco a estribor, en z = 2,95)
  for (const grados of [28, 50, 72]) {
    const a0 = THREE.MathUtils.degToRad(grados - 8);
    const a1 = THREE.MathUtils.degToRad(grados + 8);
    lista.push([P(Math.cos(a0) * R, Math.sin(a0) * R, 2.95), P(Math.cos(a1) * R, Math.sin(a1) * R, 2.95)]);
  }
  // viga dorsal: un pasamanos a cada lado, cada 1,3 m, de Colonia a Tacuarembó
  for (let z = -7.6; z <= 6.2; z += 1.3) {
    lista.push([P(0.26, VIGA_Y + 0.1, z - 0.42), P(0.26, VIGA_Y + 0.1, z + 0.42)]);
    lista.push([P(-0.26, VIGA_Y + 0.1, z - 0.42), P(-0.26, VIGA_Y + 0.1, z + 0.42)]);
  }
  // bajada al radiador de estribor (casco de Tacuarembó, z = 5,2)
  const RT = 2.10 + 0.09;
  for (const grados of [70, 46, 22]) {
    const a0 = THREE.MathUtils.degToRad(grados - 8);
    const a1 = THREE.MathUtils.degToRad(grados + 8);
    lista.push([P(Math.cos(a0) * RT, Math.sin(a0) * RT, 5.2), P(Math.cos(a1) * RT, Math.sin(a1) * RT, 5.2)]);
  }
  // mástil solar y base de la antena
  lista.push([P(0.24, 2.55, -6.5), P(0.24, 3.05, -6.5)], [P(-0.3, 2.62, 1.75), P(0.3, 2.62, 1.75)]);
  return lista;
}

/** Rutas de la caminata desde la esclusa: puntos por donde hay pasamanos. */
export const RUTAS_EXTERIORES = (() => {
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  const subida = [ESCLUSA.salida.clone(), P(2.2, 1.1, 2.95), P(1.2, 2.2, 2.95), P(0.45, VIGA_Y + 0.45, 2.95)];
  return {
    esclusa: [ESCLUSA.salida.clone()],
    antena: [...subida, P(0.45, VIGA_Y + 0.5, 1.9)],
    junta_solar: [...subida, P(0.45, VIGA_Y + 0.45, 0), P(0.45, VIGA_Y + 0.45, -3.5), P(0.45, VIGA_Y + 0.5, -6.3)],
    conector_radiador: [...subida, P(0.45, VIGA_Y + 0.45, 5.2), P(1.7, 1.9, 5.2), P(2.5, 0.75, 5.2)],
  };
})();

function alaSolar(signo) {
  // Marco local: la junta está en el origen, el ala corre por +Y (el grupo se espeja para la de abajo).
  const a = new Armado();
  a.tubo(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 7.4, 0), 0.07, COLOR.gris, 8);
  a.sumar(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12), COLOR.dorado, TIPO.normal, new THREE.Matrix4().makeTranslation(0, 0.05, 0));
  for (const lado of [-1, 1]) {
    // manta: 1,6 m de ancho por 6,6 m de largo, celdas de 0,2 m
    const g = new THREE.PlaneGeometry(1.6, 6.6);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 33);
    a.sumar(g, COLOR.celda, TIPO.celda, new THREE.Matrix4().makeTranslation(lado * 1.02, 4.0, 0));
    // marco y travesaños
    a.caja(0.04, 6.7, 0.04, COLOR.gris, [lado * 1.84, 4.0, 0]);
    a.caja(0.04, 6.7, 0.04, COLOR.gris, [lado * 0.2, 4.0, 0]);
    for (let y = 0.7; y <= 7.31; y += 1.1) a.caja(1.68, 0.035, 0.035, COLOR.gris, [lado * 1.02, y, -0.03]);
  }
  a.caja(3.76, 0.06, 0.06, COLOR.gris, [0, 0.66, 0]);
  a.caja(3.76, 0.06, 0.06, COLOR.gris, [0, 7.34, 0]);
  void signo;
  return a.terminar();
}

function plato(radio) {
  // Marco local: el plato mira hacia +Z; el origen es el eje de elevación.
  const a = new Armado();
  const perfil = [];
  for (let i = 0; i <= 6; i++) { const r = radio * i / 6; perfil.push(new THREE.Vector2(r, 0.32 * radio * (r / radio) * (r / radio))); }
  const g = new THREE.LatheGeometry(perfil, 16);
  g.rotateX(Math.PI / 2);                                               // eje del plato sobre +Z
  a.sumar(g, COLOR.blanco);
  for (let i = 0; i < 3; i++) {
    const ang = i * Math.PI * 2 / 3 + 0.5;
    a.tubo(new THREE.Vector3(Math.cos(ang) * radio * 0.8, Math.sin(ang) * radio * 0.8, 0.2 * radio), new THREE.Vector3(0, 0, radio * 0.78), 0.012, COLOR.gris, 5);
  }
  a.sumar(new THREE.CylinderGeometry(0.05, 0.07, 0.12, 8).rotateX(Math.PI / 2), COLOR.oscuro, TIPO.normal, new THREE.Matrix4().makeTranslation(0, 0, radio * 0.8));
  a.caja(0.16, 0.16, 0.2, COLOR.gris, [0, 0, -0.08]);
  return a.terminar();
}

/** Traje de caminata espacial, para la vista en tercera persona. El origen es la cabeza. */
function traje() {
  const a = new Armado();
  a.sumar(new THREE.SphereGeometry(0.17, 14, 10), COLOR.blanco);
  a.sumar(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0.5, 1.5).rotateX(-Math.PI / 2), COLOR.dorado, TIPO.normal, new THREE.Matrix4().makeTranslation(0, 0, -0.035));
  a.caja(0.44, 0.50, 0.28, COLOR.blanco, [0, -0.42, 0.02]);                // torso
  a.caja(0.40, 0.58, 0.20, COLOR.blanco, [0, -0.40, 0.25]);                // mochila de soporte vital
  a.caja(0.20, 0.14, 0.08, COLOR.gris, [0, -0.36, -0.15]);                 // módulo de control del pecho
  a.caja(0.10, 0.04, 0.085, COLOR.azul, [0.09, -0.24, -0.15]);
  for (const s of [-1, 1]) {
    a.tubo(new THREE.Vector3(s * 0.26, -0.24, 0), new THREE.Vector3(s * 0.36, -0.52, -0.06), 0.065, COLOR.blanco, 8);   // brazo
    a.tubo(new THREE.Vector3(s * 0.36, -0.52, -0.06), new THREE.Vector3(s * 0.34, -0.72, -0.22), 0.058, COLOR.blanco, 8);
    a.esfera(0.062, COLOR.gris, [s * 0.34, -0.75, -0.25]);                // guante
    a.tubo(new THREE.Vector3(s * 0.11, -0.66, 0.02), new THREE.Vector3(s * 0.12, -1.06, 0.0), 0.085, COLOR.blanco, 8);   // pierna
    a.tubo(new THREE.Vector3(s * 0.12, -1.06, 0.0), new THREE.Vector3(s * 0.12, -1.42, 0.06), 0.075, COLOR.blanco, 8);
    a.caja(0.13, 0.10, 0.26, COLOR.gris, [s * 0.12, -1.48, 0.0]);          // bota
    a.caja(0.08, 0.02, 0.10, COLOR.rojo, [s * 0.30, -0.30, -0.02]);        // franja del brazo
  }
  a.sumar(new THREE.TorusGeometry(0.13, 0.02, 5, 14).rotateX(Math.PI / 2), COLOR.gris, TIPO.normal, new THREE.Matrix4().makeTranslation(0, -0.15, 0));   // aro del cuello
  a.tubo(new THREE.Vector3(0.16, -0.62, 0.1), new THREE.Vector3(0.24, -0.66, 0.0), 0.012, COLOR.amarillo, 5);              // mosquetón del cable
  return a.terminar();
}

/**
 * @param {THREE.Vector3} sol       Dirección hacia el sol.
 * @param {THREE.Color} colorSol
 * @returns {{grupo: THREE.Group, colisiones: SistemaColisiones, pasamanos: {a: THREE.Vector3, b: THREE.Vector3, nombre: string}[],
 *            traje: THREE.Mesh, paneles: SolarPanelController, antenas: AntennaController, actualizar: (dt: number) => void, material: THREE.ShaderMaterial}}
 */
export function crearExterior(sol, colorSol) {
  const grupo = new THREE.Group();
  grupo.name = 'Exterior_Artigas1';
  const material = crearMaterial(sol, colorSol);
  const colisiones = new SistemaColisiones(0.5);
  const I = new THREE.Matrix4();
  const a = new Armado();
  const caja = (x0, y0, z0, x1, y1, z1) => colisiones.agregarCaja(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)), I);

  // ---- cascos, con mantas térmicas en dos tonos, aros de unión y transiciones cónicas
  CASCOS.forEach((c, i) => {
    const tramos = Math.max(2, Math.round((c.z1 - c.z0) / 1.1));
    for (let t = 0; t < tramos; t++) {
      const za = c.z0 + (c.z1 - c.z0) * t / tramos;
      const zb = c.z0 + (c.z1 - c.z0) * (t + 1) / tramos;
      a.sumar(casco(za + 0.02, zb - 0.02, c.radio, c.radio, 24, c.sinAbajo), (t + i) % 2 ? COLOR.blanco : COLOR.manta);
      a.sumar(casco(zb - 0.03, zb + 0.03, c.radio + 0.035, c.radio + 0.035, 24, c.sinAbajo), COLOR.gris);
    }
    colisiones.agregarMalla(casco(c.z0, c.z1, c.radio, c.radio, 14, c.sinAbajo), I);
    const sig = CASCOS[i + 1];
    if (sig && Math.abs(sig.radio - c.radio) > 0.01) {
      // el siguiente módulo está hacia -Z: tapa anular entre los dos radios
      const tapa = new THREE.RingGeometry(Math.min(c.radio, sig.radio), Math.max(c.radio, sig.radio), 24);
      a.sumar(tapa, COLOR.gris, TIPO.normal, new THREE.Matrix4().makeTranslation(0, 0, c.z0));
    }
  });
  // tapas de los extremos: fondo de Tacuarembó y proa del carguero
  a.sumar(new THREE.CircleGeometry(2.10, 24), COLOR.manta, TIPO.normal, new THREE.Matrix4().makeTranslation(0, 0, 6.86));
  a.sumar(new THREE.ConeGeometry(2.04, 1.1, 24, 1, true).rotateX(-Math.PI / 2), COLOR.blanco, TIPO.normal, new THREE.Matrix4().makeTranslation(0, 0, -12.17));
  caja(-1.5, -1.5, 6.86, 1.5, 1.5, 6.96);
  caja(-1.2, -1.2, -12.4, 1.2, 1.2, -11.62);
  // motores de maniobra del carguero
  for (const [x, y] of [[1.45, 1.45], [-1.45, 1.45], [1.45, -1.45], [-1.45, -1.45]]) a.caja(0.22, 0.22, 0.4, COLOR.oscuro, [x, y, -10.4]);

  // ---- esclusa: marco, puerta y luz de estado
  const E = ESCLUSA.exterior;
  a.sumar(new THREE.TorusGeometry(0.62, 0.07, 6, 20).rotateY(Math.PI / 2), COLOR.amarillo, TIPO.normal, new THREE.Matrix4().makeTranslation(E.x + 0.02, E.y, E.z));
  a.sumar(new THREE.CircleGeometry(0.58, 20).rotateY(Math.PI / 2), COLOR.gris, TIPO.normal, new THREE.Matrix4().makeTranslation(E.x + 0.015, E.y, E.z));
  a.caja(0.03, 0.10, 0.62, COLOR.oscuro, [E.x + 0.04, 0, E.z]);                       // barra de cierre
  a.caja(0.04, 0.06, 0.06, COLOR.verde, [E.x + 0.04, 0.72, E.z], [0, 0, 0], TIPO.luz);
  a.caja(0.02, 0.30, 0.50, COLOR.azul, [E.x + 0.01, -0.95, E.z]);                     // placa «ESCLUSA»

  // ---- viga dorsal con montantes y bandeja de conductos
  a.caja(0.30, 0.26, 14.6, COLOR.gris, [0, VIGA_Y - 0.1, -0.75]);
  caja(-0.15, VIGA_Y - 0.23, -8.05, 0.15, VIGA_Y + 0.03, 6.55);
  for (let z = -7.8; z <= 6.4; z += 1.3) a.caja(0.36, 0.05, 0.05, COLOR.oscuro, [0, VIGA_Y + 0.045, z]);
  for (const z of [-8.0, -6.0, 3.0]) a.tubo(new THREE.Vector3(0, 1.6, z), new THREE.Vector3(0, VIGA_Y - 0.2, z), 0.06, COLOR.gris, 6);
  for (const x of [-0.1, 0.0, 0.1]) a.tubo(new THREE.Vector3(x, VIGA_Y + 0.055, -7.9), new THREE.Vector3(x, VIGA_Y + 0.055, 6.4), 0.018, x === 0 ? COLOR.dorado : COLOR.oscuro, 5);

  // ---- mástiles de los paneles solares (la parte fija) y sus juntas
  a.tubo(new THREE.Vector3(0, VIGA_Y, -6.8), new THREE.Vector3(0, 2.86, -6.8), 0.11, COLOR.gris, 10);
  a.tubo(new THREE.Vector3(0, -1.6, -6.8), new THREE.Vector3(0, -2.86, -6.8), 0.11, COLOR.gris, 10);
  a.caja(0.26, 0.2, 0.22, COLOR.oscuro, [0, 2.62, -6.6]);                             // caja de la junta (punto de inspección)
  caja(-0.14, 2.3, -6.94, 0.14, 2.9, -6.48);

  // ---- radiadores de Tacuarembó: cuatro hojas en acordeón a cada lado
  for (const s of [-1, 1]) {
    a.tubo(new THREE.Vector3(s * 2.0, 0.55, 5.2), new THREE.Vector3(s * 2.45, 0.55, 5.2), 0.06, COLOR.gris, 8);
    a.caja(0.2, 0.16, 0.16, COLOR.dorado, [s * 2.16, 0.55, 5.2]);                     // conector de fluido (punto de inspección)
    for (let h = 0; h < 4; h++) {
      a.caja(0.86, 0.03, 2.2, COLOR.radiador, [s * (2.9 + h * 0.84), 0.55 + (h % 2 ? 0.07 : -0.07), 5.2], [0, 0, (h % 2 ? -1 : 1) * 0.16 * s]);
    }
    caja(Math.min(s * 2.45, s * 5.9), 0.42, 4.1, Math.max(s * 2.45, s * 5.9), 0.68, 6.3);
    a.tubo(new THREE.Vector3(s * 2.45, 0.55, 4.2), new THREE.Vector3(s * 5.8, 0.55, 4.2), 0.02, COLOR.gris, 5);
    a.tubo(new THREE.Vector3(s * 2.45, 0.55, 6.2), new THREE.Vector3(s * 5.8, 0.55, 6.2), 0.02, COLOR.gris, 5);
  }

  // ---- antenas fijas, cámaras y luces de navegación
  for (const [x, y, z, largo] of [[0.9, 1.5, -10.2, 1.4], [-0.9, 1.5, -10.2, 1.1], [0, VIGA_Y, -3.2, 1.6]]) {
    const dir = new THREE.Vector3(x, y, 0).normalize();
    a.tubo(new THREE.Vector3(x, y, z).multiplyScalar(1), new THREE.Vector3(x, y, z).addScaledVector(dir.lengthSq() ? dir : new THREE.Vector3(0, 1, 0), largo), 0.012, COLOR.oscuro, 5);
  }
  for (let v = 0; v < 6; v++) {                                                       // antena helicoidal de telemetría
    const y = VIGA_Y + 0.15 + v * 0.11;
    a.sumar(new THREE.TorusGeometry(0.09, 0.008, 4, 10).rotateX(Math.PI / 2), COLOR.dorado, TIPO.normal, new THREE.Matrix4().makeTranslation(0, y, -1.2));
  }
  a.tubo(new THREE.Vector3(0, VIGA_Y, -1.2), new THREE.Vector3(0, VIGA_Y + 0.85, -1.2), 0.012, COLOR.gris, 5);
  for (const [x, y, z, rz] of [[1.5, 1.62, -2.0, -0.75], [-1.5, 1.62, 4.6, 0.75]]) {  // cámaras exteriores
    a.caja(0.16, 0.12, 0.26, COLOR.blanco, [x, y, z], [0, 0, rz]);
    a.sumar(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 8).rotateX(Math.PI / 2), COLOR.oscuro, TIPO.normal, new THREE.Matrix4().makeTranslation(x, y, z - 0.16));
  }
  a.esfera(0.05, COLOR.rojo, [-2.14, 0, -2.1], TIPO.luz);                             // babor: roja
  a.esfera(0.05, COLOR.verde, [2.14, 0, -2.1], TIPO.luz);                             // estribor: verde
  a.esfera(0.055, COLOR.luz, [0, VIGA_Y + 0.1, 6.5], TIPO.baliza);
  a.esfera(0.055, COLOR.luz, [0, -2.08, -10.2], TIPO.baliza);
  a.esfera(0.045, COLOR.luz, [0, VIGA_Y + 0.1, -8.0], TIPO.baliza);

  // ---- pasamanos (visual y capa de agarre)
  const barandas = [];
  for (const [p0, p1] of pasamanos()) {
    a.tubo(p0, p1, 0.017, COLOR.amarillo, 6);
    // dos apoyos hacia el eje de la estación (o hacia la viga)
    for (const p of [p0, p1]) {
      const haciaAdentro = Math.abs(p.x) < 0.4 && p.y > VIGA_Y ? _v.set(0, -1, 0) : _v.set(-p.x, -p.y, 0).normalize();
      a.tubo(p, p.clone().addScaledVector(haciaAdentro, 0.09), 0.012, COLOR.oscuro, 5);
    }
    barandas.push({ a: p0, b: p1, nombre: 'Pasamanos_Exterior' });
  }
  a.caja(0.12, 0.12, 0.12, COLOR.amarillo, [ESCLUSA.ancla.x, ESCLUSA.ancla.y, ESCLUSA.ancla.z]);   // anclaje del cable

  const fijo = new THREE.Mesh(a.terminar(), material);
  fijo.name = 'Exterior_Fijo';
  fijo.matrixAutoUpdate = false;
  grupo.add(fijo);

  // ---- partes móviles
  const geoAla = alaSolar(1);
  const alas = [];
  for (const s of [1, -1]) {
    const ala = new THREE.Mesh(geoAla, material);
    ala.name = s > 0 ? 'Ala_Solar_Cenit' : 'Ala_Solar_Nadir';
    ala.position.set(0, s * 2.86, -6.8);
    ala.scale.y = s;
    grupo.add(ala);
    alas.push(ala);
  }
  const paneles = new SolarPanelController(alas, sol);
  // colisión de las alas en su orientación de trabajo (después solo oscilan unos grados)
  for (const s of [1, -1]) {
    const mAla = new THREE.Matrix4().compose(new THREE.Vector3(0, s * 2.86, -6.8), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), paneles.objetivo), new THREE.Vector3(1, s, 1));
    colisiones.agregarCaja(new THREE.Box3(new THREE.Vector3(-1.9, 0.6, -0.05), new THREE.Vector3(1.9, 7.4, 0.05)), mAla);
  }

  const base = new THREE.Group();                 // acimut de la antena principal, sobre el Nodo
  base.position.set(0, VIGA_Y + 0.03, 2.11);
  const mastil = new THREE.Mesh(new Armado().tubo(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.95, 0), 0.07, COLOR.gris, 8).caja(0.3, 0.14, 0.3, COLOR.oscuro, [0, 0.07, 0]).caja(0.34, 0.16, 0.12, COLOR.gris, [0, 0.95, 0]).terminar(), material);
  const platoPrincipal = new THREE.Mesh(plato(0.85), material);
  platoPrincipal.position.set(0, 0.95, 0.12);
  base.add(mastil, platoPrincipal);
  grupo.add(base);
  const base2 = new THREE.Group();                // antena secundaria, en el fondo de Tacuarembó
  base2.position.set(0.9, 1.2, 6.9);
  const plato2 = new THREE.Mesh(plato(0.42), material);
  plato2.position.set(0, 0.35, 0.08);
  base2.add(new THREE.Mesh(new Armado().tubo(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.35, 0), 0.04, COLOR.gris, 6).terminar(), material), plato2);
  grupo.add(base2);
  const antenas = new AntennaController([{ base, plato: platoPrincipal, periodo: 46 }, { base: base2, plato: plato2, periodo: 71 }]);
  caja(-0.6, VIGA_Y, 1.6, 0.6, VIGA_Y + 1.9, 2.9);

  // ---- placa de identificación (canvas): nombre y bandera, a estribor de Rivera
  const lienzo = document.createElement('canvas');
  lienzo.width = 1024;
  lienzo.height = 256;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#e9ebe6';
  ctx.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#0038a8' : '#ffffff'; ctx.fillRect(24, 28 + i * 22.2, 300, 22.2); }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(24, 28, 112, 111);
  ctx.fillStyle = '#fcd116';
  ctx.beginPath();
  ctx.arc(80, 83, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b1420';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText('ARTIGAS-1', 360, 118);
  ctx.font = '40px sans-serif';
  ctx.fillText('ESTACIÓN LOGÍSTICA · URUGUAY', 362, 190);
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tex, color: 0x9a9a9a }));
  placa.position.set(2.16, 0.55, -2.1);
  placa.rotation.y = Math.PI / 2;
  placa.name = 'Placa_Exterior';
  grupo.add(placa);

  colisiones.construir();
  const mallaTraje = new THREE.Mesh(traje(), material);
  mallaTraje.name = 'Traje_EVA';
  return {
    grupo, colisiones, pasamanos: barandas, traje: mallaTraje, paneles, antenas, material,
    actualizar(dt) {
      material.uniforms.uTiempo.value += dt;
      paneles.actualizar(dt);
      antenas.actualizar(dt);
    },
  };
}

/** Orienta las alas solares: giran sobre su mástil hasta que las celdas miran al sol y lo siguen despacio. */
export class SolarPanelController {
  /** @param {THREE.Object3D[]} alas @param {THREE.Vector3} sol */
  constructor(alas, sol) {
    this.alas = alas;
    this.objetivo = Math.atan2(sol.x, sol.z);     // ángulo sobre Y con el que la normal (+Z local) apunta al sol
    this.angulo = this.objetivo - 0.9;            // arrancan desalineadas: se ve la maniobra
    this.velocidad = THREE.MathUtils.degToRad(2.2);
    this._tiempo = 0;
    this._aplicar();
  }

  /** Error de apuntamiento en grados (0 = de frente al sol). */
  get error() {
    return Math.abs(THREE.MathUtils.radToDeg(this.objetivo - this.angulo));
  }

  /** Pide una nueva orientación (radianes sobre el mástil). */
  orientar(angulo) {
    this.objetivo = angulo;
  }

  actualizar(dt) {
    this._tiempo += dt;
    // seguimiento: el objetivo se corre apenas con la órbita
    const meta = this.objetivo + Math.sin(this._tiempo * 0.05) * 0.035;
    const d = meta - this.angulo;
    this.angulo += THREE.MathUtils.clamp(d, -this.velocidad * dt, this.velocidad * dt);
    this._aplicar();
  }

  _aplicar() {
    for (const ala of this.alas) ala.rotation.y = this.angulo;
  }
}

/** Antenas orientables: cada tanto cambian de objetivo (estación terrena o satélite de enlace) y giran despacio. */
export class AntennaController {
  /** @param {{base: THREE.Object3D, plato: THREE.Object3D, periodo: number}[]} antenas */
  constructor(antenas) {
    this.antenas = antenas.map((a, i) => ({ ...a, acimut: 0.4 + i, elevacion: 0.5, metaAcimut: 0.4 + i, metaElevacion: 0.5, reloj: i * 9, paso: 0 }));
    this.velocidad = THREE.MathUtils.degToRad(5);
    for (const a of this.antenas) this._aplicar(a);
  }

  actualizar(dt) {
    for (const a of this.antenas) {
      a.reloj += dt;
      if (a.reloj > a.periodo) {
        a.reloj = 0;
        a.paso++;
        // alterna entre objetivos: secuencia fija, sin azar
        a.metaAcimut = [0.4, 2.3, -1.1, 3.6][a.paso % 4];
        a.metaElevacion = [0.5, 1.05, 0.2, 0.75][a.paso % 4];
      }
      a.acimut += THREE.MathUtils.clamp(a.metaAcimut - a.acimut, -this.velocidad * dt, this.velocidad * dt);
      a.elevacion += THREE.MathUtils.clamp(a.metaElevacion - a.elevacion, -this.velocidad * dt, this.velocidad * dt);
      this._aplicar(a);
    }
  }

  /** true mientras alguna antena está girando hacia su objetivo. */
  get enMovimiento() {
    return this.antenas.some((a) => Math.abs(a.metaAcimut - a.acimut) > 1e-3 || Math.abs(a.metaElevacion - a.elevacion) > 1e-3);
  }

  _aplicar(a) {
    a.base.rotation.y = a.acimut;
    a.plato.rotation.x = -a.elevacion;
  }
}
