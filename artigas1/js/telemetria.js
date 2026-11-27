// Telemetría del recorrido web de Artigas-1: manda la sesión al backend de XR Logística Lab con el mismo contrato
// que el cliente Unity (backend/app/schemas.py → SessionReport y LiveEvent), así el panel docente la ve.
//
// Consentimiento (Sprint 01, B06): nada sale del visor hasta que el estudiante acepta el registro de actividad
// en el panel de inicio de sesión (js/sesion.js). Sin aceptar (modo anónimo) no se hace ningún POST: la sesión
// se sigue contando en memoria y las actividades funcionan igual. La decisión vale para una sola sesión.
//
// Configuración del visor por la dirección (se recuerda en este navegador, porque es del aula y no del alumno):
//   ?backend=http://192.168.0.10:8000   backend del aula. Sin este dato se prueba el mismo origen.
//   ?backend=no                apaga la telemetría.
//   ?clave=…                   X-API-Key, si el backend la exige (XRLAB_API_KEY).
//   ?alumno=ana-3              solo sugiere el código en el panel de inicio de esta carga; ya no se guarda (B02).
//
// ¿Hay backend? (B26) Antes del primer envío se pide GET /api/v1/health una vez. Si contesta el backend
// (JSON con status «ok») se envía; si el servidor no lo tiene (404, 405, 501 o una página que no es JSON, como
// en GitHub Pages o `python -m http.server`) la telemetría queda apagada sin más pedidos. Un error de red
// (backend configurado pero caído) es distinto: se avisa en la consola y se vuelve a probar a los 30 s.
// En GitHub Pages y en file:// ni siquiera se prueba.
//
// Qué manda, con consentimiento y backend:
//   - cada evento importante, en vivo (POST /telemetry/event), para el feed del docente;
//   - la sesión completa (POST /telemetry/session) al aceptar, al terminar cada actividad, cada 30 s si cambió
//     algo y al cerrar o esconder la página. Reenviar el mismo session_id la actualiza.
// Las piezas del contrato se cuentan como pasos de las actividades: parts_total son los pasos de las
// actividades jugadas, parts_placed los cumplidos y assembly_errors los errores.

export const ESCENARIO_WEB = 'artigas1-web';
export const ESTUDIANTE_ANONIMO = 'anonimo';
const MAX_EVENTOS = 5000;
const CADA = 30;                                          // s entre envíos de la sesión, si cambió algo
const REINTENTO_BACKEND = 30;                             // s antes de volver a probar un backend que no contestó
export const RUTA_SALUD = '/api/v1/health';

/** Estados de la conexión con el backend. */
export const BACKEND = Object.freeze({
  NINGUNO: 'ninguno',            // no hay backend configurado (GitHub Pages, file://, ?backend=no)
  SIN_PROBAR: 'sin_probar',
  PROBANDO: 'probando',
  DISPONIBLE: 'disponible',
  AUSENTE: 'ausente',            // el servidor contesta pero no es el backend (sitio estático)
  SIN_CONEXION: 'sin_conexion',  // error de red: puede ser un corte real
});

function almacenLocal() {
  try { return window.localStorage; } catch { return null; }
}

/** Lee la configuración del visor (backend y clave) y el código sugerido por la dirección. */
export function leerConfig(ubicacion = window.location, almacen = almacenLocal()) {
  const q = new URLSearchParams(ubicacion.search);
  const guardar = (k, v) => { try { if (almacen) almacen.setItem(`artigas1.${k}`, v); } catch { /* sin almacenamiento */ } };
  const leer = (k) => { try { return almacen ? almacen.getItem(`artigas1.${k}`) : null; } catch { return null; } };
  for (const k of ['backend', 'clave']) if (q.has(k)) guardar(k, q.get(k) || '');
  const alumnoSugerido = (q.get('alumno') || '').trim().slice(0, 64);
  let backend = leer('backend');
  if (backend === 'no') backend = null;
  else if (!backend) backend = /github\.io$/.test(ubicacion.hostname) || ubicacion.protocol === 'file:' ? null : ubicacion.origin;
  return { alumno: ESTUDIANTE_ANONIMO, alumnoSugerido, backend: backend ? backend.replace(/\/+$/, '') : null, clave: leer('clave') || '' };
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
   * @param {typeof fetch} [o.pedir]  fetch (para las pruebas).
   */
  constructor({ config = leerConfig(), ahora = () => performance.now() / 1000, pedir = null } = {}) {
    this.config = { ...config, alumno: ESTUDIANTE_ANONIMO };   // el código llega recién con el consentimiento
    this.ahora = ahora;
    this._pedir = pedir;
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
    this.omitidos = 0;                                   // envíos que no salieron: sin consentimiento o sin backend
    this.ultimoInforme = null;
    /** null: todavía no decidió · 'aceptado' · 'anonimo'. Solo con 'aceptado' sale algo del visor. */
    this.consentimiento = null;
    this.estadoBackend = this.config.backend ? BACKEND.SIN_PROBAR : BACKEND.NINGUNO;
    this._prueba = null;
    this._probadoEn = -Infinity;
    this.registrar('session_start', null, null, `web · ${dispositivo()}`);
  }

  /** El estudiante aceptó el registro de actividad con este código. Devuelve false si el código no sirve. */
  aceptar(alumno) {
    const id = String(alumno || '').trim().slice(0, 64);
    if (!id || this.terminada) return false;
    this.consentimiento = 'aceptado';
    this.config.alumno = id;
    this._cambio = true;
    return true;
  }

  /** El estudiante sigue sin registro: no se manda nada identificable (en este sprint, nada). */
  anonimo() {
    this.consentimiento = 'anonimo';
    this.config.alumno = ESTUDIANTE_ANONIMO;
  }

  /** ¿Se mandan datos? Con consentimiento y con un backend que no se sabe ausente. */
  get activa() {
    return this.consentimiento === 'aceptado' && !!this.config.backend && this.estadoBackend !== BACKEND.AUSENTE && this.estadoBackend !== BACKEND.NINGUNO;
  }

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

  /** Cierra la sesión una sola vez (al cambiar de estudiante o al cerrar la página). */
  finalizar() {
    if (this.terminada) return Promise.resolve(null);
    return this.enviar(true);
  }

  /** Cada cuadro: manda la sesión cada 30 s si cambió algo. */
  actualizar(dt) {
    this._reloj += dt;
    if (this._reloj < CADA) return;
    this._reloj = 0;
    if (this._cambio && !this.terminada) this.enviar(false);
  }

  /**
   * Pregunta una vez si en `backend` está la API (GET /api/v1/health). Resuelve con el estado.
   * Los GET no llevan datos del estudiante.
   */
  comprobarBackend() {
    const pedir = this._pedir || (typeof fetch === 'function' ? (...a) => fetch(...a) : null);
    if (!this.config.backend || !pedir) { this.estadoBackend = BACKEND.NINGUNO; return Promise.resolve(this.estadoBackend); }
    if (this.estadoBackend === BACKEND.DISPONIBLE || this.estadoBackend === BACKEND.AUSENTE) return Promise.resolve(this.estadoBackend);
    if (this._prueba) return this._prueba;
    if (this.estadoBackend === BACKEND.SIN_CONEXION && this.ahora() - this._probadoEn < REINTENTO_BACKEND) return Promise.resolve(this.estadoBackend);
    this.estadoBackend = BACKEND.PROBANDO;
    this._probadoEn = this.ahora();
    const url = `${this.config.backend}${RUTA_SALUD}`;
    this._prueba = Promise.resolve()
      .then(() => pedir(url, { method: 'GET', headers: { Accept: 'application/json' } }))
      .then(async (r) => {
        let datos = null;
        if (r && r.ok) { try { datos = await r.json(); } catch { datos = null; } }
        if (datos && datos.status === 'ok') this.estadoBackend = BACKEND.DISPONIBLE;
        else {
          this.estadoBackend = BACKEND.AUSENTE;
          console.info(`Telemetría: ${this.config.backend} no tiene el backend de XR Logística Lab (${r ? r.status : 'sin respuesta'}); queda apagada en esta sesión.`);
        }
        return this.estadoBackend;
      }, () => {
        this.estadoBackend = BACKEND.SIN_CONEXION;
        console.warn(`Telemetría: no se pudo conectar con ${this.config.backend}; se vuelve a probar en ${REINTENTO_BACKEND} s.`);
        return this.estadoBackend;
      })
      .finally(() => { this._prueba = null; });
    return this._prueba;
  }

  _enviar(ruta, cuerpo, alCerrar = false) {
    // sin consentimiento: ningún POST (B06)
    if (!this.activa) { this.omitidos++; return Promise.resolve(null); }
    const pedir = this._pedir || (typeof fetch === 'function' ? (...a) => fetch(...a) : null);
    if (!pedir) return Promise.resolve(null);
    const mandar = () => {
      const cabeceras = { 'Content-Type': 'application/json' };
      if (this.config.clave) cabeceras['X-API-Key'] = this.config.clave;
      return Promise.resolve()
        .then(() => pedir(`${this.config.backend}${ruta}`, { method: 'POST', headers: cabeceras, body: JSON.stringify(cuerpo), keepalive: alCerrar }))
        .then((r) => { if (r.ok) this.enviados++; else this.fallidos++; return r; })
        .catch(() => { this.fallidos++; this._cambio = true; return null; });
    };
    // con el backend ya confirmado se manda en el acto (al cerrar la página no hay tiempo para esperar)
    if (this.estadoBackend === BACKEND.DISPONIBLE) return mandar();
    return this.comprobarBackend().then((estado) => {
      if (estado === BACKEND.DISPONIBLE) return mandar();
      this.omitidos++;
      if (estado === BACKEND.SIN_CONEXION) this._cambio = true;   // se reintenta con el próximo envío
      return null;
    });
  }
}
