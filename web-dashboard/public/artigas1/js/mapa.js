// Mapa de la Estación Artigas-1: un panel flotante que se abre con el gatillo del índice izquierdo.
// Dibuja la estación de costado, a escala (carguero a la izquierda, Tacuarembó a la derecha, la Cúpula abajo
// del Nodo y los paneles solares, la antena y los radiadores por fuera). Muestra dónde está el astronauta,
// qué módulos visitó y dónde hay actividades. Cada módulo se selecciona; desde ahí se pide la guía (flechas
// por el camino real), el traslado con fundido o el inicio de una actividad.
import * as THREE from 'three';
import { COLORES, PanelVR, rectRedondo, renglones } from './paneles.js';
import { ESTADO, ETIQUETA_ESTADO } from './actividades.js';
import { LUGAR, LUGARES } from './navegacion.js';

const ESCALA = 40;                      // píxeles por metro
const X0 = 46;
const Y0 = 372;
const px = (z) => X0 + (z + 12.4) * ESCALA;
const py = (y) => Y0 - y * ESCALA;

/** Rectángulo de cada módulo en el mapa: [z0, z1, y0, y1]. */
const CAJAS = {
  carguero: [-11.62, -8.78, -1.05, 1.05], colonia: [-8.68, -4.94, -1.2, 1.2], rivera: [-4.86, 0.62, -1.4, 1.4],
  nodo: [0.70, 3.50, -1.2, 1.2], tacuarembo: [3.60, 6.86, -1.4, 1.4], cupula: [1.25, 2.97, -2.7, -1.3],
};
const ICONOS = { esclusa: [2.11, 0.0], junta_solar: [-6.8, 3.15], antena: [2.11, 3.55], conector_radiador: [5.2, 2.35] };

const _v = new THREE.Vector3();
const _p = new THREE.Vector3();

export class MapaEstacion {
  /**
   * @param {object} o
   * @param {import('./paneles.js').SistemaPaneles} o.paneles
   * @param {THREE.Scene} o.escena
   * @param {import('./navegacion.js').Navegacion} o.navegacion
   * @param {import('./actividades.js').GestorActividades} o.gestor
   * @param {{guiar: (id: string) => void, trasladar: (id: string) => void, iniciar: (id: string) => void, cancelarGuia: () => void}} o.acciones
   * @param {() => {afuera: boolean}} o.estado
   */
  constructor({ paneles, escena, navegacion, gestor, acciones, estado }) {
    this.paneles = paneles;
    this.escena = escena;
    this.navegacion = navegacion;
    this.gestor = gestor;
    this.acciones = acciones;
    this.estado = estado;
    this.abierto = false;
    this.seleccion = '';
    this._escala = 0;
    this._meta = 0;
    this._reloj = 0;
    this._cabeza = new THREE.Vector3();
    this._mira = new THREE.Vector3(0, 0, -1);
    this.panel = new PanelVR({ ancho: 0.96, alto: 0.60, px: 1280, nombre: 'Mapa_Estacion', dibujar: (ctx, p) => this._dibujar(ctx, p) });
    this.panel.malla.visible = false;
    this.panel.malla.renderOrder = 6;
    escena.add(this.panel.malla);
    paneles.agregar(this.panel);
  }

  /** Abre el mapa delante de la cabeza, a una distancia cómoda y sin meterlo en una pared. */
  abrir(camara, estructura) {
    camara.getWorldPosition(this._cabeza);
    camara.getWorldDirection(_v);
    let distancia = 0.85;
    if (estructura) {
      // si a esa distancia hay una pared, se acerca (nunca a menos de 50 cm)
      for (; distancia > 0.5; distancia -= 0.07) {
        _p.copy(this._cabeza).addScaledVector(_v, distancia);
        if (estructura.puntoMasCercano(_p, 0.3, new THREE.Vector3()) === Infinity) break;
      }
    }
    const m = this.panel.malla;
    m.position.copy(this._cabeza).addScaledVector(_v, distancia);
    m.up.copy(camara.up).applyQuaternion(camara.getWorldQuaternion(new THREE.Quaternion()));
    m.position.addScaledVector(m.up, -0.06);
    m.lookAt(this._cabeza);
    m.visible = true;
    this.abierto = true;
    this._meta = 1;
    this.seleccion = this.seleccion || this.navegacion.actual || 'rivera';
    this.panel.sucio = true;
  }

  cerrar() {
    this.abierto = false;
    this._meta = 0;
  }

  alternar(camara, estructura) {
    if (this.abierto) this.cerrar(); else this.abrir(camara, estructura);
  }

  seleccionar(id) {
    this.seleccion = id;
    this.panel.sucio = true;
  }

  /** @param {number} dt @param {THREE.Vector3} cabeza @param {THREE.Vector3} mira */
  actualizar(dt, cabeza, mira) {
    const m = this.panel.malla;
    if (this._escala !== this._meta) {
      this._escala = THREE.MathUtils.clamp(this._escala + Math.sign(this._meta - this._escala) * dt / 0.18, 0, 1);
      const s = this._escala * this._escala * (3 - 2 * this._escala);
      m.scale.setScalar(Math.max(s, 0.001));
      if (this._escala === 0) m.visible = false;
    }
    if (!this.abierto) return;
    this._cabeza.copy(cabeza);
    this._mira.copy(mira);
    if (m.position.distanceTo(cabeza) > 2.6) { this.cerrar(); return; }   // el astronauta se fue: se cierra solo
    this._reloj += dt;
    if (this._reloj > 0.25) { this._reloj = 0; this.panel.sucio = true; }
  }

  _estadoDe(id) {
    if (this.navegacion.actual === id) return 'actual';
    return this.navegacion.visitados.has(id) ? 'visitado' : 'nuevo';
  }

  _actividadesEn(id) {
    return this.gestor.lista().filter((a) => a.def.modulo === id);
  }

  _dibujar(ctx, panel) {
    const W = 1280;
    const H = 800;
    const afuera = this.estado().afuera;
    ctx.fillStyle = COLORES.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = COLORES.borde;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = COLORES.azul;
    ctx.fillRect(6, 6, W - 12, 62);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('ESTACIÓN ARTIGAS-1 · MAPA', 28, 50);
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'right';
    const donde = afuera ? 'Exterior' : (LUGAR[this.navegacion.actual]?.nombre || '');
    ctx.fillText(`Estás en: ${donde}`, W - 28, 48);
    ctx.textAlign = 'left';

    // ---- exterior (detrás): paneles solares, viga, antena, radiadores
    ctx.strokeStyle = '#51607a';
    ctx.fillStyle = '#18233a';
    ctx.lineWidth = 2;
    for (const s of [1, -1]) {
      const x = px(-6.8);
      const y0 = py(s * 1.7);
      const y1 = py(s * 6.9);
      ctx.fillRect(x - 34, Math.min(y0 + s * -46, y1), 68, Math.abs(y1 - y0) - 46);
      ctx.strokeRect(x - 34, Math.min(y0 + s * -46, y1), 68, Math.abs(y1 - y0) - 46);
      for (let k = 1; k < 5; k++) {
        const yy = y0 - s * (46 + k * (Math.abs(y1 - y0) - 46) / 5);
        ctx.beginPath(); ctx.moveTo(x - 34, yy); ctx.lineTo(x + 34, yy); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - s * 46); ctx.stroke();
    }
    ctx.strokeStyle = '#6b7a94';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(px(-8.0), py(2.25)); ctx.lineTo(px(6.5), py(2.25)); ctx.stroke();   // viga dorsal
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px(2.11), py(3.4), 26, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();    // plato
    ctx.beginPath(); ctx.moveTo(px(2.11), py(2.3)); ctx.lineTo(px(2.11), py(3.05)); ctx.stroke();
    ctx.strokeRect(px(4.2), py(2.05), (6.2 - 4.2) * ESCALA, 12);                                      // radiador (de canto)

    // ---- módulos
    for (const [id, c] of Object.entries(CAJAS)) {
      const x = px(c[0]);
      const y = py(c[3]);
      const w = (c[1] - c[0]) * ESCALA;
      const h = (c[3] - c[2]) * ESCALA;
      const est = this._estadoDe(id);
      rectRedondo(ctx, x, y, w, h, id === 'cupula' ? 22 : 12);
      ctx.fillStyle = est === 'actual' ? COLORES.celeste : est === 'visitado' ? '#1d3f7a' : '#2a3342';
      ctx.fill();
      const elegido = this.seleccion === id;
      const encima = panel.sobre === `lugar:${id}`;
      ctx.lineWidth = elegido ? 6 : encima ? 4 : 2;
      ctx.strokeStyle = elegido ? COLORES.amarillo : encima ? COLORES.blanco : COLORES.celeste;
      ctx.stroke();
      ctx.fillStyle = est === 'actual' ? '#0b1420' : COLORES.blanco;
      ctx.font = `bold ${id === 'cupula' ? 17 : 21}px sans-serif`;
      ctx.textAlign = 'center';
      const nombre = LUGAR[id].nombre.replace('Carguero ', '');
      ctx.fillText(nombre, x + w / 2, y + h / 2 - (id === 'cupula' ? -6 : 4));
      if (id !== 'cupula') {
        ctx.font = '15px sans-serif';
        ctx.fillStyle = est === 'actual' ? '#0b1420' : COLORES.gris;
        ctx.fillText(LUGAR[id].rol.split(':')[0].split(' y ')[0], x + w / 2, y + h / 2 + 18);
      }
      // actividades del módulo: un punto por cada una
      this._actividadesEn(id).forEach((a, i) => {
        ctx.beginPath();
        ctx.arc(x + 16 + i * 22, y + 16, 8, 0, Math.PI * 2);
        ctx.fillStyle = a.estado === ESTADO.COMPLETADA ? COLORES.verde : a.estado === ESTADO.BLOQUEADA ? COLORES.apagado : a.estado === ESTADO.ACTIVA ? COLORES.blanco : COLORES.amarillo;
        ctx.fill();
        ctx.strokeStyle = '#0b1420';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      panel.boton(`lugar:${id}`, x, y, w, h, '', () => this.seleccionar(id), { invisible: true });
    }
    // escotillas entre módulos
    ctx.fillStyle = COLORES.amarillo;
    for (const z of [-8.73, -4.9, 0.66, 3.55]) ctx.fillRect(px(z) - 3, py(0.45), 6, 0.9 * ESCALA);
    ctx.fillRect(px(1.7), py(-1.2) - 3, 0.82 * ESCALA, 6);

    // ---- puntos del exterior y la esclusa
    for (const [id, [z, y]] of Object.entries(ICONOS)) {
      const x = px(z);
      const yy = py(y);
      const elegido = this.seleccion === id;
      ctx.beginPath();
      ctx.arc(x, yy, 19, 0, Math.PI * 2);
      ctx.fillStyle = id === 'esclusa' ? COLORES.amarillo : '#22304a';
      ctx.fill();
      ctx.lineWidth = elegido ? 6 : 2;
      ctx.strokeStyle = elegido ? COLORES.amarillo : panel.sobre === `lugar:${id}` ? COLORES.blanco : COLORES.celeste;
      ctx.stroke();
      ctx.fillStyle = id === 'esclusa' ? '#0b1420' : COLORES.blanco;
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText({ esclusa: 'EVA', junta_solar: 'SOL', antena: 'ANT', conector_radiador: 'RAD' }[id], x, yy + 5);
      panel.boton(`lugar:${id}`, x - 24, yy - 24, 48, 48, '', () => this.seleccionar(id), { invisible: true });
    }

    // ---- guía activa: destino resaltado
    if (this.navegacion.destino) {
      const d = LUGAR[this.navegacion.destino];
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = COLORES.amarillo;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px(this._cabeza.z), py(this._cabeza.y));
      ctx.lineTo(px(d.centro[2]), py(d.centro[1]));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // ---- «vos»: posición y hacia dónde mirás
    const vx = THREE.MathUtils.clamp(px(this._cabeza.z), 20, 840);
    const vy = THREE.MathUtils.clamp(py(this._cabeza.y), 90, 660);
    const ang = Math.atan2(-this._mira.y, this._mira.z);
    ctx.save();
    ctx.translate(vx, vy);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(20, 0); ctx.lineTo(-11, -11); ctx.lineTo(-5, 0); ctx.lineTo(-11, 11);
    ctx.closePath();
    ctx.fillStyle = COLORES.rojo;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORES.blanco;
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'left';

    // ---- referencias
    ctx.font = '17px sans-serif';
    let lx = 40;
    for (const [color, texto] of [[COLORES.celeste, 'Estás acá'], ['#1d3f7a', 'Visitado'], ['#2a3342', 'Sin visitar'], [COLORES.amarillo, 'Actividad disponible'], [COLORES.verde, 'Completada']]) {
      ctx.fillStyle = color;
      ctx.fillRect(lx, 742, 22, 22);
      ctx.strokeStyle = COLORES.celeste;
      ctx.lineWidth = 1;
      ctx.strokeRect(lx, 742, 22, 22);
      ctx.fillStyle = COLORES.gris;
      ctx.fillText(texto, lx + 30, 760);
      lx += 46 + ctx.measureText(texto).width;
    }

    // ---- ficha del lugar elegido
    const fx = 866;
    const fw = 392;
    ctx.fillStyle = COLORES.panel;
    rectRedondo(ctx, fx, 84, fw, 690, 14);
    ctx.fill();
    const l = LUGAR[this.seleccion] || LUGARES[0];
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(l.nombre, fx + 18, 128);
    ctx.fillStyle = COLORES.celeste;
    ctx.font = '21px sans-serif';
    ctx.fillText(l.rol, fx + 18, 158);
    ctx.fillStyle = COLORES.gris;
    ctx.font = '20px sans-serif';
    let y = 192;
    for (const r of renglones(ctx, l.contiene, fw - 36)) { ctx.fillText(r, fx + 18, y); y += 26; }
    const visitado = l.zona === 'exterior' ? this.navegacion.visitados.has('exterior') : this.navegacion.visitados.has(l.id) || l.id === 'esclusa';
    ctx.fillStyle = visitado ? COLORES.verde : COLORES.amarillo;
    ctx.fillText(l.zona === 'exterior' ? 'Se llega en caminata espacial' : visitado ? 'Ya lo visitaste' : 'Todavía no lo visitaste', fx + 18, y + 6);
    y += 40;
    for (const a of this._actividadesEn(l.id)) {
      ctx.fillStyle = COLORES.blanco;
      ctx.font = 'bold 21px sans-serif';
      ctx.fillText(a.def.titulo, fx + 18, y);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = a.estado === ESTADO.COMPLETADA ? COLORES.verde : a.estado === ESTADO.BLOQUEADA ? COLORES.gris : COLORES.amarillo;
      const extra = a.resultado && a.estado === ESTADO.COMPLETADA ? ` · ${a.resultado.puntaje} puntos` : '';
      ctx.fillText(ETIQUETA_ESTADO[a.estado] + extra, fx + 18, y + 24);
      const impedimento = this.gestor.impedimento(a.id);
      const enCurso = a.estado === ESTADO.ACTIVA || a.estado === ESTADO.PAUSADA;
      panel.boton(`act:${a.id}`, fx + 18, y + 36, fw - 36, 50, enCurso ? 'EN CURSO' : a.estado === ESTADO.COMPLETADA ? 'REPETIR' : 'INICIAR', () => this.acciones.iniciar(a.id), { activo: !impedimento, estilo: 'aviso' });
      y += 108;
    }
    const guiando = this.navegacion.destino === l.id;
    const mismoLado = (l.zona === 'exterior') === afuera;
    // de adentro hacia un punto exterior, la guía lleva a la esclusa; de afuera hacia adentro, también
    panel.boton('guiar', fx + 18, 610, fw - 36, 62, guiando ? 'CANCELAR GUÍA' : mismoLado ? 'GUIARME HASTA AHÍ' : 'GUIARME A LA ESCLUSA', () => (guiando ? this.acciones.cancelarGuia() : this.acciones.guiar(mismoLado ? l.id : 'esclusa')));
    panel.boton('ir', fx + 18, 688, (fw - 48) / 2, 62, 'TRASLADO', () => this.acciones.trasladar(l.id), { activo: l.zona === 'interior' && !afuera });
    panel.boton('cerrar', fx + 18 + (fw - 48) / 2 + 12, 688, (fw - 48) / 2, 62, 'CERRAR', () => this.cerrar());
  }
}
