// Pistola lectora de códigos. Con el escáner en la mano, el gatillo de esa mano enciende el haz; al apretar
// del todo se hace la lectura: un rayo desde la ventana del lector contra las bolsas y los contenedores.
//   - etiqueta legible, de frente  -> lectura correcta: código, descripción y ubicación en la pantalla;
//   - bolsa vista de costado       -> «apuntá a la etiqueta»;
//   - bolsa dañada o sin etiqueta  -> «etiqueta ilegible» (es una discrepancia para informar);
//   - nada dentro del alcance      -> «sin lectura».
import * as THREE from 'three';

export const ALCANCE_ESCANER = 1.6;

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();

export class Escaner {
  /**
   * @param {object} o
   * @param {import('./flotantes.js').Flotante} o.flotante  El objeto escáner.
   * @param {THREE.Mesh|null} o.pantalla                   Pantalla del lector (canvas).
   * @param {import('./inventario.js').Inventario} o.inventario
   * @param {(lectura: object) => void} [o.alLeer]
   * @param {{tocar: (n: string) => void}} [o.sonido]
   */
  constructor({ flotante, pantalla = null, inventario, alLeer = null, sonido = null }) {
    this.flotante = flotante;
    this.pantalla = pantalla;
    this.inventario = inventario;
    this.alLeer = alLeer;
    this.sonido = sonido;
    this.ultima = null;
    this.lecturas = 0;
    this._hazActivo = 0;
    this.haz = new THREE.Mesh(
      new THREE.BoxGeometry(0.003, 0.003, 1).translate(0, 0, -0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.haz.visible = false;
    if (flotante.agarre && flotante.agarre.punta) this.haz.position.copy(flotante.agarre.punta);
    flotante.malla.add(this.haz);
    this._dibujar();
  }

  /** Origen y dirección del haz en el mundo. */
  rayo(origen, direccion) {
    const a = this.flotante.agarre;
    this.flotante.malla.updateWorldMatrix(true, false);
    origen.copy(a.punta).applyMatrix4(this.flotante.malla.matrixWorld);
    direccion.copy(a.direccion).transformDirection(this.flotante.malla.matrixWorld);
  }

  /** Hace una lectura ahora. Devuelve { ok, motivo, codigo, ... }. */
  leer() {
    this.rayo(_o, _d);
    const v = this.inventario.apuntar(_o, _d, ALCANCE_ESCANER);
    let l;
    if (!v) {
      l = { ok: false, motivo: 'sin_lectura', texto: 'SIN LECTURA', detalle: 'Acercate a menos de 1,6 m' };
    } else if (v.tipo === 'contenedor') {
      const dat = v.contenedor.datos;
      dat.escaneado = true;
      l = { ok: true, tipo: 'contenedor', codigo: dat.codigo, descripcion: dat.descripcion, ubicacion: this.inventario.ubicacionDe(v.contenedor), destino: dat.destino, contenedor: v.contenedor };
    } else if (!v.bulto.legible) {
      l = { ok: false, motivo: 'ilegible', texto: 'ETIQUETA ILEGIBLE', detalle: 'Informá la discrepancia', bulto: v.bulto };
    } else if (!v.frente) {
      l = { ok: false, motivo: 'sin_etiqueta', texto: 'NO VEO LA ETIQUETA', detalle: 'Apuntá al frente del bulto', bulto: v.bulto };
    } else {
      v.bulto.escaneado = true;
      l = { ok: true, tipo: 'bulto', codigo: v.bulto.codigo, descripcion: v.bulto.descripcion, ubicacion: v.bulto.ubicacion, categoria: v.bulto.categoria, pesoKg: v.bulto.pesoKg, bulto: v.bulto };
    }
    l.distancia = v ? v.distancia : ALCANCE_ESCANER;
    this.ultima = l;
    this.lecturas++;
    this._largoHaz = l.distancia;
    this._dibujar();
    if (this.sonido) this.sonido.tocar(l.ok ? 'ok' : 'error');
    if (this.alLeer) this.alLeer(l);
    return l;
  }

  /** Cada cuadro mientras una mano lo sostiene. */
  usar(mano) {
    this._hazActivo = mano.gatillo > 0.1 ? 0.12 : this._hazActivo;
    if (mano.gatilloNuevo) return this.leer();
    return null;
  }

  actualizar(dt) {
    if (this._hazActivo > 0) {
      this._hazActivo -= dt;
      this.rayo(_o, _d);
      const v = this.inventario.apuntar(_o, _d, ALCANCE_ESCANER);
      this.haz.scale.z = v ? Math.max(0.02, v.distancia) : ALCANCE_ESCANER;
      // el haz sale por la ventana: se orienta según la dirección local del lector
      this.haz.visible = true;
    } else if (this.haz.visible) {
      this.haz.visible = false;
    }
  }

  _dibujar() {
    if (!this.pantalla) return;
    const { ctx, canvas, textura } = this.pantalla.userData.lienzo;
    const l = this.ultima;
    ctx.fillStyle = !l ? '#0b1a2b' : l.ok ? '#0c3d1e' : '#4a1210';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = !l ? '#74acdf' : l.ok ? '#7dffa8' : '#ffb4a8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(!l ? 'LISTO' : l.ok ? l.codigo : l.texto.split(' ').slice(0, 2).join(' '), canvas.width / 2, 40);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#e8eef6';
    const linea = !l ? 'Apuntá y apretá' : l.ok ? l.ubicacion : l.detalle;
    ctx.fillText(linea.slice(0, 22), canvas.width / 2, 78);
    if (l && l.ok && l.destino) ctx.fillText(`→ ${l.destino}`, canvas.width / 2, 108);
    textura.needsUpdate = true;
  }
}
