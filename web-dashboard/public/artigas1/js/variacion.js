// Variación entre intentos (Sprint 02, B07). Lógica pura: sin three.js ni DOM.
//
// Cada sesión tiene una semilla y cada intento de una actividad saca su propio generador de esa semilla. Así:
//   - repetir una actividad pide otro contenido (otros bultos, otra estantería), que es lo que da sentido a REPETIR;
//   - con la misma semilla e intento se obtiene lo mismo, para reproducir un caso que reporta un docente
//     (la variante va en el evento activity_start de la telemetría: «variante <semilla>-<intento>»).

/** Generador pseudoaleatorio mulberry32: rápido, de 32 bits, suficiente para elegir contenidos. */
export function crearAzar(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla para una sesión nueva. */
export function semillaNueva() {
  return Math.floor(Math.random() * 2 ** 31) >>> 0;
}

/** Copia mezclada (Fisher-Yates). */
export function mezclar(lista, azar) {
  const out = lista.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const clave = (lista) => lista.slice().sort().join('|');

/**
 * Elige `n` elementos al azar evitando repetir exactamente la elección anterior (si hay alternativa).
 * @param {any[]} lista
 * @param {number} n
 * @param {() => number} azar
 * @param {(x: any) => string} id
 * @param {string[]|null} anterior  Ids de la elección anterior.
 */
export function elegirDistinto(lista, n, azar, id, anterior = null) {
  const k = Math.min(n, lista.length);
  let eleccion = mezclar(lista, azar).slice(0, k);
  if (anterior && lista.length > k && clave(eleccion.map(id)) === clave(anterior)) {
    // misma elección que la vez anterior: se cambia uno por alguno que no estaba
    const fuera = lista.filter((x) => !anterior.includes(id(x)));
    eleccion = eleccion.slice(1).concat(fuera[Math.floor(azar() * fuera.length)]);
  }
  return eleccion;
}
