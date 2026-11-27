// Sistema de colisiones de la estación: sopa de triángulos estáticos en una grilla espacial uniforme.
// Las consultas (esfera contra triángulos, punto más cercano) no asignan memoria por cuadro.
// La geometría de colisión es independiente de la visual: mallas simples para la estructura y cajas
// de 12 triángulos para la carga y el equipamiento chico.
import * as THREE from 'three';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();

// Resultado de puntoMasCercanoEnTriangulo (se reutiliza).
const cercano = { x: 0, y: 0, z: 0 };

/**
 * Punto del triángulo (a, b, c) más cercano a p. Algoritmo de regiones de Voronoi (Ericson,
 * Real-Time Collision Detection, 5.1.5), con escalares para no crear objetos.
 */
export function puntoMasCercanoEnTriangulo(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz, out = cercano) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { out.x = ax; out.y = ay; out.z = az; return out; }
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { out.x = bx; out.y = by; out.z = bz; return out; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    out.x = ax + abx * v; out.y = ay + aby * v; out.z = az + abz * v; return out;
  }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { out.x = cx; out.y = cy; out.z = cz; return out; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    out.x = ax + acx * w; out.y = ay + acy * w; out.z = az + acz * w; return out;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    out.x = bx + (cx - bx) * w; out.y = by + (cy - by) * w; out.z = bz + (cz - bz) * w; return out;
  }
  const den = 1 / (va + vb + vc);
  const v = vb * den;
  const w = vc * den;
  out.x = ax + abx * v + acx * w; out.y = ay + aby * v + acy * w; out.z = az + abz * v + acz * w;
  return out;
}

const MAX_CONTACTOS = 4;

export class SistemaColisiones {
  /** @param {number} celda Lado de la celda de la grilla, en metros. */
  constructor(celda = 0.5) {
    this.celda = celda;
    this._tris = [];            // se llena con agregar*; construir() lo pasa a Float32Array
    this.triangulos = null;     // Float32Array, 9 números por triángulo
    this.normales = null;       // Float32Array, 3 por triángulo
    this.grilla = new Map();    // clave de celda -> Int32Array de índices de triángulo
    this._marca = null;         // Uint32Array: evita probar dos veces el mismo triángulo en una consulta
    this._consulta = 0;
    this.activo = true;
    // resultado de resolverEsfera
    this.contactos = 0;
    this.normalesContacto = [];
    for (let i = 0; i < MAX_CONTACTOS; i++) this.normalesContacto.push(new THREE.Vector3());
  }

  get cantidad() { return this.triangulos ? this.triangulos.length / 9 : this._tris.length / 9; }

  /** Agrega todos los triángulos de una geometría, llevados al mundo con la matriz. */
  agregarMalla(geometria, matrizMundo) {
    const pos = geometria.getAttribute('position');
    const idx = geometria.getIndex();
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i;
      const i1 = idx ? idx.getX(i + 1) : i + 1;
      const i2 = idx ? idx.getX(i + 2) : i + 2;
      _a.fromBufferAttribute(pos, i0).applyMatrix4(matrizMundo);
      _b.fromBufferAttribute(pos, i1).applyMatrix4(matrizMundo);
      _c.fromBufferAttribute(pos, i2).applyMatrix4(matrizMundo);
      this._tris.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
    }
  }

  /** Agrega una caja (Box3 en espacio local) como 12 triángulos: el collider simple de la carga. */
  agregarCaja(caja, matrizMundo) {
    const { min, max } = caja;
    const v = [];
    for (let i = 0; i < 8; i++) {
      _p.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).applyMatrix4(matrizMundo);
      v.push(_p.x, _p.y, _p.z);
    }
    const caras = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
    for (const i of caras) this._tris.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
  }

  _clave(ix, iy, iz) { return (ix + 512) * 1048576 + (iy + 512) * 1024 + (iz + 512); }

  /** Arma la grilla. Se llama una vez, después de agregar toda la geometría. */
  construir() {
    const t = new Float32Array(this._tris);
    this._tris = [];
    const n = t.length / 9;
    this.triangulos = t;
    this.normales = new Float32Array(n * 3);
    this._marca = new Uint32Array(n);
    const listas = new Map();
    const inv = 1 / this.celda;
    for (let i = 0; i < n; i++) {
      const o = i * 9;
      _a.set(t[o], t[o + 1], t[o + 2]);
      _b.set(t[o + 3], t[o + 4], t[o + 5]);
      _c.set(t[o + 6], t[o + 7], t[o + 8]);
      _p.subVectors(_b, _a).cross(_q.subVectors(_c, _a)).normalize();
      this.normales[i * 3] = _p.x; this.normales[i * 3 + 1] = _p.y; this.normales[i * 3 + 2] = _p.z;
      const x0 = Math.floor(Math.min(_a.x, _b.x, _c.x) * inv), x1 = Math.floor(Math.max(_a.x, _b.x, _c.x) * inv);
      const y0 = Math.floor(Math.min(_a.y, _b.y, _c.y) * inv), y1 = Math.floor(Math.max(_a.y, _b.y, _c.y) * inv);
      const z0 = Math.floor(Math.min(_a.z, _b.z, _c.z) * inv), z1 = Math.floor(Math.max(_a.z, _b.z, _c.z) * inv);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const k = this._clave(x, y, z);
        let l = listas.get(k);
        if (!l) { l = []; listas.set(k, l); }
        l.push(i);
      }
    }
    this.grilla.clear();
    for (const [k, l] of listas) this.grilla.set(k, Int32Array.from(l));
    return this;
  }

  /**
   * Saca una esfera de adentro de la geometría. Modifica `centro`. Deja en `this.contactos` y
   * `this.normalesContacto` las normales de los contactos (hacia afuera de la superficie).
   * Itera corrigiendo cada vez la penetración más profunda, que es estable en esquinas.
   * @returns {boolean} true si hubo contacto.
   */
  resolverEsfera(centro, radio, iteraciones = 4) {
    this.contactos = 0;
    if (!this.activo || !this.triangulos) return false;
    const t = this.triangulos;
    const inv = 1 / this.celda;
    for (let it = 0; it < iteraciones; it++) {
      const q = ++this._consulta;
      let peor = 0, nx = 0, ny = 0, nz = 0;
      const x0 = Math.floor((centro.x - radio) * inv), x1 = Math.floor((centro.x + radio) * inv);
      const y0 = Math.floor((centro.y - radio) * inv), y1 = Math.floor((centro.y + radio) * inv);
      const z0 = Math.floor((centro.z - radio) * inv), z1 = Math.floor((centro.z + radio) * inv);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const lista = this.grilla.get(this._clave(x, y, z));
        if (!lista) continue;
        for (let k = 0; k < lista.length; k++) {
          const i = lista[k];
          if (this._marca[i] === q) continue;
          this._marca[i] = q;
          const o = i * 9;
          puntoMasCercanoEnTriangulo(centro.x, centro.y, centro.z, t[o], t[o + 1], t[o + 2], t[o + 3], t[o + 4], t[o + 5], t[o + 6], t[o + 7], t[o + 8]);
          const dx = centro.x - cercano.x, dy = centro.y - cercano.y, dz = centro.z - cercano.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= radio * radio) continue;
          const d = Math.sqrt(d2);
          const pen = radio - d;
          if (pen > peor) {
            peor = pen;
            if (d > 1e-6) { nx = dx / d; ny = dy / d; nz = dz / d; }
            else { nx = this.normales[i * 3]; ny = this.normales[i * 3 + 1]; nz = this.normales[i * 3 + 2]; }
          }
        }
      }
      if (peor <= 1e-5) break;
      centro.x += nx * peor; centro.y += ny * peor; centro.z += nz * peor;
      if (this.contactos < MAX_CONTACTOS) this.normalesContacto[this.contactos++].set(nx, ny, nz);
    }
    return this.contactos > 0;
  }

  /**
   * Punto de la geometría más cercano a `p` dentro de `maxDist`. Sirve para que la mano se apoye en una
   * pared y el astronauta se impulse. Deja el punto en `outPunto`.
   * @returns {number} la distancia, o Infinity si no hay nada cerca.
   */
  puntoMasCercano(p, maxDist, outPunto) {
    if (!this.activo || !this.triangulos) return Infinity;
    const t = this.triangulos;
    const inv = 1 / this.celda;
    const q = ++this._consulta;
    let mejor = maxDist * maxDist;
    let hay = false;
    const x0 = Math.floor((p.x - maxDist) * inv), x1 = Math.floor((p.x + maxDist) * inv);
    const y0 = Math.floor((p.y - maxDist) * inv), y1 = Math.floor((p.y + maxDist) * inv);
    const z0 = Math.floor((p.z - maxDist) * inv), z1 = Math.floor((p.z + maxDist) * inv);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const lista = this.grilla.get(this._clave(x, y, z));
      if (!lista) continue;
      for (let k = 0; k < lista.length; k++) {
        const i = lista[k];
        if (this._marca[i] === q) continue;
        this._marca[i] = q;
        const o = i * 9;
        puntoMasCercanoEnTriangulo(p.x, p.y, p.z, t[o], t[o + 1], t[o + 2], t[o + 3], t[o + 4], t[o + 5], t[o + 6], t[o + 7], t[o + 8]);
        const dx = p.x - cercano.x, dy = p.y - cercano.y, dz = p.z - cercano.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < mejor) { mejor = d2; hay = true; outPunto.set(cercano.x, cercano.y, cercano.z); }
      }
    }
    return hay ? Math.sqrt(mejor) : Infinity;
  }
}
