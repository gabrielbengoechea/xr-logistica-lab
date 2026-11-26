// Minijuego A · Descarga del carguero Charrúa en Colonia.
//
// Es la recepción completa, con los equipos que ya traía el kit en Colonia:
//   1. Panel de presión (junto a la escotilla del carguero): IGUALAR la presión entre la bodega y Colonia y,
//      recién entonces, ABRIR. Mientras tanto la escotilla queda trabada.
//   2. Portal RFID (el aro de la escotilla): cada contenedor que pasa de la bodega a Colonia se lee solo. Su
//      pantalla muestra las lecturas y si el código está en el manifiesto.
//   3. Red de cuarentena (babor de Colonia): ahí va el contenedor que llegó y no está en el manifiesto
//      (sobrante). Poner ahí uno del manifiesto es un error.
//   4. Consola de recepción (estribor): muestra el manifiesto en vivo y es el terminal de la actividad. Cuando
//      todo lo que llegó está leído, se INFORMA EL FALTANTE (el código del manifiesto que no vino).
// Las pantallas del kit traían una imagen fija: los paneles de acá se ponen encima, a su medida.
import * as THREE from 'three';
import { COLORES, PanelVR, renglones } from './paneles.js';

/** Medidas y lugares de los equipos del kit en Colonia (del GLB; metros, Y arriba). */
export const COLONIA = {
  portal: { z: -8.51, radio: 0.70 },
  pantallaPresion: { posicion: [0.96, 0.07, -8.457], ancho: 0.24, alto: 0.12, giroY: 0 },
  pantallaRfid: { posicion: [0, -0.67, -8.397], ancho: 0.24, alto: 0.12, giroY: 0 },
  pantallaManifiesto: { posicion: [1.0045, 0.305, -6.36], ancho: 0.52, alto: 0.26, giroY: -Math.PI / 2 },
  // la red de cuarentena: caja donde queda lo que se suelta adentro
  cuarentena: { min: [-1.2, -0.81, -6.92], max: [-0.66, 0.11, -5.90], centro: [-0.95, -0.36, -6.41] },
};

/** Contenedores del turno (los del kit que ya estaban en Colonia y el carguero). El último no está en el manifiesto. */
export const CARGA_CARGUERO = [
  { codigo: 'CNT-0001', posicion: [0.35, -0.35, -9.3] },
  { codigo: 'CNT-0002', posicion: [-0.35, 0.35, -9.8] },
  { codigo: 'CNT-0003', posicion: [0.35, 0.35, -10.3] },
  { codigo: 'CNT-0004', posicion: [-0.35, -0.35, -10.8] },
];
/** El manifiesto: los tres primeros y uno que no vino. */
export const MANIFIESTO = ['CNT-0001', 'CNT-0002', 'CNT-0003', 'CNT-0099'];
export const FALTANTE = 'CNT-0099';
export const SOBRANTE = 'CNT-0004';
/** kPa de diferencia entre la bodega y Colonia al empezar, y segundos que tarda en igualarse. */
export const PRESION_INICIAL = 4.2;
export const SEGUNDOS_IGUALAR = 3;

const _caja = new THREE.Box3();

export class DescargaCarguero {
  /**
   * @param {object} o
   * @param {object[]} o.contenedores   Flotantes del inventario.
   * @param {{bloqueada: boolean}} o.escotilla  La escotilla Colonia–carguero.
   */
  constructor({ contenedores, escotilla }) {
    this.contenedores = contenedores;
    this.escotilla = escotilla;
    this.carga = [];                                     // flotantes del turno, en el orden de CARGA_CARGUERO
    this.presion = 0;                                    // kPa de diferencia (0: igualada)
    this.igualando = false;
    this.abierta = true;
    this.leidos = [];                                    // códigos que pasaron por el portal, en orden
    this.ultima = null;                                  // { codigo, manifestado }
    this._destello = 0;
    this.activa = false;
    this.faltanteInformado = false;
    /** @type {((f: object, manifestado: boolean) => void) | null} */
    this.alLeer = null;
    /** @type {(() => void) | null} */
    this.alIgualar = null;
    _caja.set(new THREE.Vector3(...COLONIA.cuarentena.min), new THREE.Vector3(...COLONIA.cuarentena.max));
    this.cajaCuarentena = _caja.clone();
  }

  /** Al empezar: la carga vuelve a la bodega, la escotilla se traba y la presión queda sin igualar. */
  preparar() {
    this.carga = CARGA_CARGUERO.map((c) => this.contenedores.find((f) => f.datos.codigo === c.codigo)).filter(Boolean);
    this.presion = PRESION_INICIAL;
    this.igualando = false;
    this.abierta = false;
    this.escotilla.bloqueada = true;
    this.leidos = [];
    this.ultima = null;
    this.activa = true;
    this.faltanteInformado = false;
    for (const f of this.carga) f.datos.zPrevia = null;
  }

  /** Lugar de espera de cada contenedor del turno, en la bodega. */
  posicionInicial(f) {
    const c = CARGA_CARGUERO.find((x) => x.codigo === f.datos.codigo);
    return new THREE.Vector3(...c.posicion);
  }

  terminar() {
    this.activa = false;
    this.igualando = false;
    this.escotilla.bloqueada = false;                    // fuera de la actividad, la escotilla vuelve a ser libre
  }

  igualar() {
    if (this.abierta || this.presion <= 0) return false;
    this.igualando = true;
    return true;
  }

  get igualada() { return this.presion <= 0.05; }

  abrir() {
    if (!this.igualada || this.abierta) return false;
    this.abierta = true;
    this.escotilla.bloqueada = false;
    return true;
  }

  manifestado(codigo) { return MANIFIESTO.includes(codigo); }

  /** Del manifiesto, los que llegaron y ya se leyeron. */
  get leidosDelManifiesto() { return this.leidos.filter((c) => this.manifestado(c)); }

  /** ¿Está todo lo que llegó leído? (para poder informar el faltante) */
  get todoLeido() { return this.carga.every((f) => this.leidos.includes(f.datos.codigo)); }

  dentroDeCuarentena(p) { return this.cajaCuarentena.containsPoint(p); }

  /** Cada cuadro: igualación de presión y lecturas del portal. */
  actualizar(dt) {
    this._destello = Math.max(0, this._destello - dt);
    if (!this.activa) return;
    if (this.igualando) {
      this.presion = Math.max(0, this.presion - (PRESION_INICIAL / SEGUNDOS_IGUALAR) * dt);
      if (this.presion <= 0) { this.igualando = false; if (this.alIgualar) this.alIgualar(); }
    }
    // portal: un contenedor que cruza el plano del aro, de la bodega hacia Colonia, cerca del eje
    const p = COLONIA.portal;
    for (const f of this.carga) {
      const z = f.posicion.z;
      const antes = f.datos.zPrevia;
      f.datos.zPrevia = z;
      if (antes === null || antes === undefined) continue;
      if (antes < p.z && z >= p.z && Math.hypot(f.posicion.x, f.posicion.y) < p.radio && !this.leidos.includes(f.datos.codigo)) {
        this.leidos.push(f.datos.codigo);
        this.ultima = { codigo: f.datos.codigo, manifestado: this.manifestado(f.datos.codigo) };
        this._destello = 1.2;
        if (this.alLeer) this.alLeer(f, this.ultima.manifestado);
      }
    }
  }
}

function panelPlano({ nombre, ancho, alto, px, dibujar }) {
  return new PanelVR({ ancho, alto, px, nombre, dibujar });
}

/** Panel de presión: diferencia en kPa, IGUALAR y ABRIR. */
export function crearPanelPresion(d, { igualar, abrir }) {
  const c = COLONIA.pantallaPresion;
  const W = 480, H = 240;
  const panel = panelPlano({ nombre: 'Panel_Presion', ancho: c.ancho, alto: c.alto, px: W, dibujar: (ctx, p) => {
    ctx.fillStyle = COLORES.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORES.azul;
    ctx.fillRect(0, 0, W, 40);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('PRESIÓN · BODEGA CR-01', 12, 28);
    ctx.font = 'bold 44px monospace';
    ctx.fillStyle = d.igualada ? COLORES.verde : d.igualando ? COLORES.amarillo : COLORES.rojo;
    ctx.fillText(`Δ ${d.presion.toFixed(1)} kPa`, 14, 98);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = COLORES.gris;
    ctx.fillText(d.abierta ? 'Escotilla abierta' : d.igualada ? 'Igualada: ya se puede abrir' : d.igualando ? 'Igualando…' : 'Escotilla trabada', 14, 130);
    p.boton('igualar', 12, 150, 220, 76, 'IGUALAR', igualar, { activo: d.activa && !d.igualada && !d.igualando, estilo: 'aviso' });
    p.boton('abrir', 248, 150, 220, 76, 'ABRIR', abrir, { activo: d.activa && d.igualada && !d.abierta, estilo: 'aviso' });
  } });
  panel.malla.position.set(...c.posicion);
  panel.malla.rotation.y = c.giroY;
  return panel;
}

/** Pantalla del portal RFID: lecturas y la última, verde si está en el manifiesto y ámbar si no. */
export function crearPanelRfid(d) {
  const c = COLONIA.pantallaRfid;
  const W = 480, H = 240;
  const panel = panelPlano({ nombre: 'Pantalla_RFID', ancho: c.ancho, alto: c.alto, px: W, dibujar: (ctx) => {
    const u = d.ultima;
    ctx.fillStyle = u && d._destello > 0 ? (u.manifestado ? '#0c3d1e' : '#4a3a06') : COLORES.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('PORTAL RFID', 14, 34);
    ctx.font = 'bold 40px monospace';
    ctx.fillText(`${d.leidosDelManifiesto.length}/${MANIFIESTO.length} del manifiesto`, 14, 100);
    ctx.font = '26px sans-serif';
    ctx.fillStyle = !u ? COLORES.gris : u.manifestado ? COLORES.verde : COLORES.amarillo;
    ctx.fillText(!u ? 'Esperando carga' : `${u.codigo} · ${u.manifestado ? 'en manifiesto' : 'NO MANIFESTADO'}`, 14, 160);
    ctx.fillStyle = COLORES.gris;
    ctx.font = '20px sans-serif';
    ctx.fillText(`Lecturas: ${d.leidos.length}`, 14, 210);
  } });
  panel.interactivo = false;
  panel.malla.position.set(...c.posicion);
  panel.malla.rotation.y = c.giroY;
  return panel;
}

/**
 * Consola de recepción: el manifiesto en vivo y el terminal de la actividad (INICIAR, INFORMAR FALTANTE,
 * PAUSAR, DEJAR).
 * @param {DescargaCarguero} d
 * @param {{estado: () => string, puedeIniciar: () => boolean, iniciar: () => void, faltante: () => void,
 *   pausar: () => void, reanudar: () => void, abandonar: () => void}} acciones
 */
export function crearPanelManifiesto(d, acciones) {
  const c = COLONIA.pantallaManifiesto;
  const W = 1040, H = 520;
  const panel = panelPlano({ nombre: 'Terminal_descarga', ancho: c.ancho, alto: c.alto, px: W, dibujar: (ctx, p) => {
    const estado = acciones.estado();
    ctx.fillStyle = COLORES.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORES.azul;
    ctx.fillRect(0, 0, W, 60);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('MANIFIESTO · CHARRÚA CR-01', 20, 42);
    ctx.textAlign = 'right';
    ctx.font = '24px sans-serif';
    ctx.fillStyle = COLORES.amarillo;
    ctx.fillText(estado === 'ACTIVA' ? 'DESCARGA EN CURSO' : estado === 'PAUSADA' ? 'EN PAUSA' : estado === 'COMPLETADA' ? 'RECIBIDO' : 'ESPERANDO DESCARGA', W - 20, 40);
    ctx.textAlign = 'left';
    let y = 104;
    ctx.font = '28px monospace';
    for (const codigo of MANIFIESTO) {
      const leido = d.leidos.includes(codigo);
      const informado = codigo === FALTANTE && d.faltanteInformado;
      ctx.fillStyle = leido ? COLORES.verde : informado ? COLORES.rojo : COLORES.blanco;
      ctx.fillText(`${leido ? '✔' : informado ? '✕' : '·'} ${codigo}  ${leido ? 'recibido' : informado ? 'FALTANTE informado' : 'pendiente'}`, 24, y);
      y += 42;
    }
    const sobrante = d.carga.find((f) => !d.manifestado(f.datos.codigo));
    if (sobrante && d.leidos.includes(sobrante.datos.codigo)) {
      ctx.fillStyle = COLORES.amarillo;
      ctx.fillText(`! ${sobrante.datos.codigo}  NO MANIFESTADO → ${sobrante.datos.cuarentena ? 'en cuarentena' : 'a la red de cuarentena'}`, 24, y);
      y += 42;
    }
    ctx.font = '22px sans-serif';
    ctx.fillStyle = COLORES.gris;
    if (estado !== 'ACTIVA') for (const linea of renglones(ctx, 'Igualá la presión y abrí la escotilla del carguero. Pasá la carga por el portal RFID, mandá lo no manifestado a la red de cuarentena e informá el faltante acá.', W - 48).slice(0, 2)) { ctx.fillText(linea, 24, y + 8); y += 28; }
    const yb = H - 96;
    if (estado === 'ACTIVA') {
      p.boton('faltante', 24, yb, 560, 76, 'INFORMAR FALTANTE', acciones.faltante, { activo: !d.faltanteInformado, estilo: 'aviso' });
      p.boton('pausar', 604, yb, 200, 76, 'PAUSAR', acciones.pausar);
      p.boton('dejar', 816, yb, 200, 76, 'DEJAR', acciones.abandonar);
    } else if (estado === 'PAUSADA') {
      p.boton('seguir', 24, yb, W - 48, 76, 'SEGUIR', acciones.reanudar, { estilo: 'aviso' });
    } else {
      p.boton('iniciar', 24, yb, W - 48, 76, estado === 'COMPLETADA' || estado === 'FALLIDA' ? 'REPETIR' : 'INICIAR', acciones.iniciar, { activo: acciones.puedeIniciar(), estilo: 'aviso' });
    }
  } });
  panel.malla.position.set(...c.posicion);
  panel.malla.rotation.y = c.giroY;
  return panel;
}
