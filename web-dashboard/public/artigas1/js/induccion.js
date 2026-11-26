// Bienvenida y práctica guiada de los controles.
//
// La ayuda de los controles estaba solo en la página (en la compu): en el visor nadie la ve. Ahora, la primera
// vez que se entra al visor aparece un panel de bienvenida con dos opciones: PRÁCTICA GUIADA (dos minutos) o
// EXPLORAR. La práctica es una lista corta de pasos que se cumplen haciendo (no apretando «siguiente»):
// agarrarse, impulsarse, frenar, girar, abrir el mapa y escanear un bulto. El panel de la práctica sigue a la
// mirada con pereza, como los avisos, y muestra el paso actual con su control.
// Fuera de la primera vez, la práctica se vuelve a abrir desde el menú de la tablet logística.
import { COLORES, PanelVR, renglones } from './paneles.js';

export const PASOS_INDUCCION = [
  { id: 'agarre', titulo: 'Agarrate', texto: 'Acercá una mano a una baranda o a la pared y apretá el GRIP.', compu: 'F' },
  { id: 'impulso', titulo: 'Impulsate', texto: 'Con el grip apretado, tirá de la mano hacia atrás y soltá: vas a flotar.', compu: 'W' },
  { id: 'freno', titulo: 'Frená', texto: 'Mientras flotás, apretá A (control derecho) hasta quedar quieto.', compu: 'Espacio' },
  { id: 'giro', titulo: 'Girá', texto: 'Empujá el stick derecho a un costado: girás 30° con un parpadeo.', compu: 'arrastrar el mouse' },
  { id: 'mapa', titulo: 'Mapa', texto: 'Mantené el GATILLO izquierdo: aparece el mapa en la mano. Soltalo para guardarlo.', compu: 'M' },
  { id: 'escaneo', titulo: 'Escaneá', texto: 'Tomá la pistola lectora (grip), apuntá a la etiqueta de un bulto y apretá el gatillo.', compu: 'F y X' },
];

export class Induccion {
  constructor() {
    this.activa = false;
    this.hechos = new Set();
    this.terminada = false;
    this._impulsoListo = false;
    /** @type {(() => void) | null} */
    this.alCambiar = null;
  }

  get pasoActual() { return PASOS_INDUCCION.find((p) => !this.hechos.has(p.id)) || null; }

  empezar() {
    this.activa = true;
    this.terminada = false;
    this.hechos.clear();
    this._impulsoListo = false;
    if (this.alCambiar) this.alCambiar('inicio');
  }

  cerrar() {
    this.activa = false;
    if (this.alCambiar) this.alCambiar('cierre');
  }

  /** Marca un paso como hecho (en orden: un paso adelantado no cuenta, así se aprende de a uno). */
  marcar(id) {
    if (!this.activa) return false;
    const p = this.pasoActual;
    if (!p || p.id !== id) return false;
    this.hechos.add(id);
    if (!this.pasoActual) { this.terminada = true; this.activa = false; }
    if (this.alCambiar) this.alCambiar(this.terminada ? 'fin' : 'paso', p);
    return true;
  }

  /**
   * Cada cuadro, con lo que hace el astronauta.
   * @param {{agarrado: boolean, velocidad: number, frenando: boolean, mapaEnLaMano: boolean}} e
   */
  actualizar(e) {
    if (!this.activa) return;
    const p = this.pasoActual;
    if (!p) return;
    if (p.id === 'agarre' && e.agarrado) this.marcar('agarre');
    else if (p.id === 'impulso') {
      if (e.agarrado) this._impulsoListo = true;           // se impulsa desde un agarre
      if (this._impulsoListo && !e.agarrado && e.velocidad > 0.25) this.marcar('impulso');
    } else if (p.id === 'freno' && e.frenando && e.velocidad < 0.08) this.marcar('freno');
    else if (p.id === 'mapa' && e.mapaEnLaMano) this.marcar('mapa');
  }
}

/** Panel de bienvenida (la primera vez en el visor): controles en resumen y las dos opciones. */
export function crearPanelBienvenida({ practicar, explorar }) {
  const W = 1100, H = 700;
  const panel = new PanelVR({ ancho: 0.80, alto: 0.80 * H / W, px: W, nombre: 'Bienvenida', dibujar: (ctx, p) => {
    ctx.fillStyle = COLORES.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = COLORES.celeste;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = COLORES.azul;
    ctx.fillRect(6, 6, W - 12, 84);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('Bienvenido a la Estación Artigas-1', 30, 64);
    ctx.font = '28px sans-serif';
    let y = 140;
    for (const linea of [
      'Estás en gravedad cero: el cuerpo conserva el impulso.',
      '• GRIP: agarrarte de barandas y paredes, tomar objetos.',
      '• Stick izquierdo: propulsor.   X / Y: bajar y subir.   A: freno.',
      '• Stick derecho: girar 30° (con parpadeo) y mirar arriba o abajo.',
      '• Gatillo izquierdo: el mapa en la mano.   Gatillo derecho: usar o apretar.',
      'Las actividades se inician en los terminales amarillos, la tablet o el mapa.',
    ]) { ctx.fillText(linea, 30, y); y += 52; }
    p.boton('practicar', 30, H - 130, 620, 96, 'PRÁCTICA GUIADA (2 min)', practicar, { estilo: 'aviso' });
    p.boton('explorar', 670, H - 130, W - 700, 96, 'EXPLORAR', explorar);
  } });
  return panel;
}

/** Panel de la práctica: paso actual, su control y el avance. */
export function crearPanelInduccion(induccion, { cerrar }) {
  const W = 900, H = 330;
  const panel = new PanelVR({ ancho: 0.56, alto: 0.56 * H / W, px: W, nombre: 'Practica', dibujar: (ctx, p) => {
    const paso = induccion.pasoActual;
    const n = induccion.hechos.size;
    ctx.fillStyle = 'rgba(10, 16, 26, 0.95)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = induccion.terminada ? COLORES.verde : COLORES.amarillo;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(induccion.terminada ? '¡Listo! Ya sabés moverte' : `Práctica · ${n + 1} de ${PASOS_INDUCCION.length}: ${paso.titulo}`, 24, 56);
    ctx.font = '30px sans-serif';
    let y = 110;
    const texto = induccion.terminada ? 'Ahora elegí una actividad en un terminal amarillo, la tablet o el mapa.' : paso.texto;
    for (const linea of renglones(ctx, texto, W - 48).slice(0, 3)) { ctx.fillText(linea, 24, y); y += 40; }
    if (!induccion.terminada) {
      ctx.font = '22px sans-serif';
      ctx.fillStyle = COLORES.gris;
      ctx.fillText(`En la compu: ${paso.compu}`, 24, y + 6);
    }
    // avance
    for (let i = 0; i < PASOS_INDUCCION.length; i++) {
      ctx.fillStyle = i < n ? COLORES.verde : '#2a3140';
      ctx.fillRect(24 + i * 74, H - 60, 64, 20);
    }
    p.boton('cerrar', W - 230, H - 86, 206, 66, induccion.terminada ? 'CERRAR' : 'SALTAR', cerrar);
  } });
  return panel;
}
