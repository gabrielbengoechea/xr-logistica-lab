// Guante de astronauta: carga la malla de artigas1-vr/Blender/guante.py y arma una malla deformable por mano.
//
// El .bin trae, por vértice, posición y normal en el marco «modelo» de la mano derecha (dedos hacia -Z, palma
// hacia -Y, pulgar del lado -X), los cuatro huesos que la mueven con sus pesos, la zona del guante y una marca
// de costura. La mano izquierda es el espejo: se invierte X y el orden de los triángulos.
//
// Los huesos no tienen jerarquía: js/manos.js le da a cada uno, cada cuadro, la matriz (sin escala) de la pieza
// de la cinemática que le corresponde, ya en el mundo. La inversa de reposo sale de la misma cinemática con la
// pose de modelado que trae el .json, así que lo que se ve coincide con las poses y los agarres.
//
// Material: un solo MeshStandardMaterial con color por zona; la rugosidad y la metalicidad salen de atributos y
// la tela tiene un relieve de trama hecho en el shader (sin texturas), que se apaga solo cuando la trama queda
// más chica que un píxel para que no titile.
import * as THREE from 'three';

const ESPEJO = new THREE.Matrix4().makeScale(-1, 1, 1);

/** Copia la parte rígida (rotación y posición, sin escala) de `m` en `out`. */
export function rigida(out, m) {
  out.extractRotation(m);
  const e = m.elements;
  return out.setPosition(e[12], e[13], e[14]);
}

/**
 * Arma la geometría del guante para un lado.
 * @param {object} d  Arreglos leídos del .bin.
 * @param {boolean} izquierda  Espejo en X.
 * @param {number} inflado  Metros a lo largo de la normal (guante presurizado).
 * @param {{color: number, rugosidad: number, metal: number}[]} zonas
 */
export function geometriaGuante(d, izquierda, inflado, zonas) {
  const n = d.posicion.length / 3;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const rug = new Float32Array(n);
  const met = new Float32Array(n);
  const tej = new Float32Array(n);
  const cos = new Float32Array(n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const s = izquierda ? -1 : 1;
    pos[i * 3] = (d.posicion[i * 3] + d.normal[i * 3] * inflado) * s;
    pos[i * 3 + 1] = d.posicion[i * 3 + 1] + d.normal[i * 3 + 1] * inflado;
    pos[i * 3 + 2] = d.posicion[i * 3 + 2] + d.normal[i * 3 + 2] * inflado;
    nor[i * 3] = d.normal[i * 3] * s;
    nor[i * 3 + 1] = d.normal[i * 3 + 1];
    nor[i * 3 + 2] = d.normal[i * 3 + 2];
    const z = zonas[d.zona[i]] || zonas[0];
    c.set(z.color);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    rug[i] = z.rugosidad;
    met[i] = z.metal;
    tej[i] = d.zona[i] === 0 || d.zona[i] === 4 ? 1 : d.zona[i] === 1 ? 0.45 : 0;   // trama en la tela y el puño; grano en la goma
    cos[i] = d.costura[i] / 255;
  }
  const idx = new Uint16Array(d.indices);
  if (izquierda) for (let t = 0; t < idx.length; t += 3) { const a = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = a; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aRug', new THREE.BufferAttribute(rug, 1));
  g.setAttribute('aMet', new THREE.BufferAttribute(met, 1));
  g.setAttribute('aTejido', new THREE.BufferAttribute(tej, 1));
  g.setAttribute('aCostura', new THREE.BufferAttribute(cos, 1));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(d.huesos), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(d.pesos, (v) => v / 255), 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/** Material del guante (compartido por las tres manos). */
export function materialGuante(entorno = null) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMap: entorno, envMapIntensity: 0.55 });
  m.name = 'Guante';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aRug; attribute float aMet; attribute float aTejido; attribute float aCostura;
        varying float vRug; varying float vMet; varying float vTejido; varying float vCostura; varying vec3 vReposo;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRug = aRug; vMet = aMet; vTejido = aTejido; vCostura = aCostura; vReposo = position;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vRug; varying float vMet; varying float vTejido; varying float vCostura; varying vec3 vReposo;
        // trama de tela tipo ripstop (cuadriculado de ~6 mm) más un grano fino; en metros, fijo al guante
        float trama(vec3 p) {
          vec3 q = p * 1050.0;
          float a = sin(q.x) * sin(q.z) + sin(q.y) * sin(q.z * 0.97) + sin(q.x * 0.93) * sin(q.y);
          vec3 r = p * 5200.0;
          float b = sin(r.x + r.y) * sin(r.z - r.x) * 0.35;
          return a * 0.33 + b;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 1.0 - 0.42 * smoothstep(0.25, 1.0, vCostura);    // costuras y bordes entre paneles`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = vRug;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = vMet;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // relieve de la trama por derivadas de pantalla (bump sin textura); se apaga cuando la trama es más
          // chica que un píxel
          float alto = trama(vReposo) * 0.00004 * vTejido;
          float fino = length(fwidth(vReposo * 1050.0));
          float atenua = 1.0 - smoothstep(0.35, 1.0, fino);
          vec2 dH = vec2(dFdx(alto), dFdy(alto)) * atenua;
          vec3 sx = dFdx(-vViewPosition);
          vec3 sy = dFdy(-vViewPosition);
          vec3 r1 = cross(sy, normal);
          vec3 r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
          normal = normalize(abs(det) * normal - grad);
        }`);
  };
  return m;
}

/** Lee guante.json y guante.bin. */
export async function cargarDatosGuante(base) {
  const info = await (await fetch(`${base}guante.json`)).json();
  const buf = await (await fetch(`${base}guante.bin`)).arrayBuffer();
  if (buf.byteLength !== info.bytes) throw new Error(`guante.bin: ${buf.byteLength} bytes, se esperaban ${info.bytes}`);
  const o = info.desplazamientos;
  const n = info.vertices;
  return {
    info,
    posicion: new Float32Array(buf, o.posicion, n * 3),
    normal: new Float32Array(buf, o.normal, n * 3),
    huesos: new Uint8Array(buf, o.huesos, n * 4),
    pesos: new Uint8Array(buf, o.pesos, n * 4),
    zona: new Uint8Array(buf, o.zona, n),
    costura: new Uint8Array(buf, o.costura, n),
    indices: new Uint16Array(buf, o.indices, info.indices),
  };
}

/**
 * Una mano con guante: SkinnedMesh con huesos sueltos que maneja js/manos.js.
 */
export class ManoGuante {
  /**
   * @param {{derecha: THREE.BufferGeometry, izquierda: THREE.BufferGeometry, derechaP: THREE.BufferGeometry, izquierdaP: THREE.BufferGeometry}} geos
   * @param {THREE.Matrix4[]} reposo  Matriz rígida de reposo de cada hueso (marco «modelo» de la derecha).
   * @param {THREE.Material} material
   */
  constructor(geos, reposo, material) {
    this.geos = geos;
    this.huesos = reposo.map((_, i) => { const b = new THREE.Bone(); b.name = `Guante_hueso_${i}`; b.matrixAutoUpdate = false; return b; });
    this._inversaDer = reposo.map((m) => m.clone().invert());
    this._inversaIzq = reposo.map((m) => m.clone().premultiply(ESPEJO).multiply(ESPEJO).invert());
    this.malla = new THREE.SkinnedMesh(geos.derecha, material);
    this.malla.name = 'Guante';
    this.malla.frustumCulled = false;
    this.malla.matrixAutoUpdate = false;
    this.malla.bindMode = THREE.DetachedBindMode;
    this.esqueleto = new THREE.Skeleton(this.huesos, this._inversaDer.map((m) => m.clone()));
    this.malla.bind(this.esqueleto, new THREE.Matrix4());
    this.malla.visible = false;
    this.izquierda = false;
    this.presurizado = false;
  }

  /** Cambia de lado o de guante si hace falta. */
  usar(izquierda, presurizado) {
    if (izquierda === this.izquierda && presurizado === this.presurizado) return;
    this.izquierda = izquierda;
    this.presurizado = presurizado;
    this.malla.geometry = izquierda ? (presurizado ? this.geos.izquierdaP : this.geos.izquierda) : (presurizado ? this.geos.derechaP : this.geos.derecha);
    const inv = izquierda ? this._inversaIzq : this._inversaDer;
    this.esqueleto.boneInverses.forEach((m, i) => m.copy(inv[i]));
  }
}
