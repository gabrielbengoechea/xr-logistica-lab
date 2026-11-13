// Inventario de la estación: los bultos de los racks y del carguero, los huecos del almacén Rivera y los
// contenedores sueltos que se pueden mover. Es la lógica que usan el escáner, la tablet y las actividades.
// No dibuja nada: recibe las matrices de las bolsas (js/estacion.js) y los datos de sus etiquetas.
import * as THREE from 'three';

const COLUMNAS_Y = [-0.73, -0.26, 0.20, 0.67];
const RACKS_Z = [-0.525, -1.575, -2.625, -3.675];
const DESCRIPCIONES = ['Filtros HEPA de repuesto', 'Kit de sensores UTEC', 'Raciones de emergencia', 'Baterías de herramientas', 'Insumos de laboratorio', 'Repuestos de ventilación'];

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Corte de un rayo con una caja alineada a los ejes centrada en `c` de semilados `h`. Devuelve t o Infinity. */
export function rayoCaja(o, d, c, h) {
  let t0 = 0;
  let t1 = Infinity;
  for (const e of ['x', 'y', 'z']) {
    const origen = o[e] - c[e];
    if (Math.abs(d[e]) < 1e-9) {
      if (Math.abs(origen) > h[e]) return Infinity;
      continue;
    }
    let a = (-h[e] - origen) / d[e];
    let b = (h[e] - origen) / d[e];
    if (a > b) { const x = a; a = b; b = x; }
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

export class Inventario {
  /**
   * @param {{nombre: string, matriz: THREE.Matrix4, legible: boolean, centro: THREE.Vector3, mitad: THREE.Vector3}[]} cargas
   * @param {{codigo: string, descripcion: string, categoria: number, pesoKg: number, ubicacion: string}[]} etiquetas
   *        Datos de las etiquetas de las cargas legibles, en el mismo orden.
   * @param {{nombre: string}[]} categorias
   */
  constructor(cargas, etiquetas, categorias) {
    /** Bultos fijos (bolsas de los racks y del carguero). */
    this.bultos = [];
    let k = 0;
    for (const c of cargas) {
      const e = c.legible ? etiquetas[k++] : null;
      this.bultos.push({
        nombre: c.nombre, legible: c.legible && !!e,
        codigo: e ? e.codigo : '', descripcion: e ? e.descripcion : 'Bulto sin identificar', categoria: e ? categorias[e.categoria].nombre : '—',
        pesoKg: e ? e.pesoKg : 0, ubicacion: e ? e.ubicacion : 'CARGUERO',
        modulo: c.nombre[0], inversa: c.matriz.clone().invert(), centroLocal: c.centro, mitad: c.mitad,
        centro: c.centro.clone().applyMatrix4(c.matriz), escaneado: false,
      });
    }
    this.porCodigo = new Map(this.bultos.filter((b) => b.legible).map((b) => [b.codigo, b]));
    /** Huecos de los racks de babor (B) y estribor (E) de Rivera. */
    this.huecos = [];
    const ocupados = new Set(this.bultos.map((b) => b.ubicacion));
    for (const pared of ['B', 'E']) {
      const signo = pared === 'B' ? -1 : 1;
      const giro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -signo * Math.PI / 2);
      for (let r = 0; r < 4; r++) for (const fila of ['A', 'B']) for (let col = 0; col < 4; col++) {
        const dz = (fila === 'A' ? 0.255 : -0.255) * -signo;
        const codigo = `RIV-${pared}${r + 1}-${fila}${col + 1}`;
        this.huecos.push({
          codigo, posicion: new THREE.Vector3(signo * 1.33, COLUMNAS_Y[col], RACKS_Z[r] + dz), giro,
          ocupado: ocupados.has(codigo), contenedor: null,
        });
      }
    }
    /** Contenedores sueltos (objetos de js/flotantes.js con datos de inventario). */
    this.contenedores = [];
  }

  huecosLibres() {
    return this.huecos.filter((h) => !h.ocupado);
  }

  /** Le da código y hueco de destino a un contenedor suelto. */
  registrarContenedor(flotante) {
    const n = this.contenedores.length;
    const libres = this.huecosLibres().filter((h) => !this.contenedores.some((c) => c.datos.destino === h.codigo));
    const destino = libres[(n * 5 + 2) % Math.max(1, libres.length)];
    flotante.datos = {
      codigo: `CNT-${String(n + 1).padStart(4, '0')}`, descripcion: DESCRIPCIONES[n % DESCRIPCIONES.length], categoria: 'CONTENEDOR',
      pesoKg: 2.5 + n * 1.3, destino: destino ? destino.codigo : '', hueco: null, escaneado: false,
    };
    this.contenedores.push(flotante);
    return flotante.datos;
  }

  ubicacionDe(flotante) {
    return flotante.datos.hueco ? flotante.datos.hueco.codigo : 'EN TRÁNSITO';
  }

  /**
   * Qué ve el lector: el primer bulto o contenedor que corta el rayo dentro del alcance.
   * @returns {{tipo: 'bulto'|'contenedor', bulto?: object, contenedor?: object, frente: boolean, distancia: number}|null}
   */
  apuntar(origen, direccion, alcance) {
    let mejor = null;
    let tMejor = alcance;
    for (const b of this.bultos) {
      if (b.centro.distanceToSquared(origen) > (alcance + 0.6) * (alcance + 0.6)) continue;
      _o.copy(origen).applyMatrix4(b.inversa);
      _d.copy(direccion).transformDirection(b.inversa);
      const t = rayoCaja(_o, _d, b.centroLocal, b.mitad);
      if (t >= tMejor) continue;
      _p.copy(_o).addScaledVector(_d, t);
      // la etiqueta está en el frente de la bolsa (+Z local)
      tMejor = t;
      mejor = { tipo: 'bulto', bulto: b, frente: _p.z > b.centroLocal.z + b.mitad.z - 0.03, distancia: t };
    }
    for (const f of this.contenedores) {
      // esfera: el contenedor gira y se mueve
      _p.subVectors(f.posicion, origen);
      const a = _p.dot(direccion);
      if (a < 0) continue;
      const d2 = _p.lengthSq() - a * a;
      const r = f.radio * 1.1;
      if (d2 > r * r) continue;
      const t = a - Math.sqrt(r * r - d2);
      if (t < tMejor) { tMejor = t; mejor = { tipo: 'contenedor', contenedor: f, frente: true, distancia: Math.max(0, t) }; }
    }
    return mejor;
  }

  /** Hueco libre más cercano a `posicion` dentro de `maximo` metros. */
  huecoCercano(posicion, maximo) {
    let mejor = null;
    let d2Mejor = maximo * maximo;
    for (const h of this.huecos) {
      if (h.ocupado) continue;
      const d2 = h.posicion.distanceToSquared(posicion);
      if (d2 < d2Mejor) { d2Mejor = d2; mejor = h; }
    }
    return mejor;
  }

  /** Deja el contenedor asegurado en el hueco. Devuelve si era su destino. */
  colocar(flotante, hueco) {
    hueco.ocupado = true;
    hueco.contenedor = flotante;
    flotante.datos.hueco = hueco;
    return flotante.datos.destino === hueco.codigo;
  }

  retirar(flotante) {
    const h = flotante.datos && flotante.datos.hueco;
    if (!h) return;
    h.ocupado = false;
    h.contenedor = null;
    flotante.datos.hueco = null;
  }

  /** Filas para la tablet: bultos legibles y contenedores, con su ubicación actual. */
  listado() {
    const filas = this.bultos.filter((b) => b.legible).map((b) => ({ codigo: b.codigo, descripcion: b.descripcion, ubicacion: b.ubicacion, escaneado: b.escaneado }));
    for (const f of this.contenedores) filas.push({ codigo: f.datos.codigo, descripcion: f.datos.descripcion, ubicacion: this.ubicacionDe(f), escaneado: f.datos.escaneado });
    return filas;
  }
}
