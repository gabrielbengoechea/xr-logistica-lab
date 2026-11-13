// Gestor de actividades educativas. Lógica pura (sin three.js ni DOM): se prueba fuera del navegador.
//
// Cada actividad pasa por estados claros:
//   BLOQUEADA -> DISPONIBLE -> ACTIVA -> COMPLETADA      (y también PAUSADA y FALLIDA)
// Una sola puede estar activa a la vez. El juego le avisa al gestor lo que pasa («se escaneó tal código»,
// «se aseguró tal contenedor», «se inspeccionó tal punto») y la actividad activa decide si eso completa un
// paso, es un error o no le importa.
export const ESTADO = Object.freeze({
  BLOQUEADA: 'BLOQUEADA', DISPONIBLE: 'DISPONIBLE', ACTIVA: 'ACTIVA', PAUSADA: 'PAUSADA', COMPLETADA: 'COMPLETADA', FALLIDA: 'FALLIDA',
});

export const ETIQUETA_ESTADO = {
  BLOQUEADA: 'Bloqueada', DISPONIBLE: 'Disponible', ACTIVA: 'En curso', PAUSADA: 'En pausa', COMPLETADA: 'Completada', FALLIDA: 'No superada',
};

/** Puntaje de 0 a 100: resta por errores y por pasarse del tiempo de referencia. */
export function puntaje(segundos, errores, tiempoDeReferencia) {
  const demora = Math.max(0, segundos - tiempoDeReferencia) / tiempoDeReferencia;
  return Math.max(0, Math.round(100 - errores * 10 - Math.min(40, demora * 40)));
}

export function formatoTiempo(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * @typedef {object} Definicion
 * @property {string} id
 * @property {string} titulo
 * @property {string} modulo        Módulo donde se hace (id del mapa).
 * @property {string} concepto      Qué enseña (recepción, almacenamiento…).
 * @property {string} instrucciones
 * @property {string[]} [requiere]  Actividades que hay que completar antes.
 * @property {number} referencia    Segundos de referencia para el puntaje.
 * @property {number} [limite]      Segundos máximos; al pasarlos la actividad falla.
 * @property {(a: Actividad) => {id: string, texto: string}[]} pasos
 * @property {(a: Actividad, tipo: string, datos: object) => void} alEvento
 */

export class Actividad {
  /** @param {Definicion} def @param {GestorActividades} gestor */
  constructor(def, gestor) {
    this.def = def;
    this.id = def.id;
    this.gestor = gestor;
    this.estado = def.requiere && def.requiere.length ? ESTADO.BLOQUEADA : ESTADO.DISPONIBLE;
    this.pasos = [];
    this.tiempo = 0;
    this.errores = 0;
    this.intentos = 0;
    this.resultado = null;
    this.ultimoAviso = '';
    this.datos = {};
  }

  get hechos() { return this.pasos.filter((p) => p.hecho).length; }

  /** Primer paso pendiente. */
  get pasoActual() { return this.pasos.find((p) => !p.hecho) || null; }

  /** Marca un paso. Si era el último, la actividad se completa. */
  completarPaso(id) {
    const p = this.pasos.find((x) => x.id === id);
    if (!p || p.hecho || this.estado !== ESTADO.ACTIVA) return false;
    p.hecho = true;
    this.gestor._emitir('paso', this, p);
    if (this.pasos.every((x) => x.hecho)) this.gestor._terminar(this, ESTADO.COMPLETADA, '');
    return true;
  }

  error(mensaje) {
    if (this.estado !== ESTADO.ACTIVA) return;
    this.errores++;
    this.ultimoAviso = mensaje;
    this.gestor._emitir('error', this, mensaje);
  }

  aviso(mensaje) {
    this.ultimoAviso = mensaje;
    this.gestor._emitir('aviso', this, mensaje);
  }

  fallar(motivo) {
    if (this.estado === ESTADO.ACTIVA || this.estado === ESTADO.PAUSADA) this.gestor._terminar(this, ESTADO.FALLIDA, motivo);
  }
}

export class GestorActividades {
  constructor() {
    /** @type {Map<string, Actividad>} */
    this.actividades = new Map();
    /** @type {Actividad|null} */
    this.activa = null;
    this._oyentes = [];
  }

  /** @param {Definicion} def */
  registrar(def) {
    const a = new Actividad(def, this);
    this.actividades.set(def.id, a);
    return a;
  }

  /** @param {(tipo: string, actividad: Actividad, dato?: any) => void} f */
  escuchar(f) { this._oyentes.push(f); }

  _emitir(tipo, actividad, dato) {
    for (const f of this._oyentes) f(tipo, actividad, dato);
  }

  lista() { return [...this.actividades.values()]; }

  obtener(id) { return this.actividades.get(id) || null; }

  /** Por qué no se puede iniciar, o '' si se puede. */
  impedimento(id) {
    const a = this.actividades.get(id);
    if (!a) return 'No existe';
    if (a.estado === ESTADO.BLOQUEADA) {
      const faltan = (a.def.requiere || []).filter((r) => this.actividades.get(r)?.estado !== ESTADO.COMPLETADA).map((r) => this.actividades.get(r)?.def.titulo || r);
      return `Primero completá: ${faltan.join(', ')}`;
    }
    if (this.activa && this.activa !== a) return `Terminá o abandoná «${this.activa.def.titulo}»`;
    if (a.estado === ESTADO.ACTIVA || a.estado === ESTADO.PAUSADA) return 'Ya está en curso';
    return '';
  }

  /** Inicia (o reinicia, si ya se había jugado) una actividad. */
  iniciar(id) {
    if (this.impedimento(id)) return false;
    const a = this.actividades.get(id);
    a.pasos = a.def.pasos(a).map((p) => ({ ...p, hecho: false }));
    a.tiempo = 0;
    a.errores = 0;
    a.intentos++;
    a.resultado = null;
    a.ultimoAviso = '';
    a.estado = ESTADO.ACTIVA;
    this.activa = a;
    this._emitir('inicio', a);
    return true;
  }

  pausar() {
    if (!this.activa || this.activa.estado !== ESTADO.ACTIVA) return false;
    this.activa.estado = ESTADO.PAUSADA;
    this._emitir('pausa', this.activa);
    return true;
  }

  reanudar() {
    if (!this.activa || this.activa.estado !== ESTADO.PAUSADA) return false;
    this.activa.estado = ESTADO.ACTIVA;
    this._emitir('reanudar', this.activa);
    return true;
  }

  /** Deja la actividad en curso sin resultado: vuelve a estar disponible. */
  abandonar() {
    const a = this.activa;
    if (!a) return false;
    a.estado = ESTADO.DISPONIBLE;
    a.pasos = [];
    this.activa = null;
    this._emitir('abandono', a);
    return true;
  }

  reiniciar(id) {
    if (this.activa && this.activa.id === id) this.abandonar();
    return this.iniciar(id);
  }

  /** El juego informa algo que pasó. Solo le llega a la actividad en curso. */
  evento(tipo, datos = {}) {
    const a = this.activa;
    if (!a || a.estado !== ESTADO.ACTIVA) return;
    a.def.alEvento(a, tipo, datos);
  }

  /** Avanza el reloj de la actividad en curso. */
  tick(dt) {
    const a = this.activa;
    if (!a || a.estado !== ESTADO.ACTIVA) return;
    a.tiempo += dt;
    if (a.def.limite && a.tiempo >= a.def.limite) a.fallar('Se terminó el tiempo');
  }

  _terminar(a, estado, motivo) {
    a.estado = estado;
    a.resultado = {
      completada: estado === ESTADO.COMPLETADA, motivo, segundos: a.tiempo, errores: a.errores,
      pasos: a.hechos, total: a.pasos.length,
      puntaje: estado === ESTADO.COMPLETADA ? puntaje(a.tiempo, a.errores, a.def.referencia) : 0,
    };
    if (this.activa === a) this.activa = null;
    if (estado === ESTADO.COMPLETADA) {
      for (const otra of this.actividades.values()) {
        if (otra.estado !== ESTADO.BLOQUEADA) continue;
        if ((otra.def.requiere || []).every((r) => this.actividades.get(r)?.estado === ESTADO.COMPLETADA)) {
          otra.estado = ESTADO.DISPONIBLE;
          this._emitir('desbloqueo', otra);
        }
      }
    }
    this._emitir('fin', a);
  }
}
