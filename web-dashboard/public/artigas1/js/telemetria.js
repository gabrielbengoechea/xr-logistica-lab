// Telemetría del recorrido web de Artigas-1: manda la sesión al backend de XR Logística Lab con el mismo contrato
// que el cliente Unity (backend/app/schemas.py → SessionReport y LiveEvent), así el panel docente la ve.
//
// Configuración por la dirección (se recuerda en este navegador):
//   ?alumno=ana-3              identificador del estudiante (de fábrica, «anonimo»)
//   ?backend=http://192.168.0.10:8000   backend del aula. Sin este dato:
//       - servido por el backend o por `npm run dev` (proxy de /api): se usa el mismo origen;
//       - en GitHub Pages no hay backend: la telemetría queda apagada (se sigue contando en memoria).
//   ?backend=no                apaga la telemetría.
//   ?clave=…                   X-API-Key, si el backend la exige (XRLAB_API_KEY).
//
// Qué manda:
//   - cada evento importante, en vivo (POST /telemetry/event), para el feed del docente;
//   - la sesión completa (POST /telemetry/session) al terminar cada actividad, cada 30 s si cambió algo y al
//     cerrar o esconder la página. Reenviar el mismo session_id la actualiza.
// Las piezas del contrato se cuentan como pasos de las actividades: parts_total son los pasos de las
// actividades jugadas, parts_placed los cumplidos y assembly_errors los errores.
// Si el backend no contesta, el juego sigue igual: los envíos fallan en silencio y se reintenta más tarde.

export const ESCENARIO_WEB = 'artigas1-web';
const MAX_EVENTOS = 5000;
const CADA = 30;                                          // s entre envíos de la sesión, si cambió algo

function leerConfig(ubicacion = window.location) {
  const q = new URLSearchParams(ubicacion.search);
  const guardar = (k, v) => { try { window.localStorage.setItem(`artigas1.${k}`, v); } catch { /* sin almacenamiento */ } };
  const leer = (k) => { try { return window.localStorage.getItem(`artigas1.${k}`); } catch { return null; } };
  for (const k of ['alumno', 'backend', 'clave']) if (q.has(k)) guardar(k, q.get(k) || '');
  const alumno = (leer('alumno') || 'anonimo').slice(0, 64) || 'anonimo';
  let backend = leer('backend');
  if (backend === 'no') backend = null;
  else if (!backend) backend = /github\.io$/.test(ubicacion.hostname) || ubicacion.protocol === 'file:' ? null : ubicacion.origin;
  return { alumno, backend: backend ? backend.replace(/\/+$/, '') : null, clave: leer('clave') || '' };
}

function dispositivo() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/Quest 3/.test(ua)) return 'quest3';
  if (/OculusBrowser|Quest/.test(ua)) return 'quest2';
  return 'web';
}

function nuevoId() {
  const azar = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `web-${Date.now().toString(36)}-${azar}`;
}

const corto = (v, n) => (v === undefined || v === null || v === '' ? undefined : String(v).slice(0, n));

export class Telemetria {
  /**
   * @param {object} [o]
   * @param {{alumno: string, backend: string|null, clave: string}} [o.config]
   * @param {() => number} [o.ahora]  Segundos (para las pruebas).
   */
  constructor({ config = leerConfig(), ahora = () => performance.now() / 1000 } = {}) {
    this.config = config;
    this.ahora = ahora;
    this.sessionId = nuevoId();
    this.inicio = new Date();
    this._t0 = ahora();
    this.eventos = [];
    this.pasosTotal = 0;
    this.pasosHechos = 0;
    this.errores = 0;
    this.pistas = 0;
    this.enVisor = false;
    this.terminada = false;
    this._actual = null;                                 // actividad en curso: { total, hechos, errores }
    this._cambio = false;
    this._reloj = 0;
    this.enviados = 0;
    this.fallidos = 0;
    this.ultimoInforme = null;
    this.registrar('session_start', null, null, `web · ${dispositivo()}`);
  }

  get activa() { return !!this.config.backend; }

  _t() { return Math.max(0, Math.round((this.ahora() - this._t0) * 1000) / 1000); }

  /** Agrega un evento (y lo manda en vivo). `type` es uno de EventType del contrato. */
  registrar(type, part = null, target = null, detail = null) {
    const e = { t: this._t(), type };
    const p = corto(part, 120), g = corto(target, 120), d = corto(detail, 500);
    if (p) e.part = p;
    if (g) e.target = g;
    if (d) e.detail = d;
    // en orden de tiempo (el contrato lo exige) y con tope
    if (this.eventos.length && e.t < this.eventos[this.eventos.length - 1].t) e.t = this.eventos[this.eventos.length - 1].t;
    if (this.eventos.length < MAX_EVENTOS - 1) this.eventos.push(e);
    this._cambio = true;
    if (type !== 'session_start' && type !== 'session_end') this._enviar('/api/v1/telemetry/event', { session_id: this.sessionId, student_id: this.config.alumno, scenario: ESCENARIO_WEB, event: e });
    return e;
  }

  /** Avance de la actividad en curso (se suma a los totales al terminarla). */
  progreso(total, hechos, errores) {
    this._actual = { total, hechos, errores };
    this._cambio = true;
  }

  /** La actividad terminó (completada, fallida o abandonada): sus pasos y errores pasan a los totales. */
  cerrarActividad(total, hechos, errores) {
    this.pasosTotal += total;
    this.pasosHechos += Math.min(hechos, total);
    this.errores += errores;
    this._actual = null;
    this._cambio = true;
  }

  /** El informe de la sesión, con el contrato SessionReport. */
  informe(terminar = false) {
    const a = this._actual || { total: 0, hechos: 0, errores: 0 };
    const total = this.pasosTotal + a.total;
    const eventos = this.eventos.slice();
    if (terminar) eventos.push({ t: Math.max(this._t(), eventos.length ? eventos[eventos.length - 1].t : 0), type: 'session_end' });
    return {
      session_id: this.sessionId,
      student_id: this.config.alumno,
      scenario: ESCENARIO_WEB,
      device: dispositivo(),
      interaction: this.enVisor ? 'controllers' : 'mouse',
      started_at: this.inicio.toISOString(),
      ended_at: terminar ? new Date().toISOString() : null,
      parts_total: total,
      parts_placed: Math.min(total, this.pasosHechos + Math.min(a.hechos, a.total)),
      assembly_errors: this.errores + a.errores,
      hints_used: this.pistas,
      events: eventos,
    };
  }

  /** Manda la sesión ahora. */
  enviar(terminar = false) {
    const cuerpo = this.informe(terminar);
    this.ultimoInforme = cuerpo;
    this._cambio = false;
    if (terminar) this.terminada = true;
    return this._enviar('/api/v1/telemetry/session', cuerpo, terminar);
  }

  /** Cada cuadro: manda la sesión cada 30 s si cambió algo. */
  actualizar(dt) {
    this._reloj += dt;
    if (this._reloj < CADA) return;
    this._reloj = 0;
    if (this._cambio && !this.terminada) this.enviar(false);
  }

  _enviar(ruta, cuerpo, alCerrar = false) {
    if (!this.activa || typeof fetch !== 'function') return Promise.resolve(null);
    const cabeceras = { 'Content-Type': 'application/json' };
    if (this.config.clave) cabeceras['X-API-Key'] = this.config.clave;
    return fetch(`${this.config.backend}${ruta}`, { method: 'POST', headers: cabeceras, body: JSON.stringify(cuerpo), keepalive: alCerrar })
      .then((r) => { if (r.ok) this.enviados++; else this.fallidos++; return r; })
      .catch(() => { this.fallidos++; this._cambio = true; return null; });
  }
}
