// Puntos de inspección y mantenimiento. Cada punto pide una herramienta: hay que tenerla en la mano, apuntarla
// (o apoyarla, según la herramienta) y mantener el gatillo de esa mano hasta completar el trabajo.
// Lo usan la actividad de mantenimiento del taller y las tareas de la caminata espacial.
import * as THREE from 'three';

/** Herramientas que trabajan a distancia (apuntando) y su alcance; el resto trabaja apoyando la punta. */
const A_DISTANCIA = { linterna: 1.2, inspector: 1.4, escaner: 1.4 };
const CONTACTO = 0.17;
const COS_APUNTAR = Math.cos(THREE.MathUtils.degToRad(15));
export const NOMBRE_HERRAMIENTA = { linterna: 'la linterna', inspector: 'el inspector', llave: 'la llave', destornillador: 'el destornillador', medidor: 'el medidor' };

const _t = new THREE.Vector3();
const _d = new THREE.Vector3();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const PENDIENTE = new THREE.Color(0xfcd116);
const LISTO = new THREE.Color(0x3ecf6e);

export class Inspecciones {
  /** @param {THREE.Scene} escena @param {(tipo: string, datos: object) => void} avisar */
  constructor(escena, avisar) {
    this.avisar = avisar;
    /** @type {{id: string, posicion: THREE.Vector3, herramienta: string, segundos: number, texto: string, activo: boolean, avance: number, hecho: boolean}[]} */
    this.puntos = [];
    this.marcas = new THREE.InstancedMesh(new THREE.TorusGeometry(0.075, 0.009, 6, 20), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthTest: false }), 12);
    this.marcas.name = 'Marcas_Inspeccion';
    this.marcas.frustumCulled = false;
    this.marcas.renderOrder = 5;
    this.marcas.count = 0;
    escena.add(this.marcas);
    this._tiempo = 0;
    this._quejas = new WeakMap();
  }

  agregar(id, posicion, herramienta, segundos, texto) {
    this.puntos.push({ id, posicion: posicion.clone(), herramienta, segundos, texto, activo: false, avance: 0, hecho: false });
  }

  /** Enciende solo estos puntos (los de la actividad en curso) y los deja en cero. */
  activar(ids) {
    for (const p of this.puntos) {
      p.activo = ids.includes(p.id);
      p.avance = 0;
      p.hecho = false;
    }
  }

  punto(id) { return this.puntos.find((p) => p.id === id) || null; }

  /** ¿La herramienta que lleva esa mano está trabajando sobre el punto? */
  _trabaja(mano, p) {
    const f = mano.sostiene;
    if (!f || !f.agarre || !f.agarre.punta) return false;
    f.malla.updateWorldMatrix(true, false);
    _t.copy(f.agarre.punta).applyMatrix4(f.malla.matrixWorld);
    _v.subVectors(p.posicion, _t);
    const d = _v.length();
    const alcance = A_DISTANCIA[f.tipo];
    if (!alcance) return d < CONTACTO;
    if (d > alcance) return false;
    if (d < 0.12) return true;
    _d.copy(f.agarre.direccion).transformDirection(f.malla.matrixWorld);
    return _v.multiplyScalar(1 / d).dot(_d) > COS_APUNTAR;
  }

  /** @param {number} dt @param {object[]} manos @param {THREE.Camera} camara */
  actualizar(dt, manos, camara) {
    this._tiempo += dt;
    let n = 0;
    camara.getWorldQuaternion(_q);
    for (const p of this.puntos) {
      if (!p.activo) continue;
      let trabajando = false;
      if (!p.hecho) {
        for (const m of manos) {
          if (!m.sostiene || m.gatillo < 0.5 || !this._trabaja(m, p)) continue;
          if (m.sostiene.tipo === p.herramienta) {
            trabajando = true;
          } else if (m.gatilloNuevo && this._quejas.get(m) !== p.id) {
            this._quejas.set(m, p.id);
            this.avisar('herramienta_incorrecta', { punto: p.id, herramienta: m.sostiene.tipo, pide: p.herramienta });
          }
        }
        p.avance = trabajando ? Math.min(1, p.avance + dt / p.segundos) : Math.max(0, p.avance - dt * 0.5);
        if (p.avance >= 1) {
          p.hecho = true;
          this.avisar('inspeccion', { punto: p.id, herramienta: p.herramienta });
        }
      }
      const pulso = p.hecho ? 1 : 1 + 0.12 * Math.sin(this._tiempo * 4) + p.avance * 0.5;
      _m.compose(p.posicion, _q, _s.setScalar(pulso));
      this.marcas.setMatrixAt(n, _m);
      this.marcas.setColorAt(n, _c.copy(PENDIENTE).lerp(LISTO, p.hecho ? 1 : p.avance));
      n++;
    }
    this.marcas.count = n;
    if (n) {
      this.marcas.instanceMatrix.needsUpdate = true;
      if (this.marcas.instanceColor) this.marcas.instanceColor.needsUpdate = true;
    }
  }
}
