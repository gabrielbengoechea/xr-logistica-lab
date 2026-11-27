// Locomoción en microgravedad (0G) del astronauta, con cuerpo sólido.
//
//  - Inercia: el cuerpo conserva su velocidad; solo la cambian el empuje de los propulsores de mano (stick),
//    el freno, los choques y las manos.
//  - Agarre: con la mano cerrada sobre una baranda (o apoyada en una pared) el cuerpo se mueve al revés que la
//    mano; al soltar, sale con la velocidad promedio de los últimos cuadros.
//  - Cuerpo: dos esferas (cabeza y torso) que no atraviesan la geometría. Los choques corrigen la penetración,
//    devuelven una fracción de la velocidad normal y conservan casi toda la tangencial.
//
// No depende de WebXR: recibe las manos como objetos { posicion, cerrada }, así se prueba fuera del visor.
import * as THREE from 'three';

export const PARAMETROS = {
  radioCabeza: 0.20,
  radioTorso: 0.20,
  alturaTorso: 0.30,        // el torso va esta distancia por debajo de la cabeza
  pasoMaximo: 0.08,         // m: subpaso máximo del movimiento (menos que el radio: no hay efecto túnel)
  aceleracion: 1.1,         // m/s² del empuje con el stick
  velocidadEmpuje: 1.5,     // m/s: tope de lo que se alcanza solo con empuje
  velocidadMaxima: 3.0,     // m/s: tope absoluto
  velocidadAlSoltar: 2.2,   // m/s: tope al impulsarse con las manos
  friccionLibre: 0.04,      // 1/s: casi sin fricción (aire de la cabina)
  friccionFreno: 3.0,       // 1/s con el freno apretado
  restitucion: 0.25,        // fracción de la velocidad normal que se devuelve en un choque
  velocidadSinRebote: 0.2,  // m/s: por debajo, el choque no rebota (evita el efecto pinball)
  friccionContacto: 0.06,   // fracción de la velocidad tangencial que se pierde en cada contacto
  alcanceBaranda: 0.16,     // m: distancia a la que la mano toma una baranda
  alcanceApoyo: 0.10,       // m: distancia a la que la mano se apoya en una superficie
  cuadrosAlSoltar: 5,
};

const _delta = new THREE.Vector3();
const _paso = new THREE.Vector3();
const _centro = new THREE.Vector3();
const _antes = new THREE.Vector3();
const _punto = new THREE.Vector3();
const _n = new THREE.Vector3();
const _cabeza = new THREE.Vector3();
const _inicio = new THREE.Vector3();

/** Respuesta de la velocidad a un contacto de normal `n` (unitaria, hacia afuera de la superficie). */
export function responderChoque(velocidad, n, p = PARAMETROS) {
  const vn = velocidad.dot(n);
  if (vn >= 0) return 0;                                   // ya se aleja
  const e = -vn < p.velocidadSinRebote ? 0 : p.restitucion;
  velocidad.addScaledVector(n, -(1 + e) * vn);             // quita la componente normal y devuelve una parte
  // fricción: la componente tangencial pierde un poco (la normal ya quedó resuelta)
  const vnDespues = velocidad.dot(n);
  _n.copy(n).multiplyScalar(vnDespues);
  velocidad.sub(_n).multiplyScalar(1 - p.friccionContacto).add(_n);
  return -vn;
}

export class Locomocion0G {
  /**
   * @param {object} o
   * @param {THREE.Object3D} o.rig        Raíz que se mueve (el cuerpo).
   * @param {THREE.Object3D} o.cabeza     Cámara del visor.
   * @param {() => Iterable<import('./colisiones.js').SistemaColisiones>} o.colisionadores  Sistemas activos.
   * @param {import('./colisiones.js').SistemaColisiones} o.estructura  Sistema estático (para apoyar la mano).
   * @param {import('./barandas.js').Barandas} o.barandas
   */
  constructor({ rig, cabeza, colisionadores, estructura, barandas, parametros = PARAMETROS }) {
    this.rig = rig;
    this.cabeza = cabeza;
    this.colisionadores = colisionadores;
    this.estructura = estructura;
    this.barandas = barandas;
    this.p = parametros;
    this.velocidad = new THREE.Vector3();
    this.agarrado = false;
    this.ultimoChoque = 0;          // m/s de entrada del último choque de este cuadro (0 si no hubo)
    this.contactos = 0;             // contactos resueltos en este cuadro
    this._historia = [];
    for (let i = 0; i < 8; i++) this._historia.push(new THREE.Vector3());
    this._hCant = 0;
    this._hSig = 0;
    this._desfase = new THREE.Vector3();
  }

  /** Deja el cuerpo quieto en `posicion` (salto por el mapa). */
  teletransportar(posicion) {
    this.rig.position.copy(posicion);
    this.velocidad.set(0, 0, 0);
    this._hCant = 0;
  }

  /**
   * Avanza un cuadro.
   * @param {number} dt
   * @param {{posicion: THREE.Vector3, cerrada: boolean, agarre: null|{tipo: string, ancla: THREE.Vector3}}[]} manos
   *        `posicion` en el mundo; el módulo escribe `agarre` y `cerca` ('baranda' | 'apoyo' | null).
   * @param {THREE.Vector3} empuje  Dirección de empuje en el mundo, de módulo 0 a 1.
   * @param {boolean} frenando
   */
  actualizar(dt, manos, empuje, frenando) {
    const p = this.p;
    this.ultimoChoque = 0;
    this.contactos = 0;
    this.cabeza.getWorldPosition(_cabeza);
    this._desfase.subVectors(_cabeza, this.rig.position);

    // --- manos: tomar o soltar
    let agarres = 0;
    _delta.set(0, 0, 0);
    for (const m of manos) {
      if (m.sostiene) {                // la mano lleva un objeto: no se agarra de la estación
        m.cerca = null;
        m.agarre = null;
        m._yaCerrada = m.cerrada;
        continue;
      }
      const dB = this.barandas.masCercana(m.posicion, p.alcanceBaranda, _punto);
      const dA = dB === Infinity ? this.estructura.puntoMasCercano(m.posicion, p.alcanceApoyo, _punto) : Infinity;
      m.cerca = dB !== Infinity ? 'baranda' : dA !== Infinity ? 'apoyo' : null;
      if (m.cerrada && !m.agarre && !m._yaCerrada && m.cerca) {
        m.agarre = { tipo: m.cerca, ancla: m.posicion.clone() };
        m.nuevoAgarre = true;
      } else if (!m.cerrada && m.agarre) {
        m.agarre = null;
      }
      m._yaCerrada = m.cerrada;      // hay que soltar y volver a cerrar para tomar otra cosa
      if (m.agarre) {
        _delta.add(m.agarre.ancla).sub(m.posicion);
        agarres++;
      }
    }

    if (agarres > 0) {
      // la mano queda clavada: el cuerpo se mueve lo contrario de lo que se movió la mano
      _delta.multiplyScalar(1 / agarres);
      _inicio.copy(this.rig.position);
      this._mover(_delta, false, dt);
      if (dt > 0) {
        const h = this._historia[this._hSig];
        h.subVectors(this.rig.position, _inicio).multiplyScalar(1 / dt);
        this._hSig = (this._hSig + 1) % this._historia.length;
        this._hCant = Math.min(this._hCant + 1, this._historia.length);
        this.velocidad.copy(h);
      }
      this.agarrado = true;
      return;
    }

    if (this.agarrado) {
      // recién soltó: sale con la velocidad promedio de los últimos cuadros (filtra el temblor de la mano)
      this.agarrado = false;
      const n = Math.min(p.cuadrosAlSoltar, this._hCant);
      this.velocidad.set(0, 0, 0);
      for (let i = 1; i <= n; i++) {
        this.velocidad.add(this._historia[(this._hSig - i + this._historia.length) % this._historia.length]);
      }
      if (n > 0) this.velocidad.multiplyScalar(1 / n);
      this.velocidad.clampLength(0, p.velocidadAlSoltar);
      this._hCant = 0;
    }

    // --- empuje: acelera, no fija la velocidad
    if (empuje.lengthSq() > 1e-6) {
      const antes = this.velocidad.length();
      this.velocidad.addScaledVector(empuje, p.aceleracion * dt);
      const tope = Math.max(antes, p.velocidadEmpuje);     // el empuje no frena un impulso más rápido
      this.velocidad.clampLength(0, tope);
    }
    this.velocidad.multiplyScalar(Math.exp(-(frenando ? p.friccionFreno : p.friccionLibre) * dt));
    this.velocidad.clampLength(0, p.velocidadMaxima);
    if (frenando && this.velocidad.lengthSq() < 0.0004) this.velocidad.set(0, 0, 0);

    _delta.copy(this.velocidad).multiplyScalar(dt);
    this._mover(_delta, true, dt);
  }

  /** Mueve el cuerpo en subpasos y resuelve los contactos después de cada uno. */
  _mover(delta, flotando, dt) {
    const pasos = Math.max(1, Math.ceil(delta.length() / this.p.pasoMaximo));
    const dtPaso = dt / pasos;
    _paso.copy(delta).multiplyScalar(1 / pasos);
    for (let i = 0; i < pasos; i++) {
      // flotando, la velocidad puede cambiar en un choque: cada subpaso usa la velocidad del momento
      if (flotando) _paso.copy(this.velocidad).multiplyScalar(dtPaso);
      this.rig.position.add(_paso);
      this._resolverCuerpo(flotando);
    }
  }

  _resolverCuerpo(flotando) {
    const p = this.p;
    for (let esfera = 0; esfera < 2; esfera++) {
      const radio = esfera === 0 ? p.radioCabeza : p.radioTorso;
      for (const sistema of this.colisionadores()) {
        _centro.copy(this.rig.position).add(this._desfase);
        if (esfera === 1) _centro.y -= p.alturaTorso;
        _antes.copy(_centro);
        if (!sistema.resolverEsfera(_centro, radio)) continue;
        this.rig.position.add(_centro).sub(_antes);
        this.contactos += sistema.contactos;
        if (!flotando) continue;
        for (let k = 0; k < sistema.contactos; k++) {
          const entrada = responderChoque(this.velocidad, sistema.normalesContacto[k], p);
          if (entrada > this.ultimoChoque) this.ultimoChoque = entrada;
        }
      }
    }
  }
}
