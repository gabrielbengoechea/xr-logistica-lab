// Progreso por estudiante (Sprint 03, B15). Lógica pura, sin three.js.
//
// Solo con el registro aceptado (js/sesion.js): sin código de estudiante no hay a quién atribuir progreso.
// Dos fuentes, que se combinan quedándose con el mejor puntaje de cada actividad:
//   1. El backend del aula, si hay: GET /api/v1/telemetry/sessions?student_id=… y los eventos de cada sesión.
//      Se reconstruye desde los activity_end «completada · N puntos · S s» que ya manda la telemetría: no cambia
//      el contrato de datos.
//   2. Este visor (localStorage 'artigas1.progreso'), para cuando no hay backend (GitHub Pages). Guarda solo
//      qué actividades completó cada código y su mejor puntaje. Cualquiera que escriba ese código en este visor
//      lo ve: es el mismo criterio de identidad que la telemetría (el código lo asigna el docente).
import { ESCENARIO_WEB, RUTA_SALUD } from './telemetria.js';

export const CLAVE_PROGRESO = 'artigas1.progreso';
const MAX_SESIONES = 20;

/** «completada · 87 puntos · 140 s» → 87; cualquier otra cosa → null. */
export function puntajeDeDetalle(detalle) {
  const m = /^completada · (\d{1,3}) puntos/.exec(String(detalle || ''));
  return m ? Math.min(100, Number(m[1])) : null;
}

/** De una lista de eventos de telemetría, el mejor puntaje por actividad completada. */
export function progresoDesdeEventos(eventos) {
  const out = {};
  for (const e of eventos || []) {
    if (!e || e.type !== 'activity_end' || !e.part) continue;
    const p = puntajeDeDetalle(e.detail);
    if (p === null) continue;
    out[e.part] = { mejor: Math.max(p, out[e.part] ? out[e.part].mejor : 0) };
  }
  return out;
}

/** Une dos progresos quedándose con el mejor puntaje de cada actividad. */
export function combinar(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, p] of Object.entries(b)) out[id] = { mejor: Math.max(p.mejor, out[id] ? out[id].mejor : 0) };
  return out;
}

export class ProgresoLocal {
  /** @param {Storage|null} almacen */
  constructor(almacen) { this.almacen = almacen; }

  _todo() {
    try { return JSON.parse((this.almacen && this.almacen.getItem(CLAVE_PROGRESO)) || '{}') || {}; } catch { return {}; }
  }

  leer(codigo) { return this._todo()[codigo] || {}; }

  /** Registra una actividad completada (se queda con el mejor puntaje). */
  guardar(codigo, id, puntaje) {
    if (!codigo || !this.almacen) return;
    const todo = this._todo();
    todo[codigo] = combinar(todo[codigo], { [id]: { mejor: puntaje } });
    try { this.almacen.setItem(CLAVE_PROGRESO, JSON.stringify(todo)); } catch { /* sin almacenamiento */ }
  }

  /** Borra el progreso guardado en este visor (de un código o de todos). */
  borrar(codigo = null) {
    if (!this.almacen) return;
    try {
      if (!codigo) { this.almacen.removeItem(CLAVE_PROGRESO); return; }
      const todo = this._todo();
      delete todo[codigo];
      this.almacen.setItem(CLAVE_PROGRESO, JSON.stringify(todo));
    } catch { /* sin almacenamiento */ }
  }
}

/**
 * Progreso de un código según el backend, o null si no hay backend o no contesta.
 * @param {{backend: string|null, clave?: string, codigo: string, pedir?: typeof fetch}} o
 */
export async function progresoDelBackend({ backend, clave = '', codigo, pedir = (...a) => fetch(...a) }) {
  if (!backend || !codigo) return null;
  const cab = clave ? { 'X-API-Key': clave, Accept: 'application/json' } : { Accept: 'application/json' };
  try {
    const salud = await pedir(`${backend}${RUTA_SALUD}`, { headers: cab });
    if (!salud.ok) return null;
    const q = new URLSearchParams({ student_id: codigo, scenario: ESCENARIO_WEB, limit: String(MAX_SESIONES) });
    const r = await pedir(`${backend}/api/v1/telemetry/sessions?${q}`, { headers: cab });
    if (!r.ok) return null;
    const { sessions = [] } = await r.json();
    let progreso = {};
    for (const s of sessions.slice(0, MAX_SESIONES)) {
      if (s.student_id !== codigo) continue;
      const re = await pedir(`${backend}/api/v1/telemetry/sessions/${encodeURIComponent(s.session_id)}/events`, { headers: cab });
      if (re.ok) progreso = combinar(progreso, progresoDesdeEventos(await re.json()));
    }
    return progreso;
  } catch {
    return null;
  }
}
