// Caminata espacial (EVA): salida y regreso por la esclusa del Nodo, traje, casco con indicadores y cable de
// seguridad. El exterior y el interior son el mismo espacio: la esclusa está donde corresponde y la
// orientación del astronauta se conserva al cruzarla.
import * as THREE from 'three';
import { COLORES, PanelVR } from './paneles.js';
import { crearMascaraOcular } from './confort.js';
import { formatoTiempo } from './actividades.js';
import { ESCLUSA } from './exterior.js';

/** Capa del traje de la vista en tercera persona. No usar 1 ni 2: son las de cada ojo en WebXR. */
export const CAPA_TERCERA_PERSONA = 3;

export const PARAMETROS_EVA = {
  cable: 14.0,              // m: largo del cable de seguridad
  aviso: 11.5,              // m: desde acá el casco avisa
  retorno: 0.25,            // m/s: velocidad máxima con que el cable trae al astronauta
  elastico: 0.6,            // m: último tramo del cable, que tira suavemente hacia la estación
  tiron: 0.30,              // m/s²: aceleración de ese tirón
  alcanceEsclusa: 1.7,      // m: distancia a la escotilla para poder cruzarla
  fundido: 0.55,            // s de cada mitad de la transición
  espera: 1.6,              // s con la pantalla en negro («despresurizando»)
  reserva: 720,             // s de oxígeno para el indicador
};

const _v = new THREE.Vector3();
const _c = new THREE.Vector3();
const _m = new THREE.Vector3();

/** Cable de seguridad: une el anclaje de la esclusa con la cintura y no deja que el astronauta se aleje. */
export class TetherSystem {
  /** @param {THREE.Scene} escena @param {THREE.Vector3} ancla @param {typeof PARAMETROS_EVA} p */
  constructor(escena, ancla, p = PARAMETROS_EVA) {
    this.ancla = ancla.clone();
    this.p = p;
    this.distancia = 0;
    this.tenso = false;
    this.avisando = false;
    this._puntos = new Float32Array(20 * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this._puntos, 3));
    this.linea = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xf2b705 }));
    this.linea.name = 'Cable_Seguridad';
    this.linea.frustumCulled = false;
    this.linea.visible = false;
    escena.add(this.linea);
  }

  /**
   * Aplica el límite del cable. Modifica `posicion` (del cuerpo) y `velocidad`.
   * En el último tramo el cable tira suavemente hacia la estación (sin sacudidas); al llegar al largo total
   * frena en seco lo que quede de velocidad hacia afuera.
   * @param {THREE.Vector3} cintura  Punto de enganche en el mundo.
   * @param {number} dt
   * @returns {boolean} true si el cable llegó a su largo en este cuadro.
   */
  limitar(cintura, posicion, velocidad, dt = 0) {
    _v.subVectors(cintura, this.ancla);
    this.distancia = _v.length();
    this.avisando = this.distancia > this.p.aviso;
    this.tenso = this.distancia > this.p.cable;
    if (this.distancia < this.p.cable - this.p.elastico || this.distancia < 1e-6) return false;
    _v.multiplyScalar(1 / this.distancia);                      // hacia afuera
    let afuera = velocidad.dot(_v);
    if (this.tenso) {
      posicion.addScaledVector(_v, this.p.cable - this.distancia); // vuelve al largo del cable
      this.distancia = this.p.cable;
      if (afuera > 0) { velocidad.addScaledVector(_v, -afuera); afuera = 0; }
    }
    // tirón del tramo elástico, hasta la velocidad de retorno
    if (afuera > -this.p.retorno) velocidad.addScaledVector(_v, -Math.min(this.p.tiron * dt, afuera + this.p.retorno));
    return this.tenso;
  }

  /** Dibuja el cable con la holgura que le sobra. */
  dibujar(cintura) {
    const holgura = Math.max(0, this.p.cable - this.distancia) * 0.16;
    _c.addVectors(this.ancla, cintura).multiplyScalar(0.5);
    _c.y -= holgura;
    _c.x += holgura * 0.4;
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      this._puntos[i * 3] = a * this.ancla.x + b * _c.x + c * cintura.x;
      this._puntos[i * 3 + 1] = a * this.ancla.y + b * _c.y + c * cintura.y;
      this._puntos[i * 3 + 2] = a * this.ancla.z + b * _c.z + c * cintura.z;
    }
    this.linea.geometry.attributes.position.needsUpdate = true;
  }
}

/** Fundido a negro pegado a la cámara (sirve en el visor y en la compu) con un cartel de estado. */
export class StationTransitionManager {
  /** @param {THREE.Camera} camara */
  constructor(camara) {
    this.velo = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    this.velo.position.z = -0.2;
    this.velo.renderOrder = 1000;
    this.velo.visible = false;
    this.cartel = new PanelVR({ ancho: 0.9, alto: 0.2, px: 900, nombre: 'Cartel_Transicion', dibujar: (ctx) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 900, 200);
      ctx.fillStyle = COLORES.celeste;
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.texto, 450, 90);
      ctx.fillStyle = COLORES.gris;
      ctx.font = '28px sans-serif';
      ctx.fillText(this.subtexto, 450, 146);
    } });
    this.cartel.interactivo = false;
    this.cartel.malla.material.depthTest = false;
    this.cartel.malla.renderOrder = 1001;
    this.cartel.malla.position.set(0, 0, -1.4);
    this.cartel.malla.visible = false;
    camara.add(this.velo, this.cartel.malla);
    this.texto = '';
    this.subtexto = '';
    this.activa = false;
    this._t = 0;
    this._alMedio = null;
    this._alFin = null;
    this._hecho = false;
    this.p = PARAMETROS_EVA;
  }

  /** Funde a negro, llama a `alMedio` con la pantalla tapada y vuelve. */
  iniciar(texto, subtexto, alMedio, alFin = null, espera = this.p.espera) {
    if (this.activa) return false;
    this.texto = texto;
    this.subtexto = subtexto;
    this.cartel.redibujar();
    this.activa = true;
    this._t = 0;
    this._espera = espera;
    this._alMedio = alMedio;
    this._alFin = alFin;
    this._hecho = false;
    this.velo.visible = true;
    return true;
  }

  actualizar(dt) {
    if (!this.activa) return;
    this._t += dt;
    const f = this.p.fundido;
    const total = f * 2 + this._espera;
    let opacidad;
    if (this._t < f) opacidad = this._t / f;
    else if (this._t < f + this._espera) opacidad = 1;
    else opacidad = Math.max(0, 1 - (this._t - f - this._espera) / f);
    this.velo.material.opacity = opacidad;
    this.cartel.malla.visible = opacidad > 0.98 && this._espera > 0.3;
    if (!this._hecho && this._t >= f + this._espera * 0.5) {
      this._hecho = true;
      if (this._alMedio) this._alMedio();
    }
    if (this._t >= total) {
      this.activa = false;
      this.velo.visible = false;
      this.cartel.malla.visible = false;
      if (this._alFin) this._alFin();
    }
  }
}

export class EVAController {
  /**
   * @param {object} o
   * @param {THREE.Object3D} o.rig @param {THREE.Camera} o.camara @param {THREE.Scene} o.escena
   * @param {import('./locomocion.js').Locomocion0G} o.loco
   * @param {import('./manos.js').Manos} o.manos
   * @param {ReturnType<import('./exterior.js').crearExterior>} o.exterior
   * @param {StationTransitionManager} o.transicion
   * @param {{tocar: (n: string) => void}} o.sonido
   * @param {(fase: 'afuera'|'adentro') => void} o.alCambiar
   * @param {() => string} o.objetivo   Texto del objetivo actual para el casco.
   */
  constructor({ rig, camara, escena, loco, manos, exterior, transicion, sonido, alCambiar, objetivo }) {
    this.rig = rig;
    this.camara = camara;
    this.loco = loco;
    this.manos = manos;
    this.exterior = exterior;
    this.transicion = transicion;
    this.sonido = sonido;
    this.alCambiar = alCambiar;
    this.objetivo = objetivo;
    this.p = PARAMETROS_EVA;
    this.afuera = false;
    this.tiempo = 0;
    this.cable = new TetherSystem(escena, ESCLUSA.ancla, this.p);
    this._avisoReloj = 0;
    this._hudReloj = 0;
    // borde del casco: oscurece la periferia por ángulo desde el eje de cada ojo (igual en los dos ojos)
    this.casco = crearMascaraOcular('Borde_Casco', 0x0c0e12);
    this.casco.material.uniforms.uInterior.value = THREE.MathUtils.degToRad(47);
    this.casco.material.uniforms.uExterior.value = THREE.MathUtils.degToRad(55);
    this.casco.renderOrder = 997;
    this.casco.visible = false;
    this.hud = new PanelVR({ ancho: 0.56, alto: 0.105, px: 960, nombre: 'Indicadores_Casco', dibujar: (ctx) => this._dibujarHud(ctx) });
    this.hud.interactivo = false;
    this.hud.malla.material.transparent = true;
    this.hud.malla.material.opacity = 0.9;
    this.hud.malla.position.set(0, -0.36, -1.0);
    this.hud.malla.rotation.x = -0.32;
    this.hud.malla.visible = false;
    camara.add(this.casco, this.hud.malla);
    // Traje completo para la vista en tercera persona (tecla V en la compu). Va en su propia capa: ni la cámara
    // de la compu (capa 0) ni los ojos del visor la dibujan. OJO: en WebXR three.js le da la capa 1 al ojo
    // izquierdo y la 2 al derecho; un objeto en la capa 1 se ve solo con el ojo izquierdo. Antes el traje estaba
    // en la capa 1 y, pegado a la cámara, le tapaba el ojo izquierdo al astronauta durante toda la caminata.
    exterior.traje.layers.set(CAPA_TERCERA_PERSONA);
    exterior.traje.visible = false;
    camara.add(exterior.traje);
    exterior.grupo.visible = false;
    exterior.colisiones.activo = false;
  }

  /** ¿La cabeza está frente a la escotilla (del lado que corresponde)? */
  cercaDeLaEsclusa(cabeza) {
    return cabeza.distanceTo(this.afuera ? ESCLUSA.salida : ESCLUSA.interior) < this.p.alcanceEsclusa;
  }

  /** Lleva la cabeza a `destino` sin cambiar la orientación. */
  _cruzar(destino) {
    this.camara.getWorldPosition(_v);
    _m.copy(this.rig.position).add(destino).sub(_v);
    this.loco.teletransportar(_m);
  }

  /** Sale al exterior. Devuelve '' o el motivo por el que no se puede. */
  salir(cabeza) {
    if (this.afuera) return 'Ya estás afuera';
    if (this.transicion.activa) return 'Esperá';
    if (!this.cercaDeLaEsclusa(cabeza)) return 'Acercate a la escotilla de la esclusa';
    this.sonido.tocar('esclusa');
    this.transicion.iniciar('ESCLUSA · DESPRESURIZANDO', 'Traje presurizado · cable enganchado', () => {
      this.afuera = true;
      this.tiempo = 0;
      this._cruzar(ESCLUSA.salida);
      this.exterior.grupo.visible = true;
      this.exterior.colisiones.activo = true;
      this.exterior.traje.visible = true;
      this.manos.ponerGuantes(true);
      this.casco.visible = true;
      this.hud.malla.visible = true;
      this.cable.linea.visible = true;
      this.alCambiar('afuera');
    });
    return '';
  }

  /** Vuelve a entrar. Devuelve '' o el motivo por el que no se puede. */
  entrar(cabeza) {
    if (!this.afuera) return 'Ya estás adentro';
    if (this.transicion.activa) return 'Esperá';
    if (!this.cercaDeLaEsclusa(cabeza)) return 'Volvé hasta la escotilla de la esclusa';
    this.sonido.tocar('esclusa');
    this.transicion.iniciar('ESCLUSA · PRESURIZANDO', 'Bienvenido de vuelta a Artigas-1', () => this._adentro());
    return '';
  }

  /** Regreso inmediato (se terminó la reserva o se abandonó la actividad). */
  regresoDeEmergencia() {
    if (!this.afuera || this.transicion.activa) return;
    this.transicion.iniciar('REGRESO A LA ESCLUSA', 'El cable te trajo de vuelta', () => this._adentro());
  }

  _adentro() {
    this.afuera = false;
    this._cruzar(ESCLUSA.interior);
    this.exterior.colisiones.activo = false;
    this.exterior.traje.visible = false;
    this.manos.ponerGuantes(false);
    this.casco.visible = false;
    this.hud.malla.visible = false;
    this.cable.linea.visible = false;
    this.alCambiar('adentro');
  }

  /** @param {number} dt @param {THREE.Vector3} cabeza @param {boolean} desdeLaCupula  El exterior también se ve desde la Cúpula. */
  actualizar(dt, cabeza, desdeLaCupula) {
    this.transicion.actualizar(dt);
    this.exterior.grupo.visible = this.afuera || desdeLaCupula;
    if (this.exterior.grupo.visible) this.exterior.actualizar(dt);
    if (!this.afuera) return;
    this.tiempo += dt;
    _c.copy(cabeza);
    _c.y -= 0.45;                                              // el enganche va en la cintura
    const tenso = this.cable.limitar(_c, this.rig.position, this.loco.velocidad, dt);
    if (tenso) { _c.copy(cabeza); _c.y -= 0.45; this.camara.updateWorldMatrix(true, false); }
    this.cable.dibujar(_c);
    this._avisoReloj -= dt;
    if (this.cable.avisando && this._avisoReloj <= 0) {
      this._avisoReloj = 2.2;
      this.sonido.tocar('alerta');
      this.manos.vibrarTodas(0.7, 120);
    }
    this._hudReloj += dt;
    if (this._hudReloj > 0.4) { this._hudReloj = 0; this.hud.redibujar(); }
  }

  _dibujarHud(ctx) {
    ctx.clearRect(0, 0, 960, 180);
    ctx.fillStyle = 'rgba(8, 14, 22, 0.82)';
    ctx.fillRect(0, 0, 960, 180);
    const alerta = this.cable.avisando;
    ctx.strokeStyle = alerta ? COLORES.amarillo : COLORES.celeste;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 954, 174);
    ctx.font = 'bold 34px monospace';
    ctx.fillStyle = COLORES.blanco;
    const o2 = Math.max(0, Math.round(100 * (1 - this.tiempo / this.p.reserva)));
    ctx.fillText(`EVA ${formatoTiempo(this.tiempo)}`, 28, 56);
    ctx.fillStyle = o2 < 20 ? COLORES.rojo : COLORES.verde;
    ctx.fillText(`O₂ ${o2} %`, 300, 56);
    ctx.fillStyle = alerta ? COLORES.amarillo : COLORES.blanco;
    ctx.fillText(`CABLE ${this.cable.distancia.toFixed(1).replace('.', ',')} / ${this.p.cable} m`, 520, 56);
    ctx.font = '30px sans-serif';
    ctx.fillStyle = alerta ? COLORES.amarillo : COLORES.celeste;
    ctx.fillText((alerta ? '⚠ Te estás alejando: volvé hacia la esclusa' : this.objetivo()).slice(0, 58), 28, 124);
  }
}
