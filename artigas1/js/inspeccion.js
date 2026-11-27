// Puntos de inspección y mantenimiento. Cada punto pide una herramienta: hay que tenerla en la mano, apuntarla
// (o apoyarla, según la herramienta) y mantener el gatillo de esa mano hasta completar el trabajo.
// Lo usan la actividad de mantenimiento del taller y las tareas de la caminata espacial.
import * as THREE from 'three';
import { COLORES, PanelVR } from './paneles.js';

/** Herramientas que trabajan a distancia (apuntando) y su alcance; el resto trabaja apoyando la punta. */
const A_DISTANCIA = { linterna: 1.2, inspector: 1.4, escaner: 1.4 };
const CONTACTO = 0.17;
const COS_APUNTAR = Math.cos(THREE.MathUtils.degToRad(15));
export const NOMBRE_HERRAMIENTA = { linterna: 'la linterna', inspector: 'el inspector', llave: 'la llave', destornillador: 'el destornillador', medidor: 'el medidor' };
/** Cómo se usa cada herramienta, para el cartel del punto. */
const USO = { linterna: 'APUNTÁ', inspector: 'APUNTÁ', escaner: 'APUNTÁ', llave: 'APOYÁ', destornillador: 'APOYÁ', medidor: 'APOYÁ' };
/** Cartel de cada punto: se ve desde esta distancia. */
const DISTANCIA_CARTEL = 4.0;
/** Segundos con la herramienta correcta al alcance, sin apretar el gatillo, antes de recordar cómo se usa. */
const ESPERA_PISTA = 1.4;

const _t = new THREE.Vector3();
const _d = new THREE.Vector3();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const PENDIENTE = new THREE.Color(0xfcd116);
const LISTO = new THREE.Color(0x3ecf6e);
const _cab = new THREE.Vector3();
const _arr = new THREE.Vector3();

/** Cartel chico sobre el punto: qué herramienta pide, cómo se usa y cuánto falta. Encima de todo. */
function crearCartel(p) {
  const panel = new PanelVR({ ancho: 0.26, alto: 0.08, px: 520, nombre: `Cartel_${p.id}`, dibujar: (ctx) => {
    const W = 520, H = 160;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10, 16, 26, 0.92)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = p.hecho ? COLORES.verde : COLORES.amarillo;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.hecho ? '✔ LISTO' : `${USO[p.herramienta] || 'USÁ'} ${p.herramienta.toUpperCase()}`, W / 2, 62);
    // barra de avance
    ctx.fillStyle = '#2a3140';
    ctx.fillRect(30, 96, W - 60, 34);
    ctx.fillStyle = p.hecho ? COLORES.verde : COLORES.amarillo;
    ctx.fillRect(30, 96, (W - 60) * (p.hecho ? 1 : p.avance), 34);
  } });
  panel.interactivo = false;
  panel.malla.material.depthTest = false;
  panel.malla.material.depthWrite = false;
  panel.malla.material.transparent = true;
  panel.malla.renderOrder = 989;
  panel.malla.visible = false;
  return panel;
}

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
    this.escena = escena;
  }

  agregar(id, posicion, herramienta, segundos, texto) {
    const p = { id, posicion: posicion.clone(), herramienta, segundos, texto, activo: false, avance: 0, hecho: false, espera: 0, pista: false, dibujado: -1, tiempoListo: 0 };
    p.cartel = crearCartel(p);
    this.escena.add(p.cartel.malla);
    this.puntos.push(p);
  }

  /** Enciende solo estos puntos (los de la actividad en curso) y los deja en cero. */
  activar(ids) {
    for (const p of this.puntos) {
      p.activo = ids.includes(p.id);
      p.avance = 0;
      p.hecho = false;
      p.espera = 0;
      p.pista = false;
      p.dibujado = -1;
      p.tiempoListo = 0;
      p.cartel.malla.visible = false;
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

  /** Cartel del punto: arriba del aro, del lado de la cabeza, mirando a los ojos. Se redibuja si cambia. */
  _cartel(p) {
    const c = p.cartel;
    const d = p.posicion.distanceTo(_cab);
    c.malla.visible = d < DISTANCIA_CARTEL && !(p.hecho && p.tiempoListo > 2.5);
    if (!c.malla.visible) return;
    _d.subVectors(_cab, p.posicion).normalize();
    c.malla.position.copy(p.posicion).addScaledVector(_d, 0.10).addScaledVector(_arr, 0.12);
    c.malla.up.copy(_arr);
    c.malla.lookAt(_cab);
    // de lejos se agranda un poco, para que se lea desde la entrada del módulo
    c.malla.scale.setScalar(THREE.MathUtils.clamp(d / 1.2, 1, 2.2));
    const estado = p.hecho ? 2 : Math.round(p.avance * 50) / 50;
    if (estado !== p.dibujado) { p.dibujado = estado; c.redibujar(); }
  }

  /** @param {number} dt @param {object[]} manos @param {THREE.Camera} camara */
  actualizar(dt, manos, camara) {
    this._tiempo += dt;
    let n = 0;
    camara.getWorldQuaternion(_q);
    camara.getWorldPosition(_cab);
    _arr.set(0, 1, 0).applyQuaternion(_q);
    for (const p of this.puntos) {
      if (!p.activo) { p.cartel.malla.visible = false; continue; }
      let trabajando = false;
      let listaSinGatillo = false;
      if (!p.hecho) {
        for (const m of manos) {
          if (!m.sostiene || !this._trabaja(m, p)) continue;
          if (m.gatillo < 0.5) {
            if (m.sostiene.tipo === p.herramienta) listaSinGatillo = true;
            continue;
          }
          if (m.sostiene.tipo === p.herramienta) {
            trabajando = true;
          } else if (m.gatilloNuevo && this._quejas.get(m) !== p.id) {
            this._quejas.set(m, p.id);
            this.avisar('herramienta_incorrecta', { punto: p.id, herramienta: m.sostiene.tipo, pide: p.herramienta });
          }
        }
        // con la herramienta correcta en su lugar pero sin apretar: una sola vez, se recuerda cómo se usa
        p.espera = listaSinGatillo ? p.espera + dt : 0;
        if (p.espera > ESPERA_PISTA && !p.pista) {
          p.pista = true;
          this.avisar('pista', { punto: p.id, herramienta: p.herramienta, texto: `Mantené apretado el gatillo con ${NOMBRE_HERRAMIENTA[p.herramienta] || p.herramienta}` });
        }
        p.avance = trabajando ? Math.min(1, p.avance + dt / p.segundos) : Math.max(0, p.avance - dt * 0.5);
        if (p.avance >= 1) {
          p.hecho = true;
          this.avisar('inspeccion', { punto: p.id, herramienta: p.herramienta });
        }
      } else {
        p.tiempoListo += dt;
      }
      this._cartel(p);
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
