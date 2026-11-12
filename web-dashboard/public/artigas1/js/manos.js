// Manos del astronauta en VR: lectura de los controles y una mano «fantasma» translúcida por control,
// que cambia de color cuando hay algo para tomar y cuando lo tiene tomado.
import * as THREE from 'three';

const COLOR_LIBRE = new THREE.Color(0.35, 0.8, 0.95);
const COLOR_CERCA = new THREE.Color(1.0, 0.82, 0.2);
const COLOR_AGARRE = new THREE.Color(0.25, 1.0, 0.45);

function mallaMano() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: COLOR_LIBRE.clone(), transparent: true, opacity: 0.45, depthWrite: false });
  const palma = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.03, 0.10), mat);
  palma.position.set(0, -0.01, 0.02);
  const dedos = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.06), mat);
  dedos.position.set(0, -0.012, -0.055);
  const pulgar = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.06), mat);
  g.add(palma, dedos, pulgar);
  g.userData.material = mat;
  g.userData.pulgar = pulgar;
  g.userData.dedos = dedos;
  return g;
}

export class Manos {
  /** @param {THREE.WebGLRenderer} renderer @param {THREE.Object3D} rig */
  constructor(renderer, rig) {
    this.renderer = renderer;
    /** Estado que consume la locomoción: una entrada por control conectado. */
    this.lista = [];
    this._porIndice = [];
    for (let i = 0; i < 2; i++) {
      const agarre = renderer.xr.getControllerGrip(i);
      const visual = mallaMano();
      agarre.add(visual);
      rig.add(agarre);
      const mano = { indice: i, lado: 'none', objeto: agarre, visual, posicion: new THREE.Vector3(), cerrada: false, agarre: null, cerca: null, nuevoAgarre: false, conectada: false, fuente: null };
      agarre.addEventListener('connected', (e) => {
        mano.lado = e.data.handedness;
        mano.fuente = e.data;
        mano.conectada = true;
        visual.userData.pulgar.position.set(mano.lado === 'left' ? 0.045 : -0.045, -0.005, -0.005);
        this._rearmar();
      });
      agarre.addEventListener('disconnected', () => {
        mano.conectada = false;
        mano.agarre = null;
        mano.cerrada = false;
        this._rearmar();
      });
      this._porIndice.push(mano);
    }
  }

  _rearmar() {
    this.lista = this._porIndice.filter((m) => m.conectada);
  }

  /** Lee los controles. Se llama una vez por cuadro, antes de la locomoción. */
  leer() {
    for (const m of this.lista) {
      m.objeto.getWorldPosition(m.posicion);
      const gp = m.fuente?.gamepad;
      m.cerrada = !!gp && gp.buttons.length > 1 && gp.buttons[1].pressed;
    }
  }

  /** Después de la locomoción: color, pose y vibración. */
  mostrar() {
    for (const m of this.lista) {
      const mat = m.visual.userData.material;
      mat.color.copy(m.agarre ? COLOR_AGARRE : m.cerca ? COLOR_CERCA : COLOR_LIBRE);
      mat.opacity = m.agarre ? 0.85 : 0.45;
      m.visual.userData.dedos.rotation.x = m.cerrada ? 1.1 : 0;
      m.visual.userData.dedos.position.y = m.cerrada ? -0.04 : -0.012;
      if (m.nuevoAgarre) {
        m.nuevoAgarre = false;
        this.vibrar(m, 0.5, 40);
      }
    }
  }

  vibrar(mano, fuerza, ms) {
    const actuador = mano.fuente?.gamepad?.hapticActuators?.[0];
    if (actuador && typeof actuador.pulse === 'function') actuador.pulse(fuerza, ms).catch(() => {});
  }

  vibrarTodas(fuerza, ms) {
    for (const m of this.lista) this.vibrar(m, fuerza, ms);
  }
}
