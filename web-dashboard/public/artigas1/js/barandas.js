// Barandas (handrails): capa de interacción independiente de las colisiones del cuerpo.
// Cada baranda es un segmento; las manos las detectan por cercanía y nunca chocan contra ellas.
import * as THREE from 'three';

const _ab = new THREE.Vector3();
const _ap = new THREE.Vector3();
const _q = new THREE.Vector3();

export class Barandas {
  constructor() {
    /** @type {{a: THREE.Vector3, b: THREE.Vector3, nombre: string}[]} */
    this.segmentos = [];
  }

  /**
   * Registra una baranda a partir de su malla. El caño corre a lo largo del eje X local, a 6,4 cm de la
   * cara de montaje (eje Y local en glTF), como lo genera props.py del kit de Blender.
   */
  agregar(malla) {
    malla.geometry.computeBoundingBox();
    const caja = malla.geometry.boundingBox;
    const a = new THREE.Vector3(caja.min.x + 0.03, 0.064, 0).applyMatrix4(malla.matrixWorld);
    const b = new THREE.Vector3(caja.max.x - 0.03, 0.064, 0).applyMatrix4(malla.matrixWorld);
    this.segmentos.push({ a, b, nombre: malla.name });
  }

  /**
   * Punto de baranda más cercano a `p` dentro de `maxDist`. Deja el punto en `outPunto`.
   * @returns {number} distancia o Infinity.
   */
  masCercana(p, maxDist, outPunto) {
    let mejor = maxDist * maxDist;
    let hay = false;
    for (let i = 0; i < this.segmentos.length; i++) {
      const s = this.segmentos[i];
      _ab.subVectors(s.b, s.a);
      _ap.subVectors(p, s.a);
      const t = THREE.MathUtils.clamp(_ap.dot(_ab) / _ab.lengthSq(), 0, 1);
      _q.copy(s.a).addScaledVector(_ab, t);
      const d2 = _q.distanceToSquared(p);
      if (d2 < mejor) { mejor = d2; hay = true; outPunto.copy(_q); }
    }
    return hay ? Math.sqrt(mejor) : Infinity;
  }
}
