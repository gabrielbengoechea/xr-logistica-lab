// Interfaz para realidad virtual: paneles flotantes dibujados en un canvas, con botones grandes.
// Se usan de dos maneras, las dos con respuesta visual y sonora:
//   - tocando el botón con la punta del índice (cualquier mano);
//   - apuntando con una mano que no lleva herramienta y apretando su gatillo (rayo con puntero).
// En la compu, con el clic del mouse.
// Estética: gris técnico, blanco, azul y celeste, con amarillo de seguridad para lo que pide atención.
import * as THREE from 'three';

export const COLORES = {
  fondo: '#111a26', panel: '#1a2636', borde: '#3a6ea5', azul: '#0038a8', celeste: '#74acdf', blanco: '#f2f5f8',
  gris: '#93a1b3', amarillo: '#fcd116', verde: '#3ecf6e', rojo: '#ff6b5e', apagado: '#3a4656',
};

const _inv = new THREE.Matrix4();
const _o = new THREE.Vector3();
const _oLocal = new THREE.Vector3();
const _dLocal = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _esc = new THREE.Vector3();

/** Parte un texto en renglones que entren en `ancho` píxeles. */
export function renglones(ctx, texto, ancho) {
  const out = [];
  for (const parrafo of String(texto).split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(' ')) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (ctx.measureText(prueba).width > ancho && linea) { out.push(linea); linea = palabra; } else linea = prueba;
    }
    out.push(linea);
  }
  return out;
}

export function rectRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class PanelVR {
  /**
   * @param {object} o
   * @param {number} o.ancho  Metros.
   * @param {number} o.alto   Metros.
   * @param {number} o.px     Píxeles de ancho del canvas (el alto sale de la proporción).
   * @param {(ctx: CanvasRenderingContext2D, panel: PanelVR) => void} o.dibujar  Dibuja el contenido y arma `panel.botones`.
   * @param {THREE.Mesh} [o.malla]  Malla ya existente con `userData.lienzo` (la pantalla de la tablet).
   */
  constructor({ ancho, alto, px, dibujar, malla = null, nombre = 'Panel' }) {
    this.ancho = ancho;
    this.alto = alto;
    this.dibujar = dibujar;
    this.nombre = nombre;
    /** @type {{id: string, x: number, y: number, w: number, h: number, texto?: string, accion: () => void, activo?: boolean, estilo?: string, invisible?: boolean}[]} */
    this.botones = [];
    this.sobre = '';             // id del botón bajo el puntero
    this.apretado = '';          // id del último botón accionado (destello)
    this._destello = 0;
    this.sucio = true;
    this.interactivo = true;
    if (malla) {
      this.malla = malla;
      this.lienzo = malla.userData.lienzo;
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = Math.round(px * alto / ancho);
      const textura = new THREE.CanvasTexture(canvas);
      textura.colorSpace = THREE.SRGBColorSpace;
      this.lienzo = { canvas, ctx: canvas.getContext('2d'), textura };
      this.malla = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: textura }));
    }
    this.malla.name = nombre;
    this.malla.userData.panel = this;
  }

  /** Agrega un botón durante `dibujar`. Coordenadas en píxeles del canvas. */
  boton(id, x, y, w, h, texto, accion, { activo = true, estilo = 'normal', invisible = false } = {}) {
    this.botones.push({ id, x, y, w, h, texto, accion, activo, estilo, invisible });
  }

  redibujar() {
    const { ctx, canvas, textura } = this.lienzo;
    this.botones.length = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    this.dibujar(ctx, this);
    for (const b of this.botones) {
      if (b.invisible) continue;
      const encima = this.sobre === b.id && b.activo;
      const destello = this.apretado === b.id && this._destello > 0;
      rectRedondo(ctx, b.x, b.y, b.w, b.h, Math.min(14, b.h / 3));
      ctx.fillStyle = !b.activo ? COLORES.apagado : destello ? COLORES.blanco : b.estilo === 'aviso' ? COLORES.amarillo : encima ? COLORES.celeste : COLORES.azul;
      ctx.fill();
      ctx.lineWidth = encima ? 5 : 2;
      ctx.strokeStyle = encima ? COLORES.blanco : COLORES.celeste;
      ctx.stroke();
      ctx.fillStyle = !b.activo ? COLORES.gris : destello || b.estilo === 'aviso' || encima ? '#0b1420' : COLORES.blanco;
      ctx.font = `bold ${Math.round(Math.min(b.h * 0.42, 34))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.texto || '', b.x + b.w / 2, b.y + b.h / 2 + 1);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    textura.needsUpdate = true;
    this.sucio = false;
    void canvas;
  }

  /** Botón en la coordenada local (x a la derecha, y arriba, en metros desde el centro). */
  botonEn(x, y) {
    const c = this.lienzo.canvas;
    const px = (x / this.ancho + 0.5) * c.width;
    const py = (0.5 - y / this.alto) * c.height;
    for (let i = this.botones.length - 1; i >= 0; i--) {
      const b = this.botones[i];
      if (b.activo && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b;
    }
    return null;
  }

  /** Corta un rayo del mundo con el panel. Deja el punto local en `out`. Devuelve la distancia o Infinity. */
  cortar(origen, direccion, out) {
    this.malla.updateWorldMatrix(true, false);
    _inv.copy(this.malla.matrixWorld).invert();
    // temporales propios: `origen` y `direccion` pueden ser los temporales del sistema de paneles
    _oLocal.copy(origen).applyMatrix4(_inv);
    _dLocal.copy(direccion).transformDirection(_inv);
    if (_dLocal.z > -1e-4 || _oLocal.z <= 0) return Infinity;  // solo desde el frente
    const t = -_oLocal.z / _dLocal.z;
    out.copy(_oLocal).addScaledVector(_dLocal, t);
    if (Math.abs(out.x) > this.ancho / 2 || Math.abs(out.y) > this.alto / 2) return Infinity;
    // la malla puede estar escalada (animación de entrada): t está en unidades locales
    return t * _esc.setFromMatrixScale(this.malla.matrixWorld).z;
  }

  accionar(b, sonido) {
    this.apretado = b.id;
    this._destello = 0.18;
    this.sucio = true;
    if (sonido) sonido.tocar('clic');
    b.accion();
  }
}

export class SistemaPaneles {
  /** @param {THREE.Scene} escena @param {{tocar: (n: string) => void}|null} sonido */
  constructor(escena, sonido = null) {
    this.escena = escena;
    this.sonido = sonido;
    /** @type {PanelVR[]} */
    this.paneles = [];
    this.alcance = 3.0;
    this._estado = new WeakMap();
    this.laser = new THREE.Mesh(
      new THREE.BoxGeometry(0.0025, 0.0025, 1).translate(0, 0, -0.5),
      new THREE.MeshBasicMaterial({ color: 0x74acdf, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.laser.visible = false;
    this.laser.frustumCulled = false;
    this.punto = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.punto.visible = false;
    escena.add(this.laser, this.punto);
  }

  agregar(panel) {
    if (!this.paneles.includes(panel)) this.paneles.push(panel);
    return panel;
  }

  quitar(panel) {
    const i = this.paneles.indexOf(panel);
    if (i >= 0) this.paneles.splice(i, 1);
  }

  _visible(panel) {
    for (let o = panel.malla; o; o = o.parent) if (!o.visible) return false;
    return panel.interactivo && !!panel.malla.parent;
  }

  /** Panel y botón que corta un rayo. */
  apuntar(origen, direccion, out) {
    let mejor = null;
    let tMejor = this.alcance;
    for (const p of this.paneles) {
      if (!this._visible(p)) continue;
      const t = p.cortar(origen, direccion, _p);
      if (t < tMejor) { tMejor = t; mejor = p; out.copy(_p); }
    }
    return mejor ? { panel: mejor, distancia: tMejor, boton: mejor.botonEn(out.x, out.y) } : null;
  }

  /**
   * @param {number} dt
   * @param {object[]} manos  Manos de js/manos.js. Escribe `mano.apunta` y `mano.gatilloUsado`.
   * @param {{origen: THREE.Vector3, direccion: THREE.Vector3, clic: boolean}|null} mouse  Puntero de escritorio.
   */
  actualizar(dt, manos, mouse = null) {
    const sobre = new Map();
    this.laser.visible = false;
    this.punto.visible = false;
    const local = new THREE.Vector3();
    for (const m of manos) {
      m.apunta = false;
      m.gatilloUsado = false;
      let e = this._estado.get(m);
      if (!e) { e = { espera: 0, dentro: null }; this._estado.set(m, e); }
      e.espera = Math.max(0, e.espera - dt);
      // --- toque con la punta del índice
      let tocado = null;
      if (m.punta) {
        for (const p of this.paneles) {
          if (!this._visible(p) || (m.sostiene && m.sostiene.malla === p.malla.parent)) continue;
          p.malla.updateWorldMatrix(true, false);
          local.copy(m.punta).applyMatrix4(_inv.copy(p.malla.matrixWorld).invert());
          if (Math.abs(local.x) > p.ancho / 2 || Math.abs(local.y) > p.alto / 2 || local.z > 0.03 || local.z < -0.03) continue;
          const b = p.botonEn(local.x, local.y);
          if (b) sobre.set(p, b.id);
          m.apunta = true;
          if (b && local.z < 0.012) tocado = { p, b };
        }
      }
      if (tocado) {
        if (e.dentro !== tocado.b.id && e.espera === 0) { tocado.p.accionar(tocado.b, this.sonido); e.espera = 0.35; }
        e.dentro = tocado.b.id;
        continue;
      }
      e.dentro = null;
      // --- rayo: solo la mano libre (la que lleva una herramienta usa su gatillo para la herramienta)
      if (m.sostiene || m.agarre || !m.apuntador) continue;
      m.apuntador.updateWorldMatrix(true, false);
      _o.setFromMatrixPosition(m.apuntador.matrixWorld);
      _d.set(0, 0, -1).transformDirection(m.apuntador.matrixWorld);
      if (m.virtual) continue;                                  // en la compu apunta el mouse
      const v = this.apuntar(_o, _d, local);
      if (!v) continue;
      m.apunta = true;
      if (v.boton) sobre.set(v.panel, v.boton.id);
      this.laser.visible = true;
      this.laser.position.copy(_o);
      this.laser.lookAt(_p.copy(_o).addScaledVector(_d, 1));
      this.laser.scale.z = v.distancia;
      this.punto.visible = true;
      this.punto.position.copy(_o).addScaledVector(_d, v.distancia - 0.004);
      if (m.gatilloNuevo) {
        // solo un gatillo sobre un botón es «del panel»: apuntando al fondo del mapa, el izquierdo lo cierra igual
        if (v.boton) { m.gatilloUsado = true; v.panel.accionar(v.boton, this.sonido); }
      }
    }
    if (mouse) {
      const v = this.apuntar(mouse.origen, mouse.direccion, local);
      mouse.sobrePanel = !!v;
      if (v && v.boton) {
        sobre.set(v.panel, v.boton.id);
        if (mouse.clic) v.panel.accionar(v.boton, this.sonido);
      }
    }
    for (const p of this.paneles) {
      const id = sobre.get(p) || '';
      if (id !== p.sobre) { p.sobre = id; p.sucio = true; }
      if (p._destello > 0) { p._destello -= dt; if (p._destello <= 0) p.sucio = true; }
      if (p.sucio && this._visible(p)) p.redibujar();
    }
  }
}
