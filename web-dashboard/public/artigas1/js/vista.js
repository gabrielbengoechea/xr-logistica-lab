// Ajustes de vista del Sprint 02 (B17). Lógica pura: se prueba sin navegador.

/** Mirando más abajo que esto (coseno respecto del «arriba» del cuerpo) se oculta el torso en la Cúpula. */
export const OCULTAR_TORSO = -0.55;
/** Vuelve a mostrarse recién por encima de esto (histéresis: no parpadea en el borde). */
export const MOSTRAR_TORSO = -0.45;

/**
 * ¿Ocultar torso y piernas? Solo en la Cúpula y al mirar hacia los pies, que es justo donde está la ventana
 * central con el Río de la Plata.
 * @param {boolean} enCupula
 * @param {number} arribaMirada  Producto escalar entre la dirección de la mirada y el «arriba» del cuerpo.
 * @param {boolean} antes        Lo que se decidió el cuadro anterior.
 */
export function torsoOcultoEnCupula(enCupula, arribaMirada, antes) {
  if (!enCupula) return false;
  if (arribaMirada < OCULTAR_TORSO) return true;
  if (arribaMirada > MOSTRAR_TORSO) return false;
  return antes;
}

/**
 * Giro (en radianes, alrededor de `arriba`) que hace que la mirada horizontal apunte hacia `objetivo`.
 * Vectores como {x, y, z}; `arriba` normalizado. Devuelve 0 si alguna proyección es casi nula.
 */
export function giroHacia(mirada, desdeCabeza, arriba) {
  const proyectar = (v) => {
    const d = v.x * arriba.x + v.y * arriba.y + v.z * arriba.z;
    const p = { x: v.x - d * arriba.x, y: v.y - d * arriba.y, z: v.z - d * arriba.z };
    const l = Math.hypot(p.x, p.y, p.z);
    return l < 1e-4 ? null : { x: p.x / l, y: p.y / l, z: p.z / l };
  };
  const a = proyectar(mirada), b = proyectar(desdeCabeza);
  if (!a || !b) return 0;
  const cos = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const cx = a.y * b.z - a.z * b.y, cy = a.z * b.x - a.x * b.z, cz = a.x * b.y - a.y * b.x;
  const signo = cx * arriba.x + cy * arriba.y + cz * arriba.z >= 0 ? 1 : -1;
  return signo * Math.acos(cos);
}

/** ¿Se está sirviendo desde esta misma máquina? (pruebas automáticas y desarrollo; B24) */
export function esServidorLocal(ubicacion) {
  return ubicacion.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]', '::1'].includes(ubicacion.hostname);
}
