// Confort contra el mareo, como en Mission: ISS.
//
// El mareo en VR aparece cuando los ojos ven un movimiento que el oído interno no siente. Lo peor es la rotación
// continua de la vista con el stick y el movimiento en la periferia. Dos herramientas:
//
//  - Parpadeo: el giro con el stick derecho no se ve. La vista se funde a negro en 60 ms, el cuerpo gira con la
//    pantalla tapada y la vista vuelve en 90 ms. El cerebro no recibe ninguna rotación que no sintió.
//  - Túnel: mientras el astronauta se desplaza, la periferia de la vista se oscurece y queda una ventana al
//    frente. Cuanto más rápido va, más se cierra; quieto, desaparece.
//
// Las dos cosas son planos negros pegados a la cámara, sin luces ni texturas: cuestan dos llamadas de dibujo
// solo cuando se ven.
import * as THREE from 'three';

/** Fuerza máxima del túnel según el ajuste del jugador. */
export const NIVELES_TUNEL = { apagado: 0, suave: 0.55, medio: 0.8, fuerte: 1 };
export const ORDEN_TUNEL = ['apagado', 'suave', 'medio', 'fuerte'];

export const PARAMETROS_CONFORT = {
  cierre: 0.06,          // s que tarda la vista en fundirse a negro antes de girar
  negro: 0.04,           // s con la pantalla tapada
  apertura: 0.09,        // s que tarda en volver
  velocidadTunel: 0.55,  // m/s a la que el túnel llega a su fuerza máxima
  umbralTunel: 0.04,     // m/s por debajo de los cuales no hay túnel
  subida: 7,             // 1/s: qué tan rápido se cierra el túnel al arrancar
  bajada: 2.5,           // 1/s: qué tan rápido se abre al frenar
};

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// Radio en unidades del plano: 1 es el borde del plano; el campo visual del Quest 2 llega a ~0,7.
const FRAG_TUNEL = `
  uniform float uFuerza;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float interior = mix(0.95, 0.30, uFuerza);     // con fuerza 1 queda una ventana de ~30 % del alto
    float a = smoothstep(interior, interior + 0.22, r) * min(1.0, uFuerza * 3.0);
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }`;

export class Confort {
  /** @param {THREE.Camera} camara @param {typeof PARAMETROS_CONFORT} p */
  constructor(camara, p = PARAMETROS_CONFORT) {
    this.p = p;
    this.nivelTunel = 'medio';
    this.fuerza = 0;
    this._tunel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.36),                  // a 12 cm: el borde queda a ~56° del centro, justo afuera de la vista
      new THREE.ShaderMaterial({ uniforms: { uFuerza: { value: 0 } }, vertexShader: VERT, fragmentShader: FRAG_TUNEL, transparent: true, depthTest: false, depthWrite: false }),
    );
    this._tunel.name = 'Tunel_Confort';
    this._tunel.position.z = -0.12;
    this._tunel.renderOrder = 998;
    this._tunel.frustumCulled = false;
    this._tunel.visible = false;
    this._velo = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
    );
    this._velo.name = 'Parpadeo_Confort';
    this._velo.position.z = -0.1;
    this._velo.renderOrder = 999;
    this._velo.frustumCulled = false;
    this._velo.visible = false;
    camara.add(this._tunel, this._velo);
    this._fase = '';
    this._t = 0;
    this._alMedio = null;
    /** Opacidad del velo en el momento en que se aplicó el último giro (para las pruebas: tiene que ser 1). */
    this.opacidadAlGirar = -1;
    this.giros = 0;
  }

  /** true mientras dura un parpadeo: no se aceptan otros giros. */
  get parpadeando() { return this._fase !== ''; }

  /**
   * Funde a negro, ejecuta `alMedio` con la vista tapada y vuelve. Devuelve false si ya hay un parpadeo en curso.
   * @param {() => void} alMedio
   */
  parpadear(alMedio) {
    if (this._fase) return false;
    this._fase = 'cierra';
    this._t = 0;
    this._alMedio = alMedio;
    this._velo.visible = true;
    return true;
  }

  /**
   * @param {number} dt
   * @param {number} velocidad  Rapidez del cuerpo (m/s).
   * @param {boolean} forzar    Túnel al máximo (giro suave en curso).
   */
  actualizar(dt, velocidad, forzar = false) {
    // --- parpadeo
    if (this._fase) {
      this._t += dt;
      const p = this.p;
      const m = this._velo.material;
      if (this._fase === 'cierra') {
        m.opacity = Math.min(1, this._t / p.cierre);
        if (this._t >= p.cierre) {
          m.opacity = 1;
          this.opacidadAlGirar = m.opacity;
          this.giros++;
          if (this._alMedio) this._alMedio();
          this._alMedio = null;
          this._fase = 'negro';
          this._t = 0;
        }
      } else if (this._fase === 'negro') {
        if (this._t >= p.negro) { this._fase = 'abre'; this._t = 0; }
      } else {
        m.opacity = Math.max(0, 1 - this._t / p.apertura);
        if (this._t >= p.apertura) { m.opacity = 0; this._fase = ''; this._velo.visible = false; }
      }
    }
    // --- túnel
    const maximo = NIVELES_TUNEL[this.nivelTunel] ?? 0;
    const rel = THREE.MathUtils.clamp((velocidad - this.p.umbralTunel) / (this.p.velocidadTunel - this.p.umbralTunel), 0, 1);
    const meta = maximo * (forzar ? 1 : rel * rel * (3 - 2 * rel));
    const k = 1 - Math.exp(-(meta > this.fuerza ? this.p.subida : this.p.bajada) * dt);
    this.fuerza += (meta - this.fuerza) * k;
    if (this.fuerza < 0.005 && meta === 0) this.fuerza = 0;
    this._tunel.material.uniforms.uFuerza.value = this.fuerza;
    this._tunel.visible = this.fuerza > 0;
  }
}
