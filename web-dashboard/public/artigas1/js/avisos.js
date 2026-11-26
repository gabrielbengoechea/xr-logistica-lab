// Ubicación de los carteles que le hablan al jugador (avisos breves, instrucciones y resultados).
//
// Antes el aviso quedaba quieto a 95 cm de la cabeza. Si había una pared, un rack o una bolsa más cerca, el
// cartel quedaba detrás y el jugador no se enteraba de que había completado un paso. Ahora:
//   - la distancia se mide hacia adelante contra la estación: el cartel queda antes del primer obstáculo
//     (nunca más cerca de `minima`), y se agranda o achica para que se lea siempre del mismo tamaño;
//   - se dibuja encima de todo (sin prueba de profundidad): un objeto suelto, una herramienta o la mano
//     tampoco lo tapan. Va debajo del túnel y del parpadeo del confort, que lo tienen que cubrir;
//   - sigue a la mirada «con pereza»: si el jugador gira y el cartel sale del centro de la vista, vuelve
//     despacio delante de los ojos. No va pegado a la cámara, para que no maree;
//   - no tapa botones: si en su lugar de siempre (un poco debajo de la mirada) quedaría encima de un panel con
//     botones, se pone arriba de la mirada (o más abajo, si arriba también hay uno).
import * as THREE from 'three';

export const PARAMETROS_AVISO = {
  distancia: 0.95,     // m: distancia cómoda de lectura cuando hay lugar
  minima: 0.42,        // m: más cerca cuesta enfocar
  margen: 0.14,        // m: lo que se deja libre antes del obstáculo
  paso: 0.05,          // m: resolución de la búsqueda hacia adelante
  radioPrueba: 0.06,   // m: grosor del «rayo» que busca obstáculos
  bajar: 0.30,         // fracción de la distancia que el cartel queda por debajo de la mirada
  anguloSeguir: 0.42,  // rad (24°): fuera de este ángulo, el cartel vuelve al centro
  rapidez: 5,          // 1/s: qué tan rápido vuelve
};

const _o = new THREE.Vector3();
const _p = new THREE.Vector3();
const _x = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _prueba = new THREE.Vector3();
const _basura = new THREE.Vector3();
const _cab = new THREE.Vector3();
const _rayo = new THREE.Vector3();
const _derecha = new THREE.Vector3();

/**
 * Distancia libre hacia adelante desde `origen` en `direccion`, contra los sistemas de colisión activos.
 * Devuelve la distancia hasta el primer obstáculo, o `hasta` si no hay ninguno.
 * @param {Iterable<{puntoMasCercano: Function, activo?: boolean}>} sistemas
 */
export function distanciaLibre(sistemas, origen, direccion, hasta, p = PARAMETROS_AVISO) {
  const lista = [...sistemas];
  for (let d = p.paso; d <= hasta + 1e-6; d += p.paso) {
    _prueba.copy(origen).addScaledVector(direccion, d);
    for (const s of lista) if (s.activo !== false && s.puntoMasCercano(_prueba, p.radioPrueba, _basura) !== Infinity) return d;
  }
  return hasta;
}

/** Distancia a la que conviene poner un cartel, según lo libre que esté adelante. */
export function distanciaCartel(libre, p = PARAMETROS_AVISO) {
  return THREE.MathUtils.clamp(libre - p.margen, p.minima, p.distancia);
}

/** Deja la malla encima de todo, salvo el túnel y el parpadeo del confort (renderOrder 998 y 999). */
export function siempreVisible(malla, orden = 990) {
  malla.material.depthTest = false;
  malla.material.depthWrite = false;
  malla.material.transparent = true;
  malla.renderOrder = orden;
}

export class UbicadorCartel {
  /**
   * @param {THREE.Mesh} malla  El panel.
   * @param {() => Iterable<object>} sistemas  Colisionadores activos (estructura, escotillas, exterior).
   * @param {object} [o]
   * @param {boolean} [o.seguir]  Si vuelve delante de los ojos cuando el jugador gira.
   */
  constructor(malla, sistemas, { seguir = true, bajar = PARAMETROS_AVISO.bajar, p = PARAMETROS_AVISO, ocupado = null, ancho = 0.66, alto = 0.11 } = {}) {
    this.malla = malla;
    /** (origen, dirección) => true si ahí hay un panel con botones que el cartel taparía. */
    this.ocupado = ocupado;
    this.ancho = ancho;
    this.alto = alto;
    /** Cuánto baja de la mirada en esta ubicación (negativo: arriba). */
    this.bajarActual = bajar;
    this.sistemas = sistemas;
    this.seguir = seguir;
    this.bajar = bajar;
    this.p = p;
    this.distancia = p.distancia;
    this._meta = new THREE.Vector3();
    this._volviendo = false;
  }

  /** ¿El cartel, puesto en esa dirección y a esa distancia, taparía un panel con botones? */
  _tapa(dir, derecha, arriba, distancia) {
    if (!this.ocupado) return false;
    const s = distancia / this.p.distancia;
    const mx = (this.ancho / 2) * s, my = (this.alto / 2) * s;
    for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      // temporales propios: `ocupado` usa distanciaLibre, que pisa _prueba y _basura
      _rayo.copy(dir).multiplyScalar(distancia).addScaledVector(derecha, a * mx).addScaledVector(arriba, b * my).normalize();
      if (this.ocupado(_o, _rayo)) return true;
    }
    return false;
  }

  /** Punto delante de los ojos, antes del primer obstáculo. Deja la distancia en `this.distancia`. */
  _calcular(camara, out) {
    camara.getWorldPosition(_o);
    camara.getWorldQuaternion(_q);
    const dir = _x.set(0, 0, -1).applyQuaternion(_q);
    _up.set(0, 1, 0).applyQuaternion(_q);
    // dónde va: un poco por debajo de la mirada; si ahí taparía botones, arriba; si no, más abajo
    const derecha = _derecha.set(1, 0, 0).applyQuaternion(_q);
    let elegido = this.bajar;
    if (this.ocupado) {
      elegido = null;
      for (const b of [this.bajar, -this.bajar, this.bajar * 1.8]) {
        const h = _dir.copy(dir).addScaledVector(_up, -b).normalize();
        const libre = distanciaLibre(this.sistemas(), _o, h, this.p.distancia + this.p.margen, this.p);
        const arriba = _cab.copy(_up).addScaledVector(h, -_up.dot(h)).normalize();
        if (!this._tapa(h, derecha, arriba, distanciaCartel(libre, this.p))) { elegido = b; break; }
      }
      if (elegido === null) elegido = this.bajar;          // tapa en todos lados: queda donde va siempre
    }
    this.bajarActual = elegido;
    const haciaCartel = _dir.copy(dir).addScaledVector(_up, -elegido).normalize();
    const libre = distanciaLibre(this.sistemas(), _o, haciaCartel, this.p.distancia + this.p.margen, this.p);
    this.distancia = distanciaCartel(libre, this.p);
    return out.copy(_o).addScaledVector(haciaCartel, this.distancia);
  }

  _orientar(camara) {
    camara.getWorldPosition(_o);
    camara.getWorldQuaternion(_q);
    this.malla.up.set(0, 1, 0).applyQuaternion(_q);
    this.malla.lookAt(_o);
    // mismo tamaño aparente a cualquier distancia
    this.malla.scale.setScalar(this.malla.position.distanceTo(_o) / this.p.distancia);
  }

  /** Pone el cartel delante de los ojos ya mismo. */
  colocar(camara) {
    this._calcular(camara, this.malla.position);
    this._meta.copy(this.malla.position);
    this._volviendo = false;
    this._orientar(camara);
  }

  /** Cada cuadro mientras el cartel está visible. */
  actualizar(dt, camara) {
    if (!this.malla.visible) return;
    if (this.seguir) {
      camara.getWorldPosition(_o);
      camara.getWorldQuaternion(_q);
      const dir = _x.set(0, 0, -1).applyQuaternion(_q);
      const hacia = _p.copy(this.malla.position).sub(_o).normalize();
      if (!this._volviendo && dir.angleTo(hacia) > this.p.anguloSeguir) this._volviendo = true;
      if (this._volviendo) {
        this._calcular(camara, this._meta);
        this.malla.position.lerp(this._meta, 1 - Math.exp(-this.p.rapidez * dt));
        if (this.malla.position.distanceTo(this._meta) < 0.01) this._volviendo = false;
      }
    }
    this._orientar(camara);
  }
}
