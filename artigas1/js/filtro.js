// Cambio del filtro de CO₂ en el rack de soporte vital del taller (Tacuarembó).
//
// El kit ya traía la escena preparada: el filtro instalado marca 12 % («CAMBIAR») en la pantalla de soporte
// vital y hay tres de repuesto en el rack TAC-B1. Acá eso se vuelve una tarea:
//   1. abrir la puerta del filtro: mano libre en la manija y gatillo (se abre girando sobre la bisagra);
//   2. sacar el filtro gastado (grip);
//   3. poner uno de repuesto: soltarlo junto al alojamiento lo encastra (volver a poner el gastado es un error);
//   4. cerrar la puerta, con el gatillo en la manija.
// En el kit el cartucho queda detrás del casco, adentro del rack: no se vería. Acá va en un riel: al abrir la
// puerta sale hacia el pasillo (y al cerrarla vuelve a entrar), así se lo ve y se lo puede tomar. Con la
// puerta cerrada no se puede tomar. La pantalla de soporte vital (encima del rack) muestra el estado y es el
// terminal de la actividad.
import * as THREE from 'three';
import { COLORES, PanelVR } from './paneles.js';

/** Pantalla de soporte vital del kit (metros, del GLB). */
export const PANTALLA_SOPORTE = { posicion: [-1.188, 0.195, 4.925], ancho: 0.5, alto: 0.124, giroY: Math.PI / 2 };
export const ALCANCE_MANIJA = 0.15;
export const ALCANCE_ALOJAMIENTO = 0.18;
const APERTURA = THREE.MathUtils.degToRad(105);         // la puerta gira hacia el pasillo
const TIEMPO_PUERTA = 0.5;
/** Largo de la puerta desde la bisagra (la manija está cerca del borde libre). */
const MANIJA_LOCAL = new THREE.Vector3(0.53, 0, 0.04);
/** Cuánto sale el cartucho hacia el pasillo (+X) cuando la puerta está abierta. */
const SALIDA_RIEL = 0.45;

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const EJE_Y = new THREE.Vector3(0, 1, 0);

export class CambioFiltro {
  /**
   * @param {object} o
   * @param {THREE.Mesh} o.puerta   Puerta del filtro (origen en la bisagra).
   * @param {object[]} o.filtros    Flotantes: el instalado (datos.gastado) y los de repuesto.
   */
  constructor({ puerta, filtros }) {
    this.puerta = puerta;
    this.filtros = filtros;
    this.giroCerrada = puerta.quaternion.clone();
    this.abierta = false;
    this.apertura = 0;                                    // 0 cerrada, 1 abierta
    const instalado = filtros.find((f) => f.datos.gastado);
    // el alojamiento queda afuera del casco, sobre el riel (ver arriba)
    this.alojamiento = { posicion: instalado.posicion.clone().add(new THREE.Vector3(SALIDA_RIEL, 0, 0)), giro: instalado.malla.quaternion.clone() };
    instalado.posicion.copy(this.alojamiento.posicion);
    this.enAlojamiento = instalado;
    this.reposos = new Map(filtros.map((f) => [f, { posicion: f.posicion.clone(), giro: f.malla.quaternion.clone() }]));
    /** @type {((tipo: string, datos: object) => void) | null} */
    this.alEvento = null;
    this._bloquear();
  }

  /** Lo que muestra la pantalla: porcentaje del filtro que está puesto (o null si no hay ninguno). */
  get carga() {
    const f = this.enAlojamiento;
    return !f ? null : f.datos.gastado ? 12 : 100;
  }

  /** Con la puerta cerrada, el cartucho está adentro: no se ve ni se puede tomar. */
  _bloquear() {
    const f = this.enAlojamiento;
    if (!f) return;
    f.bloqueado = this.apertura < 0.8;
    f.oculto = this.apertura < 0.5;
  }

  /** Vuelve todo como vino en el kit: gastado adentro, repuestos en el rack, puerta cerrada. */
  preparar() {
    for (const f of this.filtros) {
      if (f.mano) { f.mano.sostiene = null; f.mano = null; }
      const r = this.reposos.get(f);
      f.posicion.copy(r.posicion);
      f.malla.quaternion.copy(r.giro);
      f.casa.copy(r.posicion);
      f.velocidad.set(0, 0, 0);
      f.fijo = true;
      f.libre = false;
      f.bloqueado = false;
      f.oculto = false;
    }
    this.enAlojamiento = this.filtros.find((f) => f.datos.gastado);
    this.abierta = false;
    this.apertura = 0;
    this.puerta.quaternion.copy(this.giroCerrada);
    this._bloquear();
  }

  /** Manija en el mundo. */
  manija(out = new THREE.Vector3()) {
    this.puerta.updateMatrixWorld(true);
    return out.copy(MANIJA_LOCAL).applyMatrix4(this.puerta.matrixWorld);
  }

  alternarPuerta() {
    this.abierta = !this.abierta;
    if (this.alEvento) this.alEvento('filtro_puerta', { abierta: this.abierta, conFiltro: !!this.enAlojamiento, gastado: !!(this.enAlojamiento && this.enAlojamiento.datos.gastado) });
  }

  /** Un filtro que se tomó: si era el del alojamiento, queda libre. */
  tomado(f) {
    if (f !== this.enAlojamiento) return;
    this.enAlojamiento = null;
    f.oculto = false;
    if (this.alEvento) this.alEvento('filtro_sacado', { gastado: !!f.datos.gastado, codigo: f.datos.codigo });
  }

  /** Un filtro que se soltó: junto al alojamiento libre y con la puerta abierta, encastra. Devuelve si encastró. */
  soltado(f) {
    if (this.enAlojamiento || this.apertura < 0.8 || f.posicion.distanceTo(this.alojamiento.posicion) > ALCANCE_ALOJAMIENTO) return false;
    f.posicion.copy(this.alojamiento.posicion);
    f.malla.quaternion.copy(this.alojamiento.giro);
    f.casa.copy(f.posicion);
    f.velocidad.set(0, 0, 0);
    f.fijo = true;
    this.enAlojamiento = f;
    this._bloquear();
    if (this.alEvento) this.alEvento('filtro_puesto', { gastado: !!f.datos.gastado, codigo: f.datos.codigo });
    return true;
  }

  /**
   * Cada cuadro, después de los paneles y antes de la entrada: el gatillo de una mano libre junto a la manija
   * abre o cierra la puerta (y no abre el mapa).
   */
  actualizar(dt, manos) {
    const meta = this.abierta ? 1 : 0;
    if (this.apertura !== meta) {
      this.apertura = THREE.MathUtils.clamp(this.apertura + Math.sign(meta - this.apertura) * dt / TIEMPO_PUERTA, 0, 1);
      const k = this.apertura * this.apertura * (3 - 2 * this.apertura);
      this.puerta.quaternion.copy(_q.setFromAxisAngle(EJE_Y, -APERTURA * k)).multiply(this.giroCerrada);
      this._bloquear();
    }
    const manija = this.manija(_v);
    for (const m of manos) {
      if (m.sostiene || m.ocupada || m.agarre || m.gatilloUsado || !m.gatilloNuevo) continue;
      if (m.posicion.distanceTo(manija) > ALCANCE_MANIJA) continue;
      m.gatilloUsado = true;
      this.alternarPuerta();
    }
  }
}

/**
 * Pantalla de soporte vital (sobre la del kit): estado del filtro y terminal de la actividad.
 * @param {CambioFiltro} c
 * @param {{estado: () => string, puedeIniciar: () => boolean, iniciar: () => void, pausar: () => void,
 *   reanudar: () => void, abandonar: () => void}} acciones
 */
export function crearPantallaSoporte(c, acciones) {
  const d = PANTALLA_SOPORTE;
  const W = 1200, H = Math.round(W * d.alto / d.ancho);
  const panel = new PanelVR({ ancho: d.ancho, alto: d.alto, px: W, nombre: 'Terminal_filtro', dibujar: (ctx, p) => {
    const estado = acciones.estado();
    const carga = c.carga;
    ctx.fillStyle = COLORES.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('SOPORTE VITAL · FILTRO DE CO₂', 24, 56);
    ctx.font = 'bold 72px monospace';
    ctx.fillStyle = carga === null ? COLORES.rojo : carga < 50 ? COLORES.amarillo : COLORES.verde;
    ctx.fillText(carga === null ? 'SIN FILTRO' : `${carga} %`, 24, 150);
    ctx.font = '32px sans-serif';
    ctx.fillStyle = COLORES.gris;
    ctx.fillText(carga === null ? 'Poné uno de repuesto (rack TAC-B1)' : carga < 50 ? 'CAMBIAR · repuestos en el rack TAC-B1' : 'Filtro nuevo instalado', 24, 210);
    ctx.fillText(`Puerta: ${c.abierta ? 'abierta' : 'cerrada'}`, 24, 256);
    const x0 = 760, w = W - x0 - 24;
    if (estado === 'ACTIVA') {
      p.boton('pausar', x0, 40, w / 2 - 6, 96, 'PAUSAR', acciones.pausar);
      p.boton('dejar', x0 + w / 2 + 6, 40, w / 2 - 6, 96, 'DEJAR', acciones.abandonar);
    } else if (estado === 'PAUSADA') {
      p.boton('seguir', x0, 40, w, 96, 'SEGUIR', acciones.reanudar, { estilo: 'aviso' });
    } else {
      p.boton('iniciar', x0, 40, w, 96, estado === 'COMPLETADA' || estado === 'FALLIDA' ? 'REPETIR' : 'CAMBIAR FILTRO', acciones.iniciar, { activo: acciones.puedeIniciar(), estilo: 'aviso' });
    }
  } });
  panel.malla.position.set(...d.posicion);
  panel.malla.rotation.y = d.giroY;
  return panel;
}
