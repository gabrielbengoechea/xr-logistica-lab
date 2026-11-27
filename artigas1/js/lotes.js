// Lotes de dibujo de los objetos sueltos: todos los flotantes que comparten material se dibujan en UNA llamada
// (THREE.BatchedMesh), en lugar de una llamada por objeto.
//
// Antes, cada herramienta y cada objeto suelto era una llamada de dibujo: con 43 objetos, el taller de
// Tacuarembó llegaba a 72 llamadas (el límite recomendado para el Quest 2 es 100, y en el visor se dibuja dos
// veces, una por ojo). Ahora hay un lote por material (la paleta del kit y el color por vértice de las
// herramientas).
//
// La lógica no cambia: cada flotante sigue teniendo su malla (posición, giro, hijos como pantallas, haz de la
// linterna, correa y trinquete), pero esa malla ya no se dibuja (material invisible); su forma la dibuja el lote
// con la misma matriz, cada cuadro. Si la malla está oculta o lejos, la instancia del lote también.
import * as THREE from 'three';

/** Material de las mallas que dibuja un lote: no se dibujan, pero sus hijos sí. */
const INVISIBLE = new THREE.MeshBasicMaterial({ visible: false });
INVISIBLE.name = 'Dibujada_en_lote';

/** Firma de los atributos: un lote solo admite geometrías con los mismos atributos. */
function firma(geo) {
  return Object.keys(geo.attributes).sort().join(',');
}

function conIndice(geo) {
  if (geo.index) return geo;
  const g = geo.clone();
  const n = g.attributes.position.count;
  g.setIndex(Array.from({ length: n }, (_, i) => i));
  return g;
}

/** Visible de verdad: ella y todos sus padres. */
function visibleEnEscena(o) {
  for (let x = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}

export class LotesFlotantes {
  /** @param {THREE.Object3D} escena */
  constructor(escena) {
    this.escena = escena;
    /** @type {{lote: THREE.BatchedMesh, entradas: {f: object, id: number}[]}[]} */
    this.lotes = [];
    this.agrupados = 0;
  }

  /**
   * Arma los lotes con los flotantes que se pueden agrupar (una sola malla con un solo material). Los que no se
   * pueden (material en arreglo, transparencias) quedan como estaban.
   * @param {object[]} flotantes
   */
  armar(flotantes) {
    const grupos = new Map();
    for (const f of flotantes) {
      const m = f.malla;
      if (!m.isMesh || Array.isArray(m.material) || m.material.transparent || !m.geometry.attributes.position) continue;
      const clave = `${m.material.uuid}|${firma(m.geometry)}`;
      if (!grupos.has(clave)) grupos.set(clave, { material: m.material, flotantes: [] });
      grupos.get(clave).flotantes.push(f);
    }
    for (const { material, flotantes: lista } of grupos.values()) {
      if (lista.length < 2) continue;                                     // uno solo no gana nada
      // geometrías distintas (dos lapiceras del kit comparten la misma)
      const geos = new Map();
      for (const f of lista) if (!geos.has(f.malla.geometry)) geos.set(f.malla.geometry, conIndice(f.malla.geometry));
      let vertices = 0, indices = 0;
      for (const g of geos.values()) { vertices += g.attributes.position.count; indices += g.index.count; }
      const lote = new THREE.BatchedMesh(lista.length, vertices, indices, material);
      lote.name = `Lote_Flotantes_${material.name || material.type}`;
      lote.perObjectFrustumCulled = true;
      lote.sortObjects = false;
      const ids = new Map();
      for (const [original, g] of geos) ids.set(original, lote.addGeometry(g));
      const entradas = [];
      for (const f of lista) {
        const id = lote.addInstance(ids.get(f.malla.geometry));
        f.malla.material = INVISIBLE;
        f.dibujoEnLote = true;
        entradas.push({ f, id });
      }
      this.escena.add(lote);
      this.lotes.push({ lote, entradas });
      this.agrupados += lista.length;
    }
    this.actualizar();
  }

  /** Cada cuadro, después de mover los flotantes: copia la matriz y la visibilidad de cada malla. */
  actualizar() {
    for (const { lote, entradas } of this.lotes) {
      for (const { f, id } of entradas) {
        const visible = visibleEnEscena(f.malla);
        lote.setVisibleAt(id, visible);
        if (!visible) continue;
        f.malla.updateWorldMatrix(true, false);
        lote.setMatrixAt(id, f.malla.matrixWorld);
      }
    }
  }
}
