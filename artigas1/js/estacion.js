// Estructura de la estación: carga el GLB, clasifica cada pieza y arma lo que el resto necesita.
//  - Visual: fusiona las mallas estáticas por módulo y material (de cientos de objetos a unas pocas
//    llamadas de dibujo, conservando el descarte por módulo fuera de cámara).
//  - Colisión: mallas para la estructura, cajas para la carga y el equipamiento; nada para carteles.
//  - Interacción: barandas (segmentos), escotillas (puertas corredizas), bolsas (para las etiquetas) y
//    objetos sueltos (mallas propias, para js/flotantes.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SistemaColisiones } from './colisiones.js';
import { Barandas } from './barandas.js';

const ES_PUERTA = /^[A-Z]_Escotilla_/;
const PUERTA_FIJA = /Acople2/;                            // puerto de acople sin módulo: queda cerrado
const ES_BARANDA = /Baranda/;
const ES_CARGA = /^(R_Demo|C_Carga)_/;
const ES_FLOTANTE = /_Flot_/;                             // objetos sueltos: los anima js/flotantes.js
const SIN_COLISION = /_Det_|Cartel|Placa_|Etiqueta|Pantalla|Marca_|Esfera_Reloj|Correas_|Aguja|Tablet|Esfera_Agua/;
const CON_MALLA = /Casco|Rack|Bahia|Anillo|Banco|Red_Cuarentena|Portal|Vidrios/;  // el resto: caja
const RECORRIDO_PUERTA = 1.25;                            // m que corre la escotilla hacia su alojamiento
const _v = new THREE.Vector3();

function moduloDe(nombre) {
  const m = /^([A-Z])_/.exec(nombre);
  return m ? m[1] : 'X';
}

/** Geometría en el mundo, sin índice y solo con posición, normal y uv: lista para fusionar. */
function geometriaMundo(malla) {
  let g = malla.geometry.index ? malla.geometry.toNonIndexed() : malla.geometry.clone();
  for (const nombre of Object.keys(g.attributes)) {
    if (nombre !== 'position' && nombre !== 'normal' && nombre !== 'uv') g.deleteAttribute(nombre);
  }
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  g.applyMatrix4(malla.matrixWorld);
  if (malla.matrixWorld.determinant() < 0) {              // matriz espejada: se invierte el sentido de las caras
    for (const nombre of ['position', 'normal', 'uv']) {
      const a = g.getAttribute(nombre);
      const n = a.itemSize;
      for (let i = 0; i < a.count; i += 3) {
        for (let k = 0; k < n; k++) {
          const t = a.array[(i + 1) * n + k];
          a.array[(i + 1) * n + k] = a.array[(i + 2) * n + k];
          a.array[(i + 2) * n + k] = t;
        }
      }
    }
  }
  return g;
}

/** Escotilla corrediza: se abre sola cuando el astronauta se acerca y vuelve a ser sólida al cerrarse. */
class Escotilla {
  constructor(malla) {
    this.malla = malla;
    this.cerrada = malla.position.clone();
    this.abierta = malla.position.clone().add(_v.set(-RECORRIDO_PUERTA, 0, 0).applyQuaternion(malla.quaternion));
    malla.geometry.computeBoundingBox();
    this.centro = malla.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(malla.matrixWorld);
    this.colision = new SistemaColisiones(0.5);
    this.colision.agregarCaja(malla.geometry.boundingBox, malla.matrixWorld);
    this.colision.construir();
    this.avance = 0;                                      // 0 cerrada, 1 abierta
  }

  actualizar(dt, cabeza) {
    const d = this.centro.distanceTo(cabeza);
    const meta = d < 1.7 ? 1 : d > 2.3 ? 0 : this.avance > 0.5 ? 1 : 0;
    if (meta === this.avance) return;
    this.avance = THREE.MathUtils.clamp(this.avance + Math.sign(meta - this.avance) * dt / 0.9, 0, 1);
    const k = this.avance * this.avance * (3 - 2 * this.avance);
    this.malla.position.lerpVectors(this.cerrada, this.abierta, k);
    this.colision.activo = this.avance < 0.6;
  }
}

/**
 * @param {object} gltf                     Resultado de GLTFLoader.
 * @param {(material: THREE.Material, uso: string) => THREE.Material} materialPara
 * @returns {{grupo: THREE.Group, colisiones: SistemaColisiones, barandas: Barandas, escotillas: Escotilla[],
 *            cargas: {nombre: string, matriz: THREE.Matrix4, grande: boolean, legible: boolean, centro: THREE.Vector3, mitad: THREE.Vector3}[], flotantes: THREE.Mesh[],
 *            resumen: object}}
 */
export function armarEstacion(gltf, materialPara) {
  gltf.scene.updateMatrixWorld(true);
  const grupo = new THREE.Group();
  grupo.name = 'Estacion_Artigas1';
  const colisiones = new SistemaColisiones(0.5);
  const barandas = new Barandas();
  const escotillas = [];
  const cargas = [];
  const flotantes = [];
  const centrados = new Map();      // geometría original -> { geometria centrada, centro, radio }
  const lotes = new Map();           // "modulo|material" -> { material, geometrias }
  const mallas = [];
  gltf.scene.traverse((o) => { if (o.isMesh) mallas.push(o); });

  for (const o of mallas) {
    const nombre = o.name || o.parent?.name || '';
    if (ES_PUERTA.test(nombre) && !PUERTA_FIJA.test(nombre)) {
      const puerta = new THREE.Mesh(o.geometry, materialPara(o.material, 'general'));
      puerta.name = nombre;
      o.matrixWorld.decompose(puerta.position, puerta.quaternion, puerta.scale);
      puerta.updateMatrixWorld(true);
      grupo.add(puerta);
      escotillas.push(new Escotilla(puerta));
      continue;
    }
    if (ES_FLOTANTE.test(nombre)) {
      // objeto suelto: malla propia con el origen en su centro (gira sobre sí mismo) y sin colisión estática
      let c = centrados.get(o.geometry);
      if (!c) {
        const g = o.geometry.clone();
        g.computeBoundingBox();
        const centro = g.boundingBox.getCenter(new THREE.Vector3());
        g.translate(-centro.x, -centro.y, -centro.z);
        g.computeBoundingSphere();
        c = { geometria: g, centro, radio: THREE.MathUtils.clamp(g.boundingSphere.radius * 0.72, 0.03, 0.22) };
        centrados.set(o.geometry, c);
      }
      const suelto = new THREE.Mesh(c.geometria, materialPara(o.material, 'general'));
      suelto.name = nombre;
      o.matrixWorld.decompose(suelto.position, suelto.quaternion, suelto.scale);
      suelto.position.copy(c.centro).applyMatrix4(o.matrixWorld);
      suelto.userData.radio = c.radio;
      grupo.add(suelto);
      flotantes.push(suelto);
      continue;
    }
    // --- colisión
    if (ES_BARANDA.test(nombre)) {
      barandas.agregar(o);                                // capa propia: las manos las toman, el cuerpo no choca
    } else if (!SIN_COLISION.test(nombre)) {
      if (CON_MALLA.test(nombre) && !ES_CARGA.test(nombre)) {
        colisiones.agregarMalla(o.geometry, o.matrixWorld);
      } else {
        o.geometry.computeBoundingBox();
        colisiones.agregarCaja(o.geometry.boundingBox, o.matrixWorld);
      }
    }
    if (ES_CARGA.test(nombre)) {
      // las bolsas dañadas y sin etiqueta (discrepancias del carguero) no llevan etiqueta legible
      o.geometry.computeBoundingBox();
      const caja = o.geometry.boundingBox;
      cargas.push({
        nombre, matriz: o.matrixWorld.clone(), grande: caja.max.y - caja.min.y > 0.4, legible: !/SinEtiqueta|Danada/.test(nombre),
        centro: caja.getCenter(new THREE.Vector3()), mitad: caja.getSize(new THREE.Vector3()).multiplyScalar(0.5),
      });
    }
    // --- visual: al lote de su módulo y material
    const modulo = moduloDe(nombre);
    const uso = modulo === 'F' ? 'cupula' : /Casco|Anillo/.test(nombre) ? 'estructura' : 'general';
    const material = materialPara(o.material, uso);
    const clave = `${modulo}|${material.uuid}`;
    let lote = lotes.get(clave);
    if (!lote) { lote = { modulo, material, geometrias: [] }; lotes.set(clave, lote); }
    lote.geometrias.push(geometriaMundo(o));
  }

  for (const lote of lotes.values()) {
    const g = mergeGeometries(lote.geometrias, false);
    for (const parte of lote.geometrias) parte.dispose();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, lote.material);
    m.name = `Lote_${lote.modulo}_${lote.material.name}`;
    m.matrixAutoUpdate = false;                           // la estación no se mueve
    if (lote.material.transparent) m.renderOrder = 2;     // el vidrio se dibuja después de la Tierra
    grupo.add(m);
  }
  // el GLB original ya no hace falta: se liberan sus geometrías (las texturas siguen en uso)
  for (const o of mallas) if (!escotillas.some((e) => e.malla.geometry === o.geometry)) o.geometry.dispose();

  colisiones.construir();
  return {
    grupo, colisiones, barandas, escotillas, cargas, flotantes,
    resumen: { flotantes: flotantes.length, objetosOriginales: mallas.length, lotes: lotes.size, triangulosColision: colisiones.cantidad, barandas: barandas.segmentos.length, escotillas: escotillas.length },
  };
}
