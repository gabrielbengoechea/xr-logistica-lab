// Exterior de la Estación Artigas-1: lo que se ve y se recorre en la caminata espacial.
//
// La geometría sale de la distribución interior: cada módulo (Tacuarembó, Nodo Montevideo, Rivera, Colonia y
// el carguero Charrúa) tiene su casco, del radio que envuelve a su interior, sobre el mismo eje. Encima van la
// viga dorsal, los dos paneles solares con su junta giratoria, los radiadores, las antenas, las cámaras, los
// sensores, las luces de navegación y de estado, los pasamanos amarillos por donde se avanza y la señalética.
//
// Detalle: cada casco está hecho de paneles de manta térmica (MLI) con costuras y acolchado, separados por aros
// abulonados; encima hay paneles de protección contra micrometeoritos, placas de mantenimiento, conductos con
// abrazaderas, puntos de anclaje numerados y dos accesorios de captura para el brazo robótico. Las alas solares
// tienen mástil reticulado, cajas de guardado, bisagras y celdas con barras colectoras; los radiadores, nervios,
// marcos, bisagras y líneas de fluido; las antenas, horquilla, bocina de alimentación y subreflector.
//
// Materiales: un solo shader con un tipo por vértice (manta, metal, radiador, vidrio, celda, señal, luz). Las
// texturas son procedurales y se calculan sobre coordenadas de superficie fijas a la pieza (no a la cámara ni al
// mundo), con bordes suavizados según el tamaño del píxel y fundidas a su color promedio cuando quedan más chicas
// que un píxel: no titilan al mover la cabeza y se ven igual en los dos ojos. La señalética es un atlas dibujado
// una vez en un canvas y muestreado por el mismo shader.
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
  aluminio: 0xb4bac2, acero: 0x8c939b, compuesto: 0x3c4148, vidrio: 0x0c1218, ambar: 0xffa424, beta: 0xe6e2d6,
};
/** Tipo de superficie por vértice: decide el material en el shader. */
const TIPO = { normal: 0, luz: 1, baliza: 2, celda: 3, manta: 4, metal: 5, radiador: 6, vidrio: 7, senal: 8 };

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
/** Ángulo (en el plano XY) del arco abierto del Nodo, donde sale la Cúpula: de -143° a -37°. */
const NODO_DESDE = -0.6508;
const NODO_LARGO = Math.PI * 2 - 1.84;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const _v = new THREE.Vector3();
const UNO = new THREE.Vector3(1, 1, 1);

class Armado {
  constructor() { this.partes = []; }

  /**
   * Suma una pieza. `sup(x, y, z, u, v)` da las coordenadas de superficie (en metros, o en el atlas para las
   * señales) a partir de la posición local de cada vértice, antes de aplicar `matriz`.
   */
  sumar(g, color, tipo = TIPO.normal, matriz = null, sup = null) {
    const geo = g.index ? g.toNonIndexed() : g;
    if (g.index) g.dispose();
    const n = geo.getAttribute('position').count;
    if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!geo.getAttribute('aSup')) {
      const s = new Float32Array(n * 2);
      if (sup) {
        const p = geo.getAttribute('position'), uv = geo.getAttribute('uv');
        for (let i = 0; i < n; i++) { const r = sup(p.getX(i), p.getY(i), p.getZ(i), uv.getX(i), uv.getY(i)); s[i * 2] = r[0]; s[i * 2 + 1] = r[1]; }
      }
      geo.setAttribute('aSup', new THREE.BufferAttribute(s, 2));
    }
    if (matriz) geo.applyMatrix4(matriz);
    _c.setHex(color, THREE.SRGBColorSpace);
    const col = new Float32Array(n * 3);
    const tip = new Float32Array(n);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; tip[i] = tipo; }
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aTipo', new THREE.BufferAttribute(tip, 1));
    this.partes.push(geo);
    return this;
  }

  caja(w, h, d, color, pos, rot = [0, 0, 0], tipo = TIPO.normal, sup = null) {
    return this.sumar(new THREE.BoxGeometry(w, h, d), color, tipo, _m.compose(new THREE.Vector3(...pos), _q.setFromEuler(_e.set(...rot)), UNO).clone(), sup);
  }

  /** Caja en un marco dado (matriz de la pieza × posición local). */
  cajaEn(marco, w, h, d, color, pos, tipo = TIPO.normal, sup = null) {
    return this.sumar(new THREE.BoxGeometry(w, h, d), color, tipo, marco.clone().multiply(new THREE.Matrix4().makeTranslation(...pos)), sup);
  }

  /** Cilindro entre dos puntos. */
  tubo(a, b, radio, color, lados = 6, tipo = TIPO.normal) {
    const d = new THREE.Vector3().subVectors(b, a);
    const g = new THREE.CylinderGeometry(radio, radio, d.length(), lados, 1, true);
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return this.sumar(g, color, tipo, new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, UNO));
  }

  /** Cilindro cerrado (con tapas) de eje `eje` centrado en `centro`. */
  disco(radio, alto, color, centro, eje, lados = 10, tipo = TIPO.normal) {
    const g = new THREE.CylinderGeometry(radio, radio, alto, lados);
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), eje.clone().normalize());
    return this.sumar(g, color, tipo, new THREE.Matrix4().compose(centro, _q, UNO));
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

/** Tramo de casco: cilindro a lo largo de Z (para las colisiones). `sinAbajo` deja abierto el arco de la Cúpula. */
function casco(z0, z1, r0, r1, lados, sinAbajo = false) {
  const inicio = sinAbajo ? 0.92 : 0;
  const largo = sinAbajo ? Math.PI * 2 - 1.84 : Math.PI * 2;
  const g = new THREE.CylinderGeometry(r1, r0, z1 - z0, lados, 1, true, inicio, largo);
  g.rotateX(Math.PI / 2);                                            // el cilindro de three corre por Y: se acuesta sobre Z
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}

/**
 * Trozo de cilindro de eje Z, radio `r`, de z0 a z1 y del ángulo f0 a f1 (en el plano XY, desde +X hacia +Y),
 * con las caras hacia afuera. `sup(f, z, u, v)` da la coordenada de superficie de cada vértice.
 */
function superficie(r, z0, z1, f0, f1, nf, sup, nz = 1) {
  const n = nf * nz * 6;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), s = new Float32Array(n * 2);
  let k = 0;
  const vert = (i, j) => {
    const u = i / nf, v = j / nz, f = f0 + (f1 - f0) * u, z = z0 + (z1 - z0) * v;
    const c = Math.cos(f), si = Math.sin(f);
    pos.set([r * c, r * si, z], k * 3); nor.set([c, si, 0], k * 3); uv.set([u, v], k * 2); s.set(sup(f, z, u, v), k * 2);
    k++;
  };
  for (let i = 0; i < nf; i++) {
    for (let j = 0; j < nz; j++) { vert(i, j); vert(i + 1, j); vert(i, j + 1); vert(i + 1, j); vert(i + 1, j + 1); vert(i, j + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aSup', new THREE.BufferAttribute(s, 2));
  return g;
}

/** Marco sobre el casco: X tangente (hacia +ángulo), Y hacia afuera, Z a lo largo del eje. */
function enCasco(f, r, z) {
  const c = Math.cos(f), s = Math.sin(f);
  return new THREE.Matrix4().makeBasis(new THREE.Vector3(-s, c, 0), new THREE.Vector3(c, s, 0), new THREE.Vector3(0, 0, 1)).setPosition(r * c, r * s, z);
}

/** Marco de una pieza plana: X a la derecha, Y arriba, Z hacia afuera (la normal). */
function marcoPlano(centro, normal, arriba) {
  const z = normal.clone().normalize();
  const x = new THREE.Vector3().crossVectors(arriba, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(centro);
}

// ------------------------------------------------------------------------------------------- atlas de señales

const ATLAS_ANCHO = 2048;
const ATLAS_ALTO = 1024;

/** Dibuja la señalética una sola vez y devuelve la textura y el rectángulo (u0, v0, u1, v1) de cada señal. */
function crearAtlas() {
  const lienzo = document.createElement('canvas');
  lienzo.width = ATLAS_ANCHO;
  lienzo.height = ATLAS_ALTO;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#80858c';
  ctx.fillRect(0, 0, ATLAS_ANCHO, ATLAS_ALTO);
  const rect = {};
  let x = 0, y = 0, fila = 0;
  const lugar = (nombre, w, h, dibujar) => {
    if (x + w > ATLAS_ANCHO) { x = 0; y += fila; fila = 0; }
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    dibujar(w, h);
    ctx.restore();
    // medio píxel adentro para que el filtrado no tome el vecino
    rect[nombre] = [(x + 1.5) / ATLAS_ANCHO, 1 - (y + h - 1.5) / ATLAS_ALTO, (x + w - 1.5) / ATLAS_ANCHO, 1 - (y + 1.5) / ATLAS_ALTO];
    x += w;
    fila = Math.max(fila, h);
  };
  const texto = (t, px, cx, cy, color = '#101820', peso = 'bold', alinear = 'center') => {
    ctx.fillStyle = color;
    ctx.font = `${peso} ${px}px sans-serif`;
    ctx.textAlign = alinear;
    ctx.textBaseline = 'middle';
    ctx.fillText(t, cx, cy);
  };
  const franjas = (w, h, ancho = 36) => {
    ctx.fillStyle = '#f2b705';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#15181c';
    for (let i = -h; i < w + h; i += ancho * 2) {
      ctx.beginPath();
      ctx.moveTo(i, h); ctx.lineTo(i + ancho, h); ctx.lineTo(i + ancho + h, 0); ctx.lineTo(i + h, 0);
      ctx.fill();
    }
  };
  const bandera = (x0, y0, w, h) => {
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? '#0038a8' : '#ffffff'; ctx.fillRect(x0, y0 + i * h / 9, w, h / 9 + 0.5); }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x0, y0, w * 0.37, h * 5 / 9);
    const cx = x0 + w * 0.185, cy = y0 + h * 2.5 / 9, r = h * 0.12;
    ctx.fillStyle = '#fcd116';
    ctx.strokeStyle = '#7b5d00';
    ctx.lineWidth = Math.max(1, h * 0.006);
    for (let k = 0; k < 16; k++) {                                   // rayos del Sol de Mayo
      const a = k * Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.12) * r, cy + Math.sin(a - 0.12) * r);
      ctx.lineTo(cx + Math.cos(a) * r * 1.85, cy + Math.sin(a) * r * 1.85);
      ctx.lineTo(cx + Math.cos(a + 0.12) * r, cy + Math.sin(a + 0.12) * r);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  // nombre de la estación, con la bandera
  lugar('nombre', 1024, 256, (w, h) => {
    ctx.fillStyle = '#e4e6e1';
    ctx.fillRect(0, 0, w, h);
    bandera(26, 30, 300, 196);
    texto('ARTIGAS-1', 92, 670, 100);
    texto('ESTACIÓN LOGÍSTICA · URUGUAY', 38, 670, 180, '#26303c', '600');
    ctx.fillStyle = '#0038a8';
    ctx.fillRect(360, 226, 620, 8);
  });
  // módulos: nombre y código
  const modulos = [['tacuarembo', 'TACUAREMBÓ', 'TCB-01'], ['nodo', 'NODO MONTEVIDEO', 'NMV-00'], ['rivera', 'RIVERA', 'RIV-02'], ['colonia', 'COLONIA', 'COL-03'], ['carguero', 'CARGUERO CHARRÚA', 'CRG-04']];
  for (const [id, nombre, codigo] of modulos) {
    lugar(`modulo_${id}`, 512, 128, (w, h) => {
      ctx.fillStyle = '#d8dad5';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1d2733';
      ctx.fillRect(0, 0, 150, h);
      texto(codigo, 40, 75, h / 2, '#f2f4f0');
      texto(nombre, nombre.length > 12 ? 34 : 46, 331, h / 2 - 2, '#121a24');
      ctx.fillStyle = '#0038a8';
      ctx.fillRect(150, h - 12, w - 150, 6);
    });
  }
  lugar('esclusa', 512, 160, (w, h) => {
    franjas(w, h, 28);
    ctx.fillStyle = '#e8e9e4';
    ctx.fillRect(16, 16, w - 32, h - 32);
    texto('ESCLUSA EV-1', 58, w / 2, 62);
    texto('ENTRADA DE TRIPULACIÓN · ANCLAR ANTES DE SALIR', 17, w / 2, 118, '#2b3440', '600');
  });
  lugar('no_pisar', 512, 128, (w, h) => {
    franjas(w, h, 24);
    ctx.fillStyle = '#f4f1e6';
    ctx.fillRect(14, 14, w - 28, h - 28);
    texto('NO PISAR · NO TOCAR', 44, w / 2, h / 2);
  });
  lugar('rf', 512, 128, (w, h) => {
    ctx.fillStyle = '#f2b705';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#15181c';
    ctx.lineWidth = 7;
    for (const r of [18, 32, 46]) { ctx.beginPath(); ctx.arc(70, h / 2, r, -0.9, 0.9); ctx.stroke(); }
    ctx.fillStyle = '#15181c';
    ctx.beginPath(); ctx.arc(66, h / 2, 9, 0, Math.PI * 2); ctx.fill();
    texto('PELIGRO · RADIOFRECUENCIA', 30, 300, 48);
    texto('MANTENER 2 m DE DISTANCIA', 24, 300, 90, '#15181c', '600');
  });
  lugar('caliente', 512, 128, (w, h) => {
    ctx.fillStyle = '#e4e6e1';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d13b1f';
    ctx.fillRect(0, 0, w, 34);
    texto('ADVERTENCIA', 26, w / 2, 18, '#ffffff');
    texto('RADIADOR · CIRCUITO DE AMONÍACO', 27, w / 2, 66);
    texto('NO DESCONECTAR SIN PROCEDIMIENTO', 20, w / 2, 102, '#2b3440', '600');
  });
  for (let i = 1; i <= 6; i++) {
    lugar(`anclaje_${i}`, 128, 128, (w, h) => {
      ctx.fillStyle = '#f2b705';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#15181c';
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(w / 2, 50, 30, 0, Math.PI * 2); ctx.stroke();
      texto(`A${i}`, 34, w / 2, 104);
    });
  }
  lugar('captura', 256, 256, (w, h) => {
    ctx.fillStyle = '#f0f1ec';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(w / 2, h / 2 - 12, 74, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.fillRect(w / 2 - 5, h / 2 - 92, 10, 72);
    ctx.fillRect(w / 2 - 84, h / 2 - 17, 64, 10);
    ctx.fillRect(w / 2 + 20, h / 2 - 17, 64, 10);
    texto('GF-2', 34, w / 2, h - 26);
  });
  lugar('bandera', 256, 172, (w, h) => bandera(0, 0, w, h));
  lugar('franja', 256, 64, (w, h) => franjas(w, h, 20));
  lugar('panel', 256, 64, (w, h) => {
    ctx.fillStyle = '#dfe1dc';
    ctx.fillRect(0, 0, w, h);
    texto('SAW-1 · ALA SOLAR', 26, w / 2, h / 2);
  });

  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return { tex, rect };
}

/** Coordenadas de atlas para una superficie: (u, v) de 0 a 1 dentro del rectángulo de la señal. */
const enRect = (r, u, v) => [r[0] + (r[2] - r[0]) * u, r[1] + (r[3] - r[1]) * v];

// ----------------------------------------------------------------------------------------------- material

function crearMaterial(sol, colorSol, atlas) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uSol: { value: sol.clone() }, uSolColor: { value: new THREE.Vector3(colorSol.r, colorSol.g, colorSol.b) }, uTiempo: { value: 0 }, uAtlas: { value: atlas } },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aTipo;
      attribute vec2 aSup;
      varying vec3 vN; varying vec3 vC; varying float vT; varying vec2 vUv; varying vec3 vW; varying vec2 vS; varying vec3 vP;
      void main() {
        vC = aColor; vT = aTipo; vUv = uv; vS = aSup; vP = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      precision highp float;
      uniform vec3 uSol; uniform vec3 uSolColor; uniform float uTiempo; uniform sampler2D uAtlas;
      varying vec3 vN; varying vec3 vC; varying float vT; varying vec2 vUv; varying vec3 vW; varying vec2 vS; varying vec3 vP;

      float azar(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float azar3(vec3 p) { return azar(p.xy + vec2(p.z * 17.13, p.z * 3.71)); }
      // ruido de valor suave en 3D (desgaste de baja frecuencia: manchas grandes, nunca de un píxel)
      float ruido(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = mix(azar3(i), azar3(i + vec3(1, 0, 0)), f.x), b = mix(azar3(i + vec3(0, 1, 0)), azar3(i + vec3(1, 1, 0)), f.x);
        float c = mix(azar3(i + vec3(0, 0, 1)), azar3(i + vec3(1, 0, 1)), f.x), d = mix(azar3(i + vec3(0, 1, 1)), azar3(i + vec3(1, 1, 1)), f.x);
        return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
      }
      // Líneas de una grilla de período p y ancho a (metros), con borde suavizado en un píxel. Cuando la línea queda
      // más fina que el píxel se reemplaza por su cobertura promedio: sin moiré ni titileo a la distancia.
      float lineas(vec2 s, vec2 p, float a) {
        vec2 q = abs(fract(s / p + 0.5) - 0.5) * p;
        vec2 w = max(fwidth(s), vec2(1e-5));
        vec2 l = 1.0 - smoothstep(vec2(a * 0.5) - w, vec2(a * 0.5) + w, q);
        vec2 f = smoothstep(vec2(a * 0.75), vec2(a * 2.5), w);
        l = mix(l, vec2(a) / p, f);
        return max(l.x, l.y);
      }

      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 base = vC;
        float esp = 0.04, expo = 12.0;                                   // especular: intensidad y exponente
        float celda = step(2.5, vT) * step(vT, 3.5);
        if (celda > 0.5) {
          // Celdas con antialias: el borde de cada una se suaviza en un píxel (fwidth) y, cuando quedan más chicas
          // que unos pocos píxeles, la grilla se funde en su color promedio.
          vec2 g = fract(vUv);
          vec2 w = max(fwidth(vUv), vec2(1e-4));
          vec2 dentro = smoothstep(vec2(0.05) - w, vec2(0.05) + w, g);
          float adentro = dentro.x * dentro.y;
          float detalle = clamp(1.6 - 9.0 * max(w.x, w.y), 0.0, 1.0);
          adentro = mix(0.9, adentro, detalle);
          // dos barras colectoras plateadas por celda y una leve diferencia de tono entre celdas
          float qb = abs(fract(g.x * 3.0 + 0.5) - 0.5) / 3.0;
          float barra = (1.0 - smoothstep(0.012 - w.x, 0.012 + w.x, qb)) * step(0.08, g.x) * step(g.x, 0.92) * detalle;
          vec3 azul = vec3(0.015, 0.03, 0.12) * (0.88 + 0.24 * azar(floor(vUv)));
          base = mix(vec3(0.42, 0.40, 0.34), azul, adentro);
          base = mix(base, vec3(0.36, 0.37, 0.40), barra * adentro * 0.8);
          esp = 0.16;
        } else if (vT > 3.5 && vT < 4.5) {
          // Manta térmica (MLI): paneles de 0,55 m con costura, acolchado cada 11 cm y un tono propio por panel
          vec2 panel = floor(vS / 0.55);
          float h = azar(panel);
          base *= 0.93 + 0.11 * h;
          float costura = lineas(vS, vec2(0.55), 0.014);
          vec2 q = (fract(vS / 0.11) - 0.5) * 0.11;
          float wq = max(fwidth(vS.x), fwidth(vS.y));
          float punto = (1.0 - smoothstep(0.0045 - wq, 0.0045 + wq, length(q))) * (1.0 - smoothstep(0.002, 0.006, wq));
          base *= 1.0 - 0.32 * costura - 0.16 * punto;
          base *= 0.95 + 0.07 * ruido(vP * 2.3);
          esp = 0.05 + 0.03 * h; expo = 9.0;
        } else if (vT > 4.5 && vT < 5.5) {
          // Metal (aluminio, acero): un poco más de brillo y un desgaste suave
          base *= 0.92 + 0.12 * ruido(vP * 4.0);
          esp = 0.20; expo = 18.0;
        } else if (vT > 5.5 && vT < 6.5) {
          // Radiador: nervios de los tubos de fluido cada 6 cm y bordes de panel más oscuros
          float nervio = lineas(vec2(vS.x, 1e3), vec2(0.06, 1e4), 0.012);
          base *= 1.0 - 0.16 * nervio;
          base *= 0.95 + 0.06 * ruido(vP * 1.7);
          esp = 0.10; expo = 14.0;
        } else if (vT > 6.5 && vT < 7.5) {
          esp = 0.45; expo = 36.0;                                          // vidrio de cámaras y sensores
        } else if (vT > 7.5 && vT < 8.5) {
          base = texture2D(uAtlas, vS).rgb;                               // señales: atlas
          esp = 0.03;
        }
        // Luz estable para la caminata: solo depende de la posición de la superficie y del sol, salvo un brillo
        // especular chico. Nada cambia de golpe al mover la cabeza ni entre un ojo y el otro.
        float ns = dot(n, uSol);
        float d = smoothstep(-0.05, 0.25, ns) * max(ns, 0.0) + smoothstep(-0.05, 0.25, ns) * 0.04;   // terminador suave
        float tierra = max(-n.y, 0.0) * 0.5 + 0.25;                    // resplandor de la Tierra, de abajo y de los costados
        vec3 luz = uSolColor * d * 1.35 + vec3(0.10, 0.16, 0.28) * tierra * 0.55 + vec3(0.045, 0.05, 0.06);
        vec3 c = base * luz;
        // Especular ancho y débil: con exponentes altos el brillo era una mancha chica que se deslizaba por las caras
        // al mover la cabeza, distinta en cada ojo. El vidrio refleja además un poco del azul de la Tierra.
        vec3 v = normalize(cameraPosition - vW);
        float brillo = pow(max(dot(n, normalize(v + uSol)), 0.0), expo) * smoothstep(0.0, 0.2, ns);
        c += uSolColor * brillo * esp;
        if (vT > 6.5 && vT < 7.5) c += vec3(0.05, 0.08, 0.14) * pow(1.0 - max(dot(n, v), 0.0), 3.0);
        if (vT > 0.5 && vT < 1.5) c = vC * 1.6;                          // luz fija
        // baliza: pulso suave cada 3,6 s en lugar de un destello on/off (los destellos en la periferia marean)
        if (vT > 1.5 && vT < 2.5) c = vC * (0.25 + 1.1 * pow(0.5 + 0.5 * sin(uTiempo * 1.75), 4.0));
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

// ------------------------------------------------------------------------------------------------ piezas

/** Cantidad de tramos (entre aros) de un casco. */
const tramosDe = (c) => Math.max(2, Math.round((c.z1 - c.z0) / 1.1));
/** Z del centro del tramo k (contando desde z0) del módulo `id`: ahí una señal no pisa ningún aro. */
function mitadTramo(id, k) {
  const c = CASCOS.find((x) => x.id === id);
  return c.z0 + (c.z1 - c.z0) * (k + 0.5) / tramosDe(c);
}

/** Señal sobre el casco, curvada como él. Se lee derecha desde afuera, con el «arriba» hacia +Y. */
function senalCurva(a, rect, r, zc, fc, ancho, alto) {
  const df = alto / r;
  const f0 = fc - df / 2, f1 = fc + df / 2, z0 = zc - ancho / 2, z1 = zc + ancho / 2;
  const estribor = Math.cos(fc) > 0;
  const g = superficie(r, z0, z1, f0, f1, Math.max(2, Math.ceil(df / 0.08)), (f, z, u, v) => enRect(rect, estribor ? 1 - v : v, estribor ? u : 1 - u), Math.max(1, Math.ceil(ancho / 0.6)));
  a.sumar(g, 0xffffff, TIPO.senal);
}

/** Señal plana: rectángulo de ancho × alto en el marco dado (Z hacia afuera). */
function senalPlana(a, rect, marco, ancho, alto) {
  a.sumar(new THREE.PlaneGeometry(ancho, alto), 0xffffff, TIPO.senal, marco, (x, y, z, u, v) => enRect(rect, u, v));
}

/** Aro abulonado entre dos tramos de casco. */
function aro(a, r, z, sinAbajo) {
  const f0 = sinAbajo ? NODO_DESDE : 0, largo = sinAbajo ? NODO_LARGO : Math.PI * 2;
  a.sumar(superficie(r + 0.035, z - 0.035, z + 0.035, f0, f0 + largo, 40, (f, zz) => [f * r, zz]), COLOR.acero, TIPO.metal);
  const n = Math.round(largo * r / 0.32);
  for (let k = 0; k < n; k++) {
    const f = f0 + largo * (k + 0.5) / n;
    a.cajaEn(enCasco(f, r + 0.045, z), 0.028, 0.022, 0.028, COLOR.gris, [0, 0, 0], TIPO.metal);
  }
}

/** Panel de protección contra micrometeoritos, separado del casco, con su marco y cuatro bulones. */
function panelEscudo(a, r, z0, z1, f0, f1) {
  const R = r + 0.07;
  a.sumar(superficie(R, z0, z1, f0, f1, Math.max(3, Math.ceil((f1 - f0) * R / 0.15)), (f, z) => [f * R, z]), COLOR.aluminio, TIPO.metal);
  for (const f of [f0, f1]) a.tubo(new THREE.Vector3(Math.cos(f) * R, Math.sin(f) * R, z0), new THREE.Vector3(Math.cos(f) * R, Math.sin(f) * R, z1), 0.014, COLOR.acero, 5, TIPO.metal);
  for (const z of [z0, z1]) {
    const g = new THREE.TorusGeometry(R, 0.014, 4, Math.max(4, Math.ceil((f1 - f0) * 12)), f1 - f0);
    g.rotateZ(f0);
    a.sumar(g, COLOR.acero, TIPO.metal, new THREE.Matrix4().makeTranslation(0, 0, z));
  }
  const df = 0.06 / R;
  for (const f of [f0 + df, f1 - df]) for (const z of [z0 + 0.06, z1 - 0.06]) a.cajaEn(enCasco(f, R + 0.006, z), 0.026, 0.014, 0.026, COLOR.gris, [0, 0, 0], TIPO.metal);
  // separadores al casco, en el centro de cada lado
  for (const f of [f0 + 3 * df, f1 - 3 * df]) a.cajaEn(enCasco(f, r + 0.035, (z0 + z1) / 2), 0.03, 0.07, 0.03, COLOR.oscuro, [0, 0, 0]);
}

/** Placa de mantenimiento atornillada: cuadrada, con bulones en las esquinas y una manija. */
function placaMantenimiento(a, r, z, f, lado = 0.34) {
  const m = enCasco(f, r, z);
  a.cajaEn(m, lado, 0.022, lado, COLOR.acero, [0, 0.011, 0], TIPO.metal);
  for (const x of [-1, 1]) for (const zz of [-1, 1]) a.cajaEn(m, 0.022, 0.012, 0.022, COLOR.oscuro, [x * (lado / 2 - 0.03), 0.026, zz * (lado / 2 - 0.03)]);
  a.cajaEn(m, 0.12, 0.018, 0.02, COLOR.oscuro, [0, 0.036, 0]);
}

/** Conducto que corre por el casco a lo largo de Z, con abrazaderas y cajas de conexión en los extremos. */
function conducto(a, r, z0, z1, f, radio, color) {
  const R = r + 0.04;
  const p = (z) => new THREE.Vector3(Math.cos(f) * R, Math.sin(f) * R, z);
  a.tubo(p(z0), p(z1), radio, color, 6, TIPO.metal);
  for (let z = z0 + 0.3; z < z1 - 0.2; z += 0.62) a.cajaEn(enCasco(f, r, z), radio * 3.2, 0.065, 0.03, COLOR.oscuro, [0, 0.034, 0]);
  for (const z of [z0, z1]) a.cajaEn(enCasco(f, r, z), 0.11, 0.08, 0.09, COLOR.gris, [0, 0.04, 0], TIPO.metal);
}

/** Accesorio de captura para el brazo robótico: placa base, perno con bola, levas y blanco de alineación. */
function accesorioCaptura(a, rect, r, z, f) {
  const m = enCasco(f, r, z);
  a.cajaEn(m, 0.46, 0.03, 0.46, COLOR.acero, [0, 0.015, 0], TIPO.metal);
  a.cajaEn(m, 0.44, 0.008, 0.06, COLOR.amarillo, [0, 0.034, -0.2]);
  const c = new THREE.Vector3(0, 0.03, 0).applyMatrix4(m), eje = new THREE.Vector3(0, 1, 0).transformDirection(m);
  a.disco(0.03, 0.3, COLOR.aluminio, c.clone().addScaledVector(eje, 0.15), eje, 8, TIPO.metal);
  a.sumar(new THREE.SphereGeometry(0.05, 10, 8), COLOR.aluminio, TIPO.metal, new THREE.Matrix4().makeTranslation(...c.clone().addScaledVector(eje, 0.31).toArray()));
  for (let k = 0; k < 3; k++) {
    const ang = k * Math.PI * 2 / 3;
    a.cajaEn(m, 0.05, 0.12, 0.16, COLOR.gris, [Math.cos(ang) * 0.13, 0.09, Math.sin(ang) * 0.13], TIPO.metal);
  }
  // blanco de alineación a un costado, de cara hacia afuera
  const mb = m.clone().multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(0.36, 0, 0.034));
  senalPlana(a, rect, mb, 0.2, 0.2);
  a.cajaEn(m, 0.04, 0.04, 0.04, COLOR.verde, [-0.2, 0.05, 0.2], TIPO.luz);
}

/** Cámara exterior con base de giro, carcasa, parasol, lente de vidrio y luz de estado. */
function camara(a, montaje, objetivo) {
  const salida = montaje.clone();
  const dir = objetivo.clone().sub(montaje).normalize();
  const m = new THREE.Matrix4().lookAt(salida, objetivo, Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).setPosition(salida);
  a.cajaEn(m, 0.16, 0.13, 0.24, COLOR.blanco, [0, 0, 0], TIPO.metal);
  a.cajaEn(m, 0.18, 0.012, 0.14, COLOR.blanco, [0, 0.073, -0.16], TIPO.metal);              // parasol
  for (const x of [-1, 1]) a.cajaEn(m, 0.012, 0.13, 0.14, COLOR.blanco, [x * 0.084, 0.012, -0.16], TIPO.metal);
  a.sumar(new THREE.CylinderGeometry(0.046, 0.05, 0.05, 12).rotateX(Math.PI / 2), COLOR.oscuro, TIPO.normal, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.135)));
  a.sumar(new THREE.CircleGeometry(0.038, 12).rotateY(Math.PI), COLOR.vidrio, TIPO.vidrio, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.161)));
  a.cajaEn(m, 0.02, 0.02, 0.02, COLOR.rojo, [0.05, -0.05, -0.121], TIPO.luz);
  a.cajaEn(m, 0.1, 0.06, 0.1, COLOR.gris, [0, -0.095, 0.03], TIPO.metal);                    // unidad de giro
  a.cajaEn(m, 0.05, 0.12, 0.05, COLOR.gris, [0, -0.18, 0.03], TIPO.metal);
}

function alaSolar() {
  // Marco local: la junta está en el origen, el ala corre por +Y (el grupo se espeja para la de abajo).
  const a = new Armado();
  // mástil reticulado: tres largueros, triángulos cada 0,37 m y diagonales
  const R = 0.1;
  const esquina = (k, y) => new THREE.Vector3(Math.cos(k * 2.094 + 0.5) * R, y, Math.sin(k * 2.094 + 0.5) * R);
  for (let k = 0; k < 3; k++) a.tubo(esquina(k, 0.2), esquina(k, 7.4), 0.012, COLOR.acero, 5, TIPO.metal);
  for (let y = 0.2; y < 7.39; y += 0.37) {
    for (let k = 0; k < 3; k++) {
      a.tubo(esquina(k, y), esquina((k + 1) % 3, y), 0.007, COLOR.acero, 4, TIPO.metal);
      if (y + 0.37 < 7.41) a.tubo(esquina(k, y), esquina((k + 1) % 3, y + 0.37), 0.004, COLOR.gris, 3);
    }
  }
  // junta giratoria: tambor dorado, aro abulonado y motor
  a.sumar(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 16), COLOR.dorado, TIPO.metal, new THREE.Matrix4().makeTranslation(0, 0.05, 0));
  a.sumar(new THREE.TorusGeometry(0.205, 0.018, 5, 20).rotateX(Math.PI / 2), COLOR.acero, TIPO.metal, new THREE.Matrix4().makeTranslation(0, 0.2, 0));
  for (let k = 0; k < 12; k++) { const ang = k * Math.PI / 6; a.caja(0.02, 0.02, 0.02, COLOR.gris, [Math.cos(ang) * 0.205, 0.225, Math.sin(ang) * 0.205]); }
  a.caja(0.12, 0.14, 0.1, COLOR.oscuro, [0.24, 0.08, 0]);
  for (const lado of [-1, 1]) {
    // manta de celdas: 1,6 m de ancho por 6,6 m de largo, celdas de 0,2 m
    const g = new THREE.PlaneGeometry(1.6, 6.6);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 33);
    a.sumar(g, COLOR.celda, TIPO.celda, new THREE.Matrix4().makeTranslation(lado * 1.02, 4.0, 0));
    // dorso de la manta (kapton): no se ve negro desde atrás
    a.sumar(new THREE.PlaneGeometry(1.6, 6.6).rotateY(Math.PI), COLOR.dorado, TIPO.normal, new THREE.Matrix4().makeTranslation(lado * 1.02, 4.0, -0.006));
    // marco, travesaños y bisagras en cada unión
    a.caja(0.04, 6.7, 0.04, COLOR.aluminio, [lado * 1.84, 4.0, 0], [0, 0, 0], TIPO.metal);
    a.caja(0.04, 6.7, 0.04, COLOR.aluminio, [lado * 0.2, 4.0, 0], [0, 0, 0], TIPO.metal);
    for (let y = 0.7; y <= 7.31; y += 1.1) {
      a.caja(1.68, 0.035, 0.035, COLOR.aluminio, [lado * 1.02, y, -0.03], [0, 0, 0], TIPO.metal);
      for (const x of [0.2, 1.84]) a.sumar(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 8).rotateZ(Math.PI / 2), COLOR.acero, TIPO.metal, new THREE.Matrix4().makeTranslation(lado * x, y, -0.03));
    }
    // cables tensores en los bordes y caja de conexiones al pie
    a.tubo(new THREE.Vector3(lado * 1.86, 0.66, 0.03), new THREE.Vector3(lado * 1.86, 7.34, 0.03), 0.004, COLOR.gris, 3);
    a.caja(0.22, 0.1, 0.08, COLOR.oscuro, [lado * 0.5, 0.56, -0.05]);
  }
  // cajas de guardado de las mantas (al pie y en la punta) y su marca
  a.caja(3.8, 0.1, 0.16, COLOR.blanco, [0, 0.62, 0], [0, 0, 0], TIPO.metal);
  a.caja(3.8, 0.1, 0.16, COLOR.blanco, [0, 7.38, 0], [0, 0, 0], TIPO.metal);
  return a;
}

function plato(radio, rect) {
  // Marco local: el plato mira hacia +Z; el origen es el eje de elevación.
  const a = new Armado();
  const perfil = [];
  for (let i = 0; i <= 8; i++) { const r = radio * i / 8; perfil.push(new THREE.Vector2(r, 0.32 * radio * (r / radio) * (r / radio))); }
  const g = new THREE.LatheGeometry(perfil, 24);
  g.rotateX(Math.PI / 2);                                               // eje del plato sobre +Z
  a.sumar(g, COLOR.blanco, TIPO.metal);
  a.sumar(new THREE.TorusGeometry(radio, 0.014, 4, 32), COLOR.acero, TIPO.metal, new THREE.Matrix4().makeTranslation(0, 0, 0.32 * radio));
  // nervios del dorso
  for (let i = 0; i < 6; i++) {
    const ang = i * Math.PI / 3;
    a.tubo(new THREE.Vector3(Math.cos(ang) * radio * 0.15, Math.sin(ang) * radio * 0.15, 0.0), new THREE.Vector3(Math.cos(ang) * radio * 0.97, Math.sin(ang) * radio * 0.97, 0.3 * radio - 0.02), 0.012, COLOR.gris, 4, TIPO.metal);
  }
  // patas del alimentador, bocina y subreflector
  for (let i = 0; i < 3; i++) {
    const ang = i * Math.PI * 2 / 3 + 0.5;
    a.tubo(new THREE.Vector3(Math.cos(ang) * radio * 0.8, Math.sin(ang) * radio * 0.8, 0.2 * radio), new THREE.Vector3(0, 0, radio * 0.78), 0.012, COLOR.gris, 5, TIPO.metal);
  }
  a.sumar(new THREE.CylinderGeometry(0.03, 0.065, 0.14, 10).rotateX(-Math.PI / 2), COLOR.dorado, TIPO.metal, new THREE.Matrix4().makeTranslation(0, 0, radio * 0.62));
  a.sumar(new THREE.CylinderGeometry(0.09 * radio / 0.85, 0.06 * radio / 0.85, 0.03, 12).rotateX(Math.PI / 2), COLOR.aluminio, TIPO.metal, new THREE.Matrix4().makeTranslation(0, 0, radio * 0.8));
  a.caja(0.16, 0.16, 0.2, COLOR.gris, [0, 0, -0.08], [0, 0, 0], TIPO.metal);
  // horquilla de elevación
  a.sumar(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 10).rotateZ(Math.PI / 2), COLOR.acero, TIPO.metal, new THREE.Matrix4().makeTranslation(0, 0, -0.08));
  if (rect) senalPlana(a, rect, new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, 0, -0.181), 0.16, 0.04);
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
 *            traje: THREE.Mesh, paneles: SolarPanelController, antenas: AntennaController, actualizar: (dt: number) => void,
 *            material: THREE.ShaderMaterial, anclajes: THREE.Vector3[]}}
 */
export function crearExterior(sol, colorSol) {
  const grupo = new THREE.Group();
  grupo.name = 'Exterior_Artigas1';
  const atlas = crearAtlas();
  const R = atlas.rect;
  const material = crearMaterial(sol, colorSol, atlas.tex);
  const colisiones = new SistemaColisiones(0.5);
  const I = new THREE.Matrix4();
  const a = new Armado();
  const caja = (x0, y0, z0, x1, y1, z1) => colisiones.agregarCaja(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)), I);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rad = THREE.MathUtils.degToRad;

  // ---- cascos: paneles de manta térmica, aros abulonados entre tramos y tapas cónicas entre radios distintos
  CASCOS.forEach((c, i) => {
    const tramos = tramosDe(c);
    const f0 = c.sinAbajo ? NODO_DESDE : 0, largo = c.sinAbajo ? NODO_LARGO : Math.PI * 2;
    // la circunferencia se reparte en paneles enteros de ~0,55 m: la costura no se corta donde cierra el cilindro
    const panel = (Math.PI * 2 * c.radio) / Math.round((Math.PI * 2 * c.radio) / 0.55);
    for (let t = 0; t < tramos; t++) {
      const za = c.z0 + (c.z1 - c.z0) * t / tramos;
      const zb = c.z0 + (c.z1 - c.z0) * (t + 1) / tramos;
      a.sumar(superficie(c.radio, za + 0.02, zb - 0.02, f0, f0 + largo, 32, (f, z) => [f * c.radio * 0.55 / panel, z]), (t + i) % 2 ? COLOR.beta : COLOR.manta, TIPO.manta);
      aro(a, c.radio, zb, c.sinAbajo);
    }
    aro(a, c.radio, c.z0, c.sinAbajo);
    colisiones.agregarMalla(casco(c.z0, c.z1, c.radio, c.radio, 14, c.sinAbajo), I);
    const sig = CASCOS[i + 1];
    if (sig && Math.abs(sig.radio - c.radio) > 0.01) {
      // el siguiente módulo está hacia -Z: tapa anular entre los dos radios
      const tapa = new THREE.RingGeometry(Math.min(c.radio, sig.radio), Math.max(c.radio, sig.radio), 32);
      a.sumar(tapa, COLOR.gris, TIPO.metal, new THREE.Matrix4().makeTranslation(0, 0, c.z0));
    }
  });
  // tapas de los extremos: fondo de Tacuarembó y proa del carguero, con su puerto de acople
  a.sumar(new THREE.CircleGeometry(2.10, 32), COLOR.manta, TIPO.manta, new THREE.Matrix4().makeTranslation(0, 0, 6.86), (x, y) => [x, y]);
  a.sumar(new THREE.ConeGeometry(2.04, 1.1, 32, 1, true).rotateX(-Math.PI / 2), COLOR.beta, TIPO.manta, new THREE.Matrix4().makeTranslation(0, 0, -12.17), (x, y, z) => [Math.atan2(z, x) * 1.4, y]);
  a.sumar(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20).rotateX(Math.PI / 2), COLOR.acero, TIPO.metal, new THREE.Matrix4().makeTranslation(0, 0, -12.74));
  a.sumar(new THREE.TorusGeometry(0.42, 0.03, 5, 24), COLOR.amarillo, TIPO.normal, new THREE.Matrix4().makeTranslation(0, 0, -12.81));
  caja(-1.5, -1.5, 6.86, 1.5, 1.5, 6.96);
  caja(-1.2, -1.2, -12.4, 1.2, 1.2, -11.62);
  // motores de maniobra del carguero: bloque con cuatro toberas
  for (const [x, y] of [[1.45, 1.45], [-1.45, 1.45], [1.45, -1.45], [-1.45, -1.45]]) {
    a.caja(0.22, 0.22, 0.4, COLOR.oscuro, [x, y, -10.4], [0, 0, 0], TIPO.metal);
    const fuera = V(x, y, 0).normalize();
    for (const dz of [-0.11, 0.11]) a.sumar(new THREE.CylinderGeometry(0.025, 0.045, 0.08, 8, 1, true), COLOR.acero, TIPO.metal, new THREE.Matrix4().compose(V(x, y, -10.4 + dz).addScaledVector(fuera, 0.15), _q.setFromUnitVectors(V(0, 1, 0), fuera), UNO));
  }

  // ---- esclusa: vestíbulo, marco, puerta con bisagras y manija, luz de estado y señal
  const E = ESCLUSA.exterior;
  a.sumar(new THREE.CylinderGeometry(0.66, 0.66, 0.34, 24, 1, true).rotateZ(Math.PI / 2), COLOR.beta, TIPO.manta, new THREE.Matrix4().makeTranslation(E.x - 0.15, E.y, E.z), (x, y, z) => [Math.atan2(z, y) * 0.66, x]);
  a.sumar(new THREE.TorusGeometry(0.62, 0.07, 8, 28).rotateY(Math.PI / 2), COLOR.amarillo, TIPO.normal, new THREE.Matrix4().makeTranslation(E.x + 0.02, E.y, E.z));
  a.sumar(new THREE.CircleGeometry(0.58, 28).rotateY(Math.PI / 2), COLOR.aluminio, TIPO.metal, new THREE.Matrix4().makeTranslation(E.x + 0.015, E.y, E.z));
  a.sumar(new THREE.TorusGeometry(0.42, 0.012, 4, 24).rotateY(Math.PI / 2), COLOR.acero, TIPO.metal, new THREE.Matrix4().makeTranslation(E.x + 0.025, E.y, E.z));
  a.caja(0.03, 0.10, 0.62, COLOR.oscuro, [E.x + 0.04, 0, E.z]);                       // barra de cierre
  a.tubo(V(E.x + 0.07, -0.14, E.z + 0.18), V(E.x + 0.07, 0.14, E.z + 0.18), 0.014, COLOR.amarillo, 6);   // manija
  for (const y of [-0.14, 0.14]) a.tubo(V(E.x + 0.025, y, E.z + 0.18), V(E.x + 0.07, y, E.z + 0.18), 0.009, COLOR.oscuro, 4);
  for (const y of [-0.3, 0.3]) a.disco(0.04, 0.16, COLOR.acero, V(E.x + 0.05, y, E.z - 0.6), V(0, 1, 0), 10, TIPO.metal);   // bisagras
  a.caja(0.04, 0.06, 0.06, COLOR.verde, [E.x + 0.04, 0.72, E.z], [0, 0, 0], TIPO.luz);
  a.caja(0.04, 0.06, 0.06, COLOR.ambar, [E.x + 0.04, 0.72, E.z + 0.12], [0, 0, 0], TIPO.normal);   // apagada: la esclusa no está despresurizando
  senalCurva(a, R.esclusa, 1.775, E.z, 0.56, 0.86, 0.27);
  senalPlana(a, R.anclaje_1, marcoPlano(V(ESCLUSA.ancla.x + 0.065, ESCLUSA.ancla.y - 0.14, ESCLUSA.ancla.z), V(1, 0, 0), V(0, 1, 0)), 0.12, 0.12);

  // ---- viga dorsal con montantes, bandeja de conductos y abrazaderas
  a.caja(0.30, 0.26, 14.6, COLOR.gris, [0, VIGA_Y - 0.1, -0.75], [0, 0, 0], TIPO.metal);
  for (const x of [-0.155, 0.155]) a.caja(0.012, 0.2, 14.6, COLOR.acero, [x, VIGA_Y - 0.1, -0.75], [0, 0, 0], TIPO.metal);
  for (let z = -7.9; z <= 6.4; z += 0.65) for (const x of [-0.16, 0.16]) a.caja(0.016, 0.24, 0.05, COLOR.oscuro, [x, VIGA_Y - 0.1, z]);   // costillas
  caja(-0.15, VIGA_Y - 0.23, -8.05, 0.15, VIGA_Y + 0.03, 6.55);
  for (let z = -7.8; z <= 6.4; z += 1.3) a.caja(0.36, 0.05, 0.05, COLOR.oscuro, [0, VIGA_Y + 0.045, z]);
  for (const z of [-8.0, -6.0, 3.0]) a.tubo(V(0, 1.6, z), V(0, VIGA_Y - 0.2, z), 0.06, COLOR.gris, 6, TIPO.metal);
  for (const x of [-0.1, 0.0, 0.1]) a.tubo(V(x, VIGA_Y + 0.055, -7.9), V(x, VIGA_Y + 0.055, 6.4), 0.018, x === 0 ? COLOR.dorado : COLOR.oscuro, 5, TIPO.metal);
  for (let z = -7.5; z <= 6.3; z += 0.65) a.caja(0.27, 0.02, 0.03, COLOR.acero, [0, VIGA_Y + 0.076, z], [0, 0, 0], TIPO.metal);
  // GPS y rastreador de estrellas sobre la viga
  for (const z of [4.1, -4.6]) a.disco(0.07, 0.025, COLOR.blanco, V(0.0, VIGA_Y + 0.1, z), V(0, 1, 0), 12, TIPO.metal);
  a.caja(0.14, 0.12, 0.14, COLOR.oscuro, [-0.08, VIGA_Y + 0.09, -0.4], [0, 0, 0], TIPO.metal);
  a.sumar(new THREE.CylinderGeometry(0.05, 0.035, 0.14, 10, 1, true), COLOR.oscuro, TIPO.normal, new THREE.Matrix4().compose(V(-0.12, VIGA_Y + 0.22, -0.38), _q.setFromEuler(_e.set(0.35, 0, 0.35)), UNO));
  a.sumar(new THREE.CircleGeometry(0.034, 10).rotateX(-Math.PI / 2), COLOR.vidrio, TIPO.vidrio, new THREE.Matrix4().compose(V(-0.1, VIGA_Y + 0.16, -0.39), _q.setFromEuler(_e.set(0.35, 0, 0.35)), UNO));

  // ---- mástiles de los paneles solares (la parte fija) y sus juntas
  a.tubo(V(0, VIGA_Y, -6.8), V(0, 2.86, -6.8), 0.11, COLOR.gris, 12, TIPO.metal);
  a.tubo(V(0, -1.6, -6.8), V(0, -2.86, -6.8), 0.11, COLOR.gris, 12, TIPO.metal);
  for (const y of [2.5, -1.75, -2.5]) a.sumar(new THREE.TorusGeometry(0.12, 0.016, 4, 16).rotateX(Math.PI / 2), COLOR.acero, TIPO.metal, new THREE.Matrix4().makeTranslation(0, y, -6.8));
  a.caja(0.26, 0.2, 0.22, COLOR.oscuro, [0, 2.62, -6.6], [0, 0, 0], TIPO.metal);       // caja de la junta (punto de inspección)
  a.caja(0.03, 0.03, 0.03, COLOR.verde, [0.08, 2.735, -6.52], [0, 0, 0], TIPO.luz);
  senalPlana(a, R.franja, marcoPlano(V(0, 2.62, -6.488), V(0, 0, 1), V(0, 1, 0)), 0.24, 0.06);
  senalPlana(a, R.no_pisar, marcoPlano(V(0, VIGA_Y + 0.031, -7.15), V(0, 1, 0), V(0, 0, 1)), 0.27, 0.0675);
  caja(-0.14, 2.3, -6.94, 0.14, 2.9, -6.48);

  // ---- radiadores de Tacuarembó: cuatro hojas en acordeón a cada lado, con marcos, bisagras y líneas de fluido
  for (const s of [-1, 1]) {
    a.tubo(V(s * 2.0, 0.55, 5.2), V(s * 2.45, 0.55, 5.2), 0.06, COLOR.gris, 10, TIPO.metal);
    a.caja(0.2, 0.16, 0.16, COLOR.dorado, [s * 2.16, 0.55, 5.2], [0, 0, 0], TIPO.metal);                     // conector de fluido (punto de inspección)
    for (const dz of [-0.09, 0.09]) a.disco(0.03, 0.05, COLOR.acero, V(s * 2.16, 0.55, 5.2 + dz * 1.1), V(0, 0, 1), 8, TIPO.metal);
    a.caja(0.03, 0.03, 0.03, COLOR.ambar, [s * 2.16, 0.645, 5.25], [0, 0, 0], TIPO.luz);
    for (let h = 0; h < 4; h++) {
      const rz = (h % 2 ? -1 : 1) * 0.16 * s;
      const m = new THREE.Matrix4().compose(V(s * (2.9 + h * 0.84), 0.55 + (h % 2 ? 0.07 : -0.07), 5.2), _q.setFromEuler(_e.set(0, 0, rz)), UNO);
      a.cajaEn(m, 0.86, 0.03, 2.2, COLOR.radiador, [0, 0, 0], TIPO.radiador, (x, y, z) => [x, z]);
      for (const z of [-1.1, 1.1]) a.cajaEn(m, 0.88, 0.045, 0.035, COLOR.aluminio, [0, 0, z], TIPO.metal);
      for (const x of [-0.43, 0.43]) a.cajaEn(m, 0.02, 0.04, 2.2, COLOR.acero, [x, 0, 0], TIPO.metal);
      if (h < 3) for (const z of [-0.75, 0.75]) a.sumar(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 8).rotateX(Math.PI / 2), COLOR.acero, TIPO.metal, m.clone().multiply(new THREE.Matrix4().makeTranslation(0.43, 0, z)));
    }
    caja(Math.min(s * 2.45, s * 5.9), 0.42, 4.1, Math.max(s * 2.45, s * 5.9), 0.68, 6.3);
    a.tubo(V(s * 2.45, 0.55, 4.2), V(s * 5.8, 0.55, 4.2), 0.02, COLOR.gris, 5, TIPO.metal);
    a.tubo(V(s * 2.45, 0.55, 6.2), V(s * 5.8, 0.55, 6.2), 0.02, COLOR.gris, 5, TIPO.metal);
    a.tubo(V(s * 2.45, 0.6, 4.3), V(s * 2.45, 0.6, 6.1), 0.016, COLOR.dorado, 5, TIPO.metal);              // colector
  }
  senalCurva(a, R.caliente, 2.112, mitadTramo('tacuarembo', 1), rad(-6), 1.0, 0.25);

  // ---- antenas fijas, cámaras, sensores y luces de navegación
  for (const [x, y, z, largo] of [[0.9, 1.5, -10.2, 1.4], [-0.9, 1.5, -10.2, 1.1], [0, VIGA_Y, -3.2, 1.6]]) {
    const dir = V(x, y, 0).normalize();
    const p0 = V(x, y, z), p1 = p0.clone().addScaledVector(dir, largo);
    a.tubo(p0, p1, 0.012, COLOR.oscuro, 5);
    a.disco(0.04, 0.06, COLOR.gris, p0.clone().addScaledVector(dir, 0.03), dir, 8, TIPO.metal);
    a.esfera(0.018, COLOR.blanco, p1.toArray());
  }
  for (let v = 0; v < 6; v++) {                                                       // antena helicoidal de telemetría
    const y = VIGA_Y + 0.15 + v * 0.11;
    a.sumar(new THREE.TorusGeometry(0.09, 0.008, 4, 12).rotateX(Math.PI / 2), COLOR.dorado, TIPO.metal, new THREE.Matrix4().makeTranslation(0, y, -1.2));
  }
  a.tubo(V(0, VIGA_Y, -1.2), V(0, VIGA_Y + 0.85, -1.2), 0.012, COLOR.gris, 5);
  a.disco(0.12, 0.02, COLOR.gris, V(0, VIGA_Y + 0.04, -1.2), V(0, 1, 0), 12, TIPO.metal);
  camara(a, V(1.5, 1.62, -2.0), V(3.2, 1.0, -5.0));
  camara(a, V(-1.5, 1.62, 4.6), V(-3.2, 1.0, 7.5));
  camara(a, V(0.0, VIGA_Y + 0.3, 6.35), V(0.0, VIGA_Y - 0.2, -2.0));                 // mira a lo largo de la viga
  a.tubo(V(0, VIGA_Y + 0.03, 6.35), V(0, VIGA_Y + 0.13, 6.35), 0.025, COLOR.gris, 6, TIPO.metal);
  for (const [f, z] of [[rad(145), 1.0], [rad(62), 0.95]]) {                         // domos de sensores
    const m = enCasco(f, 1.76, z);
    a.sumar(new THREE.SphereGeometry(0.075, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), COLOR.vidrio, TIPO.vidrio, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.03, 0)));
    a.cajaEn(m, 0.2, 0.03, 0.2, COLOR.acero, [0, 0.015, 0], TIPO.metal);
  }
  a.esfera(0.05, COLOR.rojo, [-2.14, 0, -2.1], TIPO.luz);                             // babor: roja
  a.esfera(0.05, COLOR.verde, [2.14, 0, -2.1], TIPO.luz);                             // estribor: verde
  for (const x of [-2.1, 2.1]) a.disco(0.07, 0.03, COLOR.oscuro, V(x, 0, -2.1), V(1, 0, 0), 10, TIPO.metal);
  a.esfera(0.055, COLOR.luz, [0, VIGA_Y + 0.1, 6.5], TIPO.baliza);
  a.esfera(0.055, COLOR.luz, [0, -2.08, -10.2], TIPO.baliza);
  a.esfera(0.045, COLOR.luz, [0, VIGA_Y + 0.1, -8.0], TIPO.baliza);
  a.esfera(0.04, COLOR.ambar, [0, 2.08, -11.0], TIPO.baliza);

  // ---- protección, placas de mantenimiento, conductos y accesorios de captura
  for (const [r, z0, z1, f0, f1] of [
    [2.10, -4.72, -3.32, 2.62, 3.22], [2.10, -3.22, -1.82, 2.62, 3.22], [2.10, -1.72, 0.48, 2.62, 3.22],
    [2.10, -4.72, -3.32, 4.02, 4.62], [2.10, -3.22, -1.82, 4.02, 4.62],
    [2.10, 3.74, 5.1, 2.72, 3.32], [2.10, 5.2, 6.7, 2.72, 3.32], [2.10, 3.74, 5.1, 4.02, 4.62], [2.10, 5.2, 6.7, 4.02, 4.62],
    [1.72, -8.6, -7.2, 2.42, 3.0], [1.72, -6.5, -5.05, 2.42, 3.0],
  ]) panelEscudo(a, r, z0, z1, f0, f1);
  for (const [r, z, f] of [[1.76, 2.9, rad(150)], [1.76, 1.2, rad(200)], [1.72, -6.0, rad(28)], [2.04, -9.4, rad(205)], [2.10, -0.4, rad(300)]]) placaMantenimiento(a, r, z, f);
  for (const [r, z0, z1, f, color] of [[2.10, -4.75, 0.5, rad(212), COLOR.gris], [2.10, -4.75, 0.5, rad(218), COLOR.dorado], [2.10, 3.7, 6.75, rad(212), COLOR.gris], [1.72, -8.6, -5.0, rad(330), COLOR.gris]]) conducto(a, r, z0, z1, f, 0.02, color);
  accesorioCaptura(a, R.captura, 2.10, -2.5, rad(300));
  accesorioCaptura(a, R.captura, 2.04, -10.0, rad(160));

  // ---- señalética: nombre, módulos y bandera
  // el nombre va en una placa elevada sobre separadores: es más largo que un tramo y cruza dos aros
  panelEscudo(a, 2.10, -3.82, -0.38, rad(16) - 0.5 / 2.17 / 2 * 2.0, rad(16) + 0.5 / 2.17 / 2 * 2.0);
  senalCurva(a, R.nombre, 2.176, -2.1, rad(16), 3.2, 0.8);
  // los módulos, en el centro de un tramo (entre dos aros)
  for (const [id, r, k, f, ancho] of [['tacuarembo', 2.112, 2, rad(124), 1.0], ['nodo', 1.772, 0, rad(126), 0.86], ['rivera', 2.112, 1, rad(124), 1.0], ['colonia', 1.732, 0, rad(124), 1.0], ['carguero', 2.052, 0, rad(104), 0.9]]) {
    senalCurva(a, R[`modulo_${id}`], r, mitadTramo(id, k), f, ancho, ancho / 4);
  }
  senalCurva(a, R.bandera, 2.052, mitadTramo('carguero', 1), rad(104), 0.45, 0.3);

  // ---- pasamanos (visual y capa de agarre) y puntos de anclaje numerados
  const barandas = [];
  for (const [p0, p1] of pasamanos()) {
    a.tubo(p0, p1, 0.017, COLOR.amarillo, 8);
    // dos apoyos hacia el eje de la estación (o hacia la viga), con su pie
    for (const p of [p0, p1]) {
      const haciaAdentro = Math.abs(p.x) < 0.4 && p.y > VIGA_Y ? _v.set(0, -1, 0) : _v.set(-p.x, -p.y, 0).normalize();
      a.tubo(p, p.clone().addScaledVector(haciaAdentro, 0.09), 0.012, COLOR.oscuro, 5);
      a.disco(0.025, 0.012, COLOR.oscuro, p.clone().addScaledVector(haciaAdentro, 0.088), haciaAdentro.clone(), 6);
    }
    barandas.push({ a: p0, b: p1, nombre: 'Pasamanos_Exterior' });
  }
  a.caja(0.12, 0.12, 0.12, COLOR.amarillo, [ESCLUSA.ancla.x, ESCLUSA.ancla.y, ESCLUSA.ancla.z]);   // anclaje del cable
  a.sumar(new THREE.TorusGeometry(0.05, 0.012, 5, 14).rotateY(Math.PI / 2), COLOR.acero, TIPO.metal, new THREE.Matrix4().makeTranslation(ESCLUSA.ancla.x + 0.075, ESCLUSA.ancla.y, ESCLUSA.ancla.z));
  const anclajes = [ESCLUSA.ancla.clone()];
  for (const [i, p, normal, arriba] of [
    [2, V(0.2, VIGA_Y + 0.03, 6.0), V(0, 1, 0), V(0, 0, -1)], [3, V(0.2, VIGA_Y + 0.03, 0.85), V(0, 1, 0), V(0, 0, -1)],
    [4, V(0.2, VIGA_Y + 0.03, -5.65), V(0, 1, 0), V(0, 0, -1)], [5, V(0.2, VIGA_Y + 0.03, 3.45), V(0, 1, 0), V(0, 0, -1)],
    [6, V(Math.cos(rad(34)) * 2.11, Math.sin(rad(34)) * 2.11, 4.7), V(Math.cos(rad(34)), Math.sin(rad(34)), 0), V(0, 0, 1)],
  ]) {
    a.sumar(new THREE.TorusGeometry(0.045, 0.011, 5, 14), COLOR.amarillo, TIPO.normal, marcoPlano(p.clone().addScaledVector(normal, 0.03), arriba.clone(), normal));
    a.disco(0.03, 0.03, COLOR.oscuro, p.clone().addScaledVector(normal, 0.012), normal, 8);
    senalPlana(a, R[`anclaje_${i}`], marcoPlano(p.clone().addScaledVector(normal, 0.003).addScaledVector(new THREE.Vector3().crossVectors(arriba, normal), -0.1), normal, arriba), 0.08, 0.08);
    anclajes.push(p.clone());
  }

  const fijo = new THREE.Mesh(a.terminar(), material);
  fijo.name = 'Exterior_Fijo';
  fijo.matrixAutoUpdate = false;
  grupo.add(fijo);

  // ---- partes móviles
  const armadoAla = alaSolar();
  senalPlana(armadoAla, R.panel, new THREE.Matrix4().setPosition(0, 0.62, 0.081), 0.4, 0.1);
  const geoAla = armadoAla.terminar();
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
    const mAla = new THREE.Matrix4().compose(V(0, s * 2.86, -6.8), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), paneles.objetivo), V(1, s, 1));
    colisiones.agregarCaja(new THREE.Box3(V(-1.9, 0.6, -0.05), V(1.9, 7.4, 0.05)), mAla);
  }

  const base = new THREE.Group();                 // acimut de la antena principal, sobre el Nodo
  base.position.set(0, VIGA_Y + 0.03, 2.11);
  const am = new Armado().tubo(V(0, 0, 0), V(0, 0.95, 0), 0.07, COLOR.gris, 10, TIPO.metal).caja(0.3, 0.14, 0.3, COLOR.oscuro, [0, 0.07, 0], [0, 0, 0], TIPO.metal).caja(0.34, 0.16, 0.12, COLOR.gris, [0, 0.95, 0], [0, 0, 0], TIPO.metal);
  am.sumar(new THREE.TorusGeometry(0.16, 0.014, 4, 16).rotateX(Math.PI / 2), COLOR.acero, TIPO.metal, new THREE.Matrix4().makeTranslation(0, 0.15, 0));
  for (const x of [-0.19, 0.19]) am.caja(0.04, 0.22, 0.1, COLOR.acero, [x, 0.95, 0], [0, 0, 0], TIPO.metal);       // horquilla
  am.tubo(V(0.08, 0.15, 0.06), V(0.08, 0.86, 0.06), 0.014, COLOR.dorado, 5, TIPO.metal);                          // guía de ondas
  senalPlana(am, R.rf, new THREE.Matrix4().setPosition(0, 0.07, 0.151), 0.26, 0.065);
  senalPlana(am, R.rf, new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, 0.07, -0.151), 0.26, 0.065);
  const mastil = new THREE.Mesh(am.terminar(), material);
  const platoPrincipal = new THREE.Mesh(plato(0.85, R.franja), material);
  platoPrincipal.position.set(0, 0.95, 0.12);
  base.add(mastil, platoPrincipal);
  grupo.add(base);
  const base2 = new THREE.Group();                // antena secundaria, en el fondo de Tacuarembó
  base2.position.set(0.9, 1.2, 6.9);
  const plato2 = new THREE.Mesh(plato(0.42, null), material);
  plato2.position.set(0, 0.35, 0.08);
  base2.add(new THREE.Mesh(new Armado().tubo(V(0, 0, 0), V(0, 0.35, 0), 0.04, COLOR.gris, 8, TIPO.metal).caja(0.14, 0.06, 0.14, COLOR.oscuro, [0, 0.03, 0], [0, 0, 0], TIPO.metal).terminar(), material), plato2);
  grupo.add(base2);
  const antenas = new AntennaController([{ base, plato: platoPrincipal, periodo: 46 }, { base: base2, plato: plato2, periodo: 71 }]);
  caja(-0.6, VIGA_Y, 1.6, 0.6, VIGA_Y + 1.9, 2.9);

  colisiones.construir();
  const mallaTraje = new THREE.Mesh(traje(), material);
  mallaTraje.name = 'Traje_EVA';
  return {
    grupo, colisiones, pasamanos: barandas, traje: mallaTraje, paneles, antenas, material, anclajes, atlas: atlas.tex,
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
