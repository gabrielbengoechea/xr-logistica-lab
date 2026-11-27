// Sesión del estudiante en un visor compartido (Sprint 01: B02 y B06).
//
// Cada carga de la página es una sesión nueva e independiente: session_id nuevo (js/telemetria.js), consentimiento
// sin decidir, código de estudiante vacío y bienvenida pendiente. La identidad del estudiante anterior nunca se
// hereda: el código no se guarda en el navegador y lo que quedaba de versiones anteriores se borra al empezar.
//
// Flujo: CONSENTIMIENTO → (ACEPTAR → CÓDIGO) o (SEGUIR ANÓNIMO) → LISTA. «Nuevo estudiante» (tablet o página)
// cierra la actividad en curso, manda el informe final si hubo consentimiento, borra los datos de la sesión y
// recarga la estación: así el siguiente arranca con todo en su lugar (contenedores, filtro, carga del carguero).
//
// Qué se borra y qué no: en localStorage quedan los ajustes del visor (comodidad, manos, backend del aula y su
// clave), que son del equipo y no de la persona. Se borran solo las claves de sesión.
import { ETIQUETA_ESTADO } from './actividades.js';
import { COLORES, PanelVR, rectRedondo, renglones } from './paneles.js';

/** Datos que pertenecen a un estudiante: se borran al empezar y al terminar cada sesión. */
export const CLAVES_DE_SESION = ['artigas1.alumno', 'artigas1.bienvenida', 'artigas1.sesion'];
/** Ajustes del visor: se conservan entre estudiantes (los lee recorrido.js, manos.js y telemetria.js). */
export const CLAVES_DEL_VISOR = ['artigas1.ajustes', 'artigas1.calibracionManos', 'artigas1.backend', 'artigas1.clave'];

export const PASO_SESION = Object.freeze({ CONSENTIMIENTO: 'consentimiento', CODIGO: 'codigo', LISTA: 'lista', FINALIZADA: 'finalizada' });
const LARGO_CODIGO = 12;

export function limpiarDatosDeSesion(almacen) {
  if (!almacen) return;
  for (const k of CLAVES_DE_SESION) { try { almacen.removeItem(k); } catch { /* sin almacenamiento */ } }
}

/**
 * Conecta el gestor de actividades con la telemetría: inicio, avance y cierre de cada actividad.
 * (Estaba dentro de recorrido.js; se separó para probar el cambio de estudiante sin navegador.)
 */
export function conectarTelemetria(gestor, telemetria) {
  gestor.escuchar((tipo, a) => {
    if (tipo === 'inicio') telemetria.registrar('activity_start', a.id);
    if (tipo === 'paso' || tipo === 'error') telemetria.progreso(a.pasos.length, a.hechos, a.errores);
    if (tipo === 'fin' || tipo === 'abandono') {
      const r = a.resultado;
      telemetria.registrar('activity_end', a.id, null, tipo === 'abandono' ? 'abandonada' : r && r.completada ? `completada · ${r.puntaje} puntos · ${Math.round(r.segundos)} s` : `no superada · ${r ? r.motivo : ''}`);
      telemetria.cerrarActividad(a.pasos.length, a.hechos, a.errores);
      telemetria.enviar(false);
    }
  });
}

export class SesionEstudiante {
  /**
   * @param {object} o
   * @param {import('./telemetria.js').Telemetria} o.telemetria  La de esta sesión (una por carga de página).
   * @param {import('./actividades.js').GestorActividades} o.gestor
   * @param {Storage|null} [o.almacen]   localStorage (o un sustituto en las pruebas).
   * @param {string} [o.sugerido]        Código que trae la dirección (?alumno=…): solo se propone, hay que confirmarlo.
   */
  constructor({ telemetria, gestor, almacen = null, sugerido = '' }) {
    this.telemetria = telemetria;
    this.gestor = gestor;
    this.almacen = almacen;
    this.paso = PASO_SESION.CONSENTIMIENTO;
    this.sugerido = String(sugerido || '').slice(0, LARGO_CODIGO);
    this.codigo = '';
    /** La bienvenida del visor se muestra una vez por sesión (antes: una vez por navegador). */
    this.bienvenidaVista = false;
    /** @type {((paso: string) => void) | null} */
    this.alCambiar = null;
    limpiarDatosDeSesion(almacen);
  }

  get lista() { return this.paso === PASO_SESION.LISTA; }

  /** Cómo se muestra el estudiante en la tablet y en la página. */
  get descripcion() {
    if (this.paso === PASO_SESION.LISTA) return this.telemetria.consentimiento === 'aceptado' ? `Estudiante ${this.telemetria.config.alumno} · registro aceptado` : 'Modo anónimo · sin registro';
    if (this.paso === PASO_SESION.FINALIZADA) return 'Sesión finalizada';
    return 'Sin iniciar sesión';
  }

  _cambio() { if (this.alCambiar) this.alCambiar(this.paso); }

  aceptar() {
    if (this.paso !== PASO_SESION.CONSENTIMIENTO) return false;
    this.paso = PASO_SESION.CODIGO;
    this.codigo = this.sugerido;
    this._cambio();
    return true;
  }

  anonimo() {
    if (this.paso !== PASO_SESION.CONSENTIMIENTO && this.paso !== PASO_SESION.CODIGO) return false;
    this.telemetria.anonimo();
    this.paso = PASO_SESION.LISTA;
    this._cambio();
    return true;
  }

  volver() {
    if (this.paso !== PASO_SESION.CODIGO) return false;
    this.paso = PASO_SESION.CONSENTIMIENTO;
    this.codigo = '';
    this._cambio();
    return true;
  }

  teclear(digito) {
    if (this.paso !== PASO_SESION.CODIGO || !/^\d$/.test(String(digito)) || this.codigo.length >= LARGO_CODIGO) return false;
    this.codigo += String(digito);
    this._cambio();
    return true;
  }

  borrar() {
    if (this.paso !== PASO_SESION.CODIGO || !this.codigo) return false;
    this.codigo = this.codigo.slice(0, -1);
    this._cambio();
    return true;
  }

  /** Con el código escrito: el consentimiento queda aceptado para esta sesión y se manda el primer informe. */
  confirmarCodigo() {
    if (this.paso !== PASO_SESION.CODIGO || !this.codigo.trim()) return false;
    if (!this.telemetria.aceptar(this.codigo)) return false;
    this.paso = PASO_SESION.LISTA;
    this.telemetria.enviar(false);
    this._cambio();
    return true;
  }

  /**
   * Termina la sesión: cierra la actividad en curso (queda «abandonada» en el informe), manda el informe final
   * si hubo consentimiento y borra los datos de la sesión. Los ajustes del visor no se tocan.
   * @returns {Promise<object|null>} El informe final (también en modo anónimo, aunque no se envíe).
   */
  async finalizar() {
    if (this.paso === PASO_SESION.FINALIZADA) return null;
    if (this.gestor.activa) this.gestor.abandonar();
    const envio = this.telemetria.finalizar();
    const informe = this.telemetria.ultimoInforme;
    this.paso = PASO_SESION.FINALIZADA;
    limpiarDatosDeSesion(this.almacen);
    this._cambio();
    await envio;
    return informe;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Paneles (VR y compu): consentimiento y código. Botones grandes, texto corto.

export const TEXTO_CONSENTIMIENTO = [
  'Si aceptás, el simulador registra lo que hacés en las actividades (pasos, errores, tiempos y pistas) con un código de estudiante, no con tu nombre.',
  'Sirve para evaluar el desempeño y mejorar las actividades. Los resultados los ve tu docente en el panel del aula.',
  'Si no aceptás, usás el simulador igual: no se envía nada.',
];
const NOTA_CONSENTIMIENTO = 'Esta elección no reemplaza la autorización de la institución o de tu familia, cuando haga falta.';

/** Panel de inicio de sesión: dibuja el paso de consentimiento o el teclado del código. */
export function crearPanelSesion(sesion) {
  const W = 1100, H = 640;
  return new PanelVR({ ancho: 0.82, alto: 0.82 * H / W, px: W, nombre: 'Sesion_Estudiante', dibujar: (ctx, p) => {
    ctx.fillStyle = COLORES.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = COLORES.celeste;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = COLORES.azul;
    ctx.fillRect(6, 6, W - 12, 84);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 40px sans-serif';
    if (sesion.paso === PASO_SESION.CODIGO) {
      ctx.fillText('Tu código de estudiante', 30, 62);
      ctx.font = '28px sans-serif';
      ctx.fillText('Escribí el código que te dio tu docente.', 30, 140);
      ctx.fillStyle = COLORES.panel;
      rectRedondo(ctx, 30, 170, 470, 96, 14);
      ctx.fill();
      ctx.fillStyle = sesion.codigo ? COLORES.blanco : COLORES.gris;
      ctx.font = 'bold 56px monospace';
      ctx.fillText(sesion.codigo || '—', 54, 238);
      ctx.font = '24px sans-serif';
      ctx.fillStyle = COLORES.gris;
      renglones(ctx, 'Si no tenés código, volvé y elegí SEGUIR ANÓNIMO.', 470).forEach((r, i) => ctx.fillText(r, 30, 316 + i * 32));
      // teclado 3 × 4 a la derecha
      const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'BORRAR', '0', 'LISTO'];
      teclas.forEach((t, i) => {
        const x = 540 + (i % 3) * 180, y = 112 + Math.floor(i / 3) * 128;
        if (t === 'BORRAR') p.boton('borrar', x, y, 168, 116, 'BORRAR', () => sesion.borrar(), { activo: !!sesion.codigo });
        else if (t === 'LISTO') p.boton('listo', x, y, 168, 116, 'LISTO', () => sesion.confirmarCodigo(), { activo: !!sesion.codigo, estilo: 'aviso' });
        else p.boton(`tecla:${t}`, x, y, 168, 116, t, () => sesion.teclear(t));
      });
      p.boton('volver', 30, H - 116, 470, 90, '◀ VOLVER', () => sesion.volver());
      return;
    }
    ctx.fillText('Antes de empezar: registro de actividad', 30, 62);
    ctx.font = '29px sans-serif';
    let y = 140;
    for (const parrafo of TEXTO_CONSENTIMIENTO) {
      for (const r of renglones(ctx, `• ${parrafo}`, W - 60)) { ctx.fillText(r, 30, y); y += 40; }
      y += 14;
    }
    ctx.font = '23px sans-serif';
    ctx.fillStyle = COLORES.gris;
    for (const r of renglones(ctx, NOTA_CONSENTIMIENTO, W - 60)) { ctx.fillText(r, 30, y + 4); y += 30; }
    p.boton('aceptar', 30, H - 124, 600, 96, 'ACEPTAR EL REGISTRO', () => sesion.aceptar(), { estilo: 'aviso' });
    p.boton('anonimo', 650, H - 124, W - 680, 96, 'SEGUIR ANÓNIMO', () => sesion.anonimo());
  } });
}

/** Texto de la actividad en curso para la confirmación de «nuevo estudiante». */
export function resumenParaCerrar(gestor) {
  const a = gestor.activa;
  return a ? `La actividad «${a.def.titulo}» (${ETIQUETA_ESTADO[a.estado].toLowerCase()}) se cierra como abandonada.` : 'No hay ninguna actividad en curso.';
}
