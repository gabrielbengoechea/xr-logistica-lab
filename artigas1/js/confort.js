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
//
// Estéreo: todo lo que va pegado a la cámara se dibuja en los dos ojos (capa 0). El túnel y el borde del casco
// no se calculan sobre el plano sino por el ángulo de cada píxel respecto del eje de SU ojo, así el hueco queda
// centrado e igual en los dos ojos (un plano a 12 cm, medido desde el centro de la cabeza, queda corrido 3 cm
// para cada ojo y los dos ojos verían bordes distintos).
import * as THREE from 'three';

/**
 * Máscara pegada a la cámara que oscurece por ángulo desde el eje de cada ojo.
 * El shader recibe el ángulo interior (transparente) y el exterior (opaco), en radianes.
 * @param {string} nombre @param {number} color  Hex.
 */
export function crearMascaraOcular(nombre, color = 0x000000) {
  const c = new THREE.Color(color);
  const m = new THREE.Mesh(
    // a 10 cm, 0,7 m de lado: cubre hasta ~72° desde el eje de cada ojo, más que el campo visual del Quest 2
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.ShaderMaterial({
      uniforms: { uInterior: { value: 1.2 }, uExterior: { value: 1.4 }, uOpacidad: { value: 1 }, uColor: { value: new THREE.Vector3(c.r, c.g, c.b) } },
      vertexShader: 'varying vec3 vVista; void main() { vec4 v = modelViewMatrix * vec4(position, 1.0); vVista = v.xyz; gl_Position = projectionMatrix * v; }',
      fragmentShader: `
        uniform float uInterior; uniform float uExterior; uniform float uOpacidad; uniform vec3 uColor;
        varying vec3 vVista;
        void main() {
          float angulo = acos(clamp(-normalize(vVista).z, -1.0, 1.0));   // desde el eje del ojo que dibuja
          float a = smoothstep(uInterior, uExterior, angulo) * uOpacidad;
          gl_FragColor = vec4(uColor, a);
        }`,
      transparent: true, depthTest: false, depthWrite: false,
    }),
  );
  m.name = nombre;
  m.position.z = -0.1;
  m.frustumCulled = false;
  return m;
}

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

/** Ventana del túnel: ángulo (grados) donde empieza a oscurecer, sin túnel y con el túnel al máximo. */
const TUNEL_ABIERTO = 62;
const TUNEL_CERRADO = 20;
const TUNEL_BORDE = 16;

export class Confort {
  /** @param {THREE.Camera} camara @param {typeof PARAMETROS_CONFORT} p */
  constructor(camara, p = PARAMETROS_CONFORT) {
    this.p = p;
    this.nivelTunel = 'medio';
    this.fuerza = 0;
    this._tunel = crearMascaraOcular('Tunel_Confort');
    this._tunel.renderOrder = 998;
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
    const u = this._tunel.material.uniforms;
    u.uInterior.value = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(TUNEL_ABIERTO, TUNEL_CERRADO, this.fuerza));
    u.uExterior.value = u.uInterior.value + THREE.MathUtils.degToRad(TUNEL_BORDE);
    u.uOpacidad.value = Math.min(1, this.fuerza * 3);
    this._tunel.visible = this.fuerza > 0;
  }
}
