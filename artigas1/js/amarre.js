// Correas y trinquete de los contenedores en los huecos del rack.
//
// Soltar un contenedor junto a un hueco ya no lo deja asegurado: queda APOYADO, con la correa floja en ámbar y
// un trinquete naranja en su frente que late. Para amarrarlo hay que acercar una mano libre al trinquete y
// apretar el gatillo: cada apretón es un diente (clic, vibración y la palanca baja). Con `DIENTES` dientes la
// correa queda tensa y el contenedor, AMARRADO (correa naranja y luz verde).
//
// Se usa el gatillo y no el grip porque el grip, cerca del contenedor, lo toma (y lo saca del hueco). La mano
// que lleva una herramienta no amarra: su gatillo es de la herramienta.
import * as THREE from 'three';

export const DIENTES = 3;
/** Distancia de la mano al trinquete para poder accionarlo (m). */
export const ALCANCE_TRINQUETE = 0.15;

const COLOR_FLOJA = new THREE.Color(0xf2b600);
const COLOR_TENSA = new THREE.Color(0xe8730c);
const LUZ_APOYADO = new THREE.Color(0xf2b600);
const LUZ_AMARRADO = new THREE.Color(0x3ecf6e);

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const geoCorrea = new THREE.BoxGeometry(1, 1, 1);
const geoBase = new THREE.BoxGeometry(0.05, 0.032, 0.036);
const geoPalanca = new THREE.BoxGeometry(0.014, 0.075, 0.022).translate(0, 0.0375, 0);
const geoLuz = new THREE.SphereGeometry(0.008, 8, 6);
const matBase = new THREE.MeshStandardMaterial({ color: 0x30353c, roughness: 0.5, metalness: 0.7 });

export class Amarres {
  /** @param {{tocar: (n: string) => void}|null} sonido @param {(m: object, fuerza: number, ms: number) => void} [vibrar] */
  constructor(sonido = null, vibrar = null) {
    this.sonido = sonido;
    this.vibrar = vibrar;
    /** @type {import('./flotantes.js').Flotante[]} contenedores apoyados o amarrados */
    this.puestos = [];
    /** @type {((f: object) => void) | null} */
    this.alAmarrar = null;
    this._t = 0;
  }

  /** Arma (una vez) la correa y el trinquete del contenedor, como hijos de su malla. */
  _armar(f) {
    const d = f.datos;
    if (d.amarre) return d.amarre;
    f.malla.geometry.computeBoundingBox();
    const caja = f.malla.geometry.boundingBox;
    const t = caja.getSize(new THREE.Vector3());
    const correa = new THREE.Mesh(geoCorrea, new THREE.MeshStandardMaterial({ color: COLOR_FLOJA, roughness: 0.8 }));
    correa.name = 'Correa';
    f.malla.add(correa);
    const trinquete = new THREE.Group();
    trinquete.name = 'Trinquete';
    const base = new THREE.Mesh(geoBase, matBase);
    const palanca = new THREE.Mesh(geoPalanca, new THREE.MeshStandardMaterial({ color: 0xe8730c, roughness: 0.55, metalness: 0.2, emissive: 0xe8730c, emissiveIntensity: 0.4 }));
    palanca.position.y = 0.012;
    const luz = new THREE.Mesh(geoLuz, new THREE.MeshBasicMaterial({ color: LUZ_APOYADO }));
    luz.position.set(0.034, 0, 0);
    trinquete.add(base, palanca, luz);
    f.malla.add(trinquete);
    d.amarre = { correa, trinquete, palanca, luz, tam: t, centro: caja.getCenter(new THREE.Vector3()), dientes: 0, amarrado: false, giro: 0 };
    d.correa = correa;                                   // nombre de antes (lo usan las pruebas y la tablet)
    return d.amarre;
  }

  /** Pone el trinquete en el frente del contenedor, del lado del pasillo (hacia el eje del módulo). */
  _ubicar(f) {
    const a = f.datos.amarre;
    f.malla.updateMatrixWorld(true);
    // afuera: del contenedor hacia el eje de la estación (el pasillo), en el marco del contenedor
    _v.set(-f.posicion.x, -f.posicion.y, 0);
    if (_v.lengthSq() < 1e-6) _v.set(1, 0, 0);
    _v.normalize().applyQuaternion(_q.copy(f.malla.quaternion).invert());
    const ext = Math.abs(_v.x) * a.tam.x / 2 + Math.abs(_v.y) * a.tam.y / 2 + Math.abs(_v.z) * a.tam.z / 2;
    a.trinquete.position.copy(a.centro).addScaledVector(_v, ext + 0.018);
    a.trinquete.quaternion.setFromUnitVectors(_w.set(0, 0, 1), _v);
    // la correa rodea el contenedor por el lado del trinquete
    a.correa.position.copy(a.centro);
  }

  _dibujar(f) {
    const a = f.datos.amarre;
    const k = a.amarrado ? 1 : a.dientes / DIENTES;
    const flojo = 0.03 * (1 - k);                        // la correa floja se ve separada del contenedor
    a.correa.scale.set(0.035, a.tam.y + 0.012 + flojo, a.tam.z + 0.012 + flojo);
    a.correa.material.color.copy(COLOR_FLOJA).lerp(COLOR_TENSA, k);
    a.luz.material.color.copy(a.amarrado ? LUZ_AMARRADO : LUZ_APOYADO);
    a.palanca.rotation.x = -1.1 * k;                     // la palanca baja con cada diente
  }

  /** Contenedor soltado en un hueco: queda apoyado, con la correa floja. */
  apoyar(f) {
    const a = this._armar(f);
    a.dientes = 0;
    a.amarrado = false;
    a.correa.visible = true;
    a.trinquete.visible = true;
    this._ubicar(f);
    this._dibujar(f);
    if (!this.puestos.includes(f)) this.puestos.push(f);
  }

  /** Contenedor sacado del hueco. */
  quitar(f) {
    const a = f.datos && f.datos.amarre;
    if (a) { a.correa.visible = false; a.trinquete.visible = false; a.dientes = 0; a.amarrado = false; }
    const i = this.puestos.indexOf(f);
    if (i >= 0) this.puestos.splice(i, 1);
  }

  /** Posición del trinquete en el mundo. */
  posicionTrinquete(f, out = new THREE.Vector3()) {
    const a = f.datos.amarre;
    a.trinquete.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(a.trinquete.matrixWorld);
  }

  /** El contenedor apoyado (sin amarrar) más cercano a la mano, dentro del alcance. */
  cercano(mano) {
    let mejor = null;
    let dMejor = ALCANCE_TRINQUETE;
    for (const f of this.puestos) {
      if (f.datos.amarre.amarrado || f.mano || !f.malla.visible) continue;
      const d = this.posicionTrinquete(f, _w).distanceTo(mano.posicion);
      if (d < dMejor) { dMejor = d; mejor = f; }
    }
    return mejor;
  }

  /**
   * Cada cuadro, después de los paneles y antes de la entrada (así el gatillo usado acá no abre el mapa).
   * Marca `mano.gatilloUsado` cuando el gatillo fue para el trinquete.
   */
  actualizar(dt, manos) {
    this._t += dt;
    const pulso = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this._t * 5));
    for (const f of this.puestos) {
      const a = f.datos.amarre;
      a.palanca.material.emissiveIntensity = a.amarrado ? 0.15 : pulso;
    }
    for (const m of manos) {
      if (m.sostiene || m.ocupada || m.gatilloUsado || !m.gatilloNuevo) continue;
      const f = this.cercano(m);
      if (!f) continue;
      m.gatilloUsado = true;
      const a = f.datos.amarre;
      a.dientes++;
      if (a.dientes >= DIENTES) a.amarrado = true;
      this._dibujar(f);
      if (this.sonido) this.sonido.tocar(a.amarrado ? 'ok' : 'clic');
      if (this.vibrar) this.vibrar(m, a.amarrado ? 0.7 : 0.35, a.amarrado ? 80 : 30);
      if (a.amarrado && this.alAmarrar) this.alAmarrar(f);
    }
  }
}
