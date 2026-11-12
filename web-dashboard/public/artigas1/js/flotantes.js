// Objetos sueltos en microgravedad: herramientas, portapapeles, guantes, paquetes.
//
// No usa un motor de física. Cada objeto es una esfera con posición, velocidad y giro propios:
//  - deriva lenta e inercial, con un arrastre mínimo (el aire de la cabina) y una «brisa» errática de la
//    ventilación que evita que queden clavados en el aire como una foto;
//  - rebota contra la estación con el mismo sistema de colisiones que el astronauta;
//  - el cuerpo y las manos lo empujan; con el grip cerrado se lo toma y al soltarlo sale con la velocidad
//    de la mano;
//  - la ventilación lo aparta del eje de paso de los módulos y una «correa» blanda lo mantiene en su zona,
//    así que no tapa los pasillos ni se pierde en otro módulo. Un objeto lanzado queda libre hasta frenarse.
//
// Costo: una consulta de colisión por objeto cercano y por cuadro. Los que están a más de `distanciaActiva`
// de la cabeza no se calculan ni se dibujan.
import * as THREE from 'three';

export const PARAMETROS_FLOTANTES = {
  derivaInicial: 0.012,      // m/s: velocidad con la que arrancan
  giroMinimo: 0.06,          // rad/s
  giroMaximo: 0.32,          // rad/s
  arrastre: 0.10,            // 1/s: el aire frena de a poco lo que se mueve
  brisa: 0.0012,             // m/s²: aceleración errática de la ventilación
  restitucion: 0.5,          // rebote contra paredes y equipos
  radioPasillo: 0.42,        // m alrededor del eje de cada módulo que se mantiene despejado
  empujePasillo: 0.02,       // m/s² hacia afuera del pasillo
  correa: 0.45,              // m que un objeto puede alejarse de su zona sin que nada lo traiga
  fuerzaCorrea: 0.03,        // 1/s²: aceleración por metro de exceso
  velocidadReposo: 0.03,     // m/s: por debajo, un objeto lanzado vuelve a tener zona propia
  velocidadMaxima: 2.5,      // m/s
  alcanceMano: 0.10,         // m desde la superficie del objeto a la que la mano lo toma
  radioMano: 0.06,           // m: la mano abierta empuja como una esfera
  distanciaActiva: 7.0,      // m: más lejos de la cabeza no se calcula ni se dibuja
};

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

/** Punto del segmento ab más cercano a p (en `out`). */
function cercanoEnSegmento(p, a, b, out) {
  _v.subVectors(b, a);
  const t = THREE.MathUtils.clamp(_p.subVectors(p, a).dot(_v) / Math.max(_v.lengthSq(), 1e-9), 0, 1);
  return out.copy(a).addScaledVector(_v, t);
}

export class Flotante {
  /** @param {THREE.Object3D} malla Objeto con el origen en su centro. @param {number} radio @param {() => number} azar */
  constructor(malla, radio, azar) {
    this.malla = malla;
    this.posicion = malla.position;
    this.radio = radio;
    this.velocidad = new THREE.Vector3(azar() - 0.5, azar() - 0.5, azar() - 0.5).normalize();
    this.giro = new THREE.Vector3(azar() - 0.5, azar() - 0.5, azar() - 0.5).normalize();   // eje por velocidad angular
    this.casa = malla.position.clone();
    this.libre = false;          // true mientras viaja después de que lo lanzaron o lo empujaron fuerte
    this.mano = null;            // la mano que lo sostiene
    this._fase = new THREE.Vector3(azar() * 6.28, azar() * 6.28, azar() * 6.28);
    this._local = new THREE.Vector3();
    this._qLocal = new THREE.Quaternion();
  }
}

export class SistemaFlotantes {
  /**
   * @param {object} o
   * @param {() => Iterable<import('./colisiones.js').SistemaColisiones>} o.colisionadores
   * @param {{a: THREE.Vector3, b: THREE.Vector3}[]} o.pasillos  Ejes de paso que tienen que quedar libres.
   * @param {number} [o.semilla]
   */
  constructor({ colisionadores, pasillos = [], parametros = PARAMETROS_FLOTANTES, semilla = 7 }) {
    this.colisionadores = colisionadores;
    this.pasillos = pasillos;
    this.p = parametros;
    /** @type {Flotante[]} */
    this.objetos = [];
    this.activos = 0;
    this._tiempo = 0;
    this._manos = new WeakMap();
    let s = semilla >>> 0;
    this._azar = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /** @param {THREE.Object3D} malla @param {number} radio */
  agregar(malla, radio) {
    const f = new Flotante(malla, radio, this._azar);
    f.velocidad.multiplyScalar(this.p.derivaInicial * (0.4 + 0.6 * this._azar()));
    f.giro.multiplyScalar(this.p.giroMinimo + (this.p.giroMaximo - this.p.giroMinimo) * this._azar());
    this.objetos.push(f);
    return f;
  }

  _masCercano(punto, alcance) {
    let mejor = null;
    let dMejor = Infinity;
    for (const f of this.objetos) {
      if (f.mano) continue;
      const d = f.posicion.distanceTo(punto) - f.radio;
      if (d < alcance && d < dMejor) { mejor = f; dMejor = d; }
    }
    return mejor;
  }

  /**
   * Tomar y soltar. Va antes de la locomoción: una mano que sostiene un objeto no se agarra de la estación.
   * Las barandas tienen prioridad: si hay una al alcance, la mano toma la baranda y no el objeto.
   * @param {number} dt
   * @param {{posicion: THREE.Vector3, cerrada: boolean, objeto?: THREE.Object3D, sostiene?: Flotante|null}[]} manos
   * @param {{masCercana: (p: THREE.Vector3, d: number, out: THREE.Vector3) => number}|null} barandas
   * @param {number} alcanceBaranda
   */
  gestionarManos(dt, manos, barandas = null, alcanceBaranda = 0.16) {
    for (const m of manos) {
      let e = this._manos.get(m);
      if (!e) {
        e = { previa: m.posicion.clone(), velocidad: new THREE.Vector3(), alSoltar: new THREE.Vector3(), yaCerrada: m.cerrada };
        this._manos.set(m, e);
      }
      // Al soltar se usa la velocidad filtrada hasta el cuadro anterior: en el cuadro en que se abre la mano
      // el control suele estar frenando, y eso le robaría impulso al lanzamiento.
      e.alSoltar.copy(e.velocidad);
      if (dt > 0) {
        _v.subVectors(m.posicion, e.previa).multiplyScalar(1 / dt);
        e.velocidad.lerp(_v, 0.5);                       // filtra el temblor de la mano
      }
      e.previa.copy(m.posicion);
      if (m.sostiene) {
        if (!m.cerrada) {
          const f = m.sostiene;
          f.velocidad.copy(e.alSoltar).clampLength(0, this.p.velocidadMaxima);
          f.mano = null;
          f.libre = true;
          m.sostiene = null;
        }
      } else {
        const f = this._masCercano(m.posicion, this.p.alcanceMano);
        m.cercaObjeto = !!f;
        const hayBaranda = barandas ? barandas.masCercana(m.posicion, alcanceBaranda, _p) !== Infinity : false;
        if (f && m.cerrada && !e.yaCerrada && !m.agarre && !hayBaranda) {
          f.mano = m;
          m.sostiene = f;
          m.nuevoAgarre = true;
          if (m.objeto) {
            m.objeto.updateWorldMatrix(true, false);
            _m.copy(m.objeto.matrixWorld).invert();
            f._local.copy(f.posicion).applyMatrix4(_m);
            m.objeto.getWorldQuaternion(_q);
            f._qLocal.copy(_q).invert().multiply(f.malla.quaternion);
          } else {
            f._local.subVectors(f.posicion, m.posicion);
          }
        }
      }
      e.yaCerrada = m.cerrada;
    }
  }

  /**
   * Avanza un cuadro. Va después de la locomoción.
   * @param {number} dt
   * @param {THREE.Vector3} cabeza
   * @param {{centro: THREE.Vector3, radio: number}[]} cuerpo  Esferas del astronauta (cabeza y torso).
   * @param {THREE.Vector3} velocidadCuerpo
   * @param {{posicion: THREE.Vector3, cerrada: boolean}[]} manos
   */
  actualizar(dt, cabeza, cuerpo, velocidadCuerpo, manos = []) {
    const p = this.p;
    this._tiempo += dt;
    this.activos = 0;
    const t = this._tiempo;
    for (const f of this.objetos) {
      if (f.mano) {                                      // tomado: sigue a la mano
        const m = f.mano;
        if (m.objeto) {
          m.objeto.updateWorldMatrix(true, false);
          f.posicion.copy(f._local).applyMatrix4(m.objeto.matrixWorld);
          m.objeto.getWorldQuaternion(_q);
          f.malla.quaternion.copy(_q).multiply(f._qLocal);
        } else {
          f.posicion.copy(m.posicion).add(f._local);
        }
        f.malla.visible = true;
        this.activos++;
        continue;
      }
      const lejos = f.posicion.distanceToSquared(cabeza) > p.distanciaActiva * p.distanciaActiva;
      f.malla.visible = !lejos;
      if (lejos) continue;
      this.activos++;

      // --- fuerzas suaves: brisa, pasillo y correa
      f.velocidad.x += Math.sin(t * 0.21 + f._fase.x) * p.brisa * dt;
      f.velocidad.y += Math.sin(t * 0.17 + f._fase.y) * p.brisa * dt;
      f.velocidad.z += Math.sin(t * 0.13 + f._fase.z) * p.brisa * dt;
      for (const eje of this.pasillos) {
        cercanoEnSegmento(f.posicion, eje.a, eje.b, _p);
        _n.subVectors(f.posicion, _p);
        const d = _n.length();
        const borde = p.radioPasillo + f.radio;
        if (d < borde) {
          if (d >= 1e-4) {
            _n.multiplyScalar(1 / d);
          } else if (_n.subVectors(f.casa, _p).lengthSq() < 1e-6) {
            _n.set(1, 0, 0);                             // justo en el eje y sin zona propia: cualquier lado sirve
          } else {
            _n.normalize();
          }
          // el eje no empuja a lo largo de sí mismo
          _v.subVectors(eje.b, eje.a).normalize();
          _n.addScaledVector(_v, -_n.dot(_v));
          if (_n.lengthSq() > 1e-8) f.velocidad.addScaledVector(_n.normalize(), p.empujePasillo * (1 - d / borde + 0.25) * dt);
        }
      }
      if (!f.libre) {
        _v.subVectors(f.posicion, f.casa);
        const d = _v.length();
        if (d > p.correa) f.velocidad.addScaledVector(_v, -p.fuerzaCorrea * (d - p.correa) / d * dt);
      } else if (f.velocidad.lengthSq() < p.velocidadReposo * p.velocidadReposo) {
        f.libre = false;                                 // se frenó: esta es su nueva zona
        f.casa.copy(f.posicion);
      }
      f.velocidad.multiplyScalar(Math.exp(-p.arrastre * dt));
      f.velocidad.clampLength(0, p.velocidadMaxima);

      // --- movimiento en subpasos (un objeto lanzado no atraviesa una pared)
      const paso = Math.max(0.03, f.radio * 0.8);
      const pasos = Math.max(1, Math.ceil(f.velocidad.length() * dt / paso));
      const dtPaso = dt / pasos;
      for (let i = 0; i < pasos; i++) {
        f.posicion.addScaledVector(f.velocidad, dtPaso);
        for (const sistema of this.colisionadores()) {
          if (!sistema.resolverEsfera(f.posicion, f.radio)) continue;
          for (let k = 0; k < sistema.contactos; k++) {
            const n = sistema.normalesContacto[k];
            const vn = f.velocidad.dot(n);
            if (vn < 0) {
              f.velocidad.addScaledVector(n, -(1 + p.restitucion) * vn);
              // el roce contra la superficie cambia un poco el giro
              f.giro.addScaledVector(_v.crossVectors(n, f.velocidad), 0.6).clampLength(0, 3);
            }
          }
        }
      }

      // --- el astronauta lo empuja: cuerpo y manos abiertas
      for (const e of cuerpo) this._empujar(f, e.centro, e.radio, velocidadCuerpo);
      for (const m of manos) {
        if (m.sostiene) continue;
        const em = this._manos.get(m);
        this._empujar(f, m.posicion, p.radioMano, em ? em.velocidad : _v.set(0, 0, 0));
      }

      // --- giro
      const w = f.giro.length();
      if (w > 1e-5) {
        _q.setFromAxisAngle(_n.copy(f.giro).multiplyScalar(1 / w), w * dt);
        f.malla.quaternion.premultiply(_q);
      }
    }
  }

  /** Saca al objeto de adentro de una esfera que se mueve y le pasa su velocidad (masa del cuerpo: infinita). */
  _empujar(f, centro, radio, velocidad) {
    _n.subVectors(f.posicion, centro);
    const d = _n.length();
    const minimo = radio + f.radio;
    if (d >= minimo) return false;
    if (d < 1e-5) _n.set(0, 1, 0); else _n.multiplyScalar(1 / d);
    f.posicion.addScaledVector(_n, minimo - d);
    const vRel = f.velocidad.dot(_n) - velocidad.dot(_n);
    if (vRel < 0) {
      f.velocidad.addScaledVector(_n, -(1 + this.p.restitucion) * vRel);
      if (-vRel > 0.15) f.libre = true;                  // un empujón fuerte lo saca de su zona
    }
    return true;
  }
}
