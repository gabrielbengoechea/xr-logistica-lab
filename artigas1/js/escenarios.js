// Escenario de cada actividad (Sprint 03, B13): cómo queda el mundo al empezar y al terminar.
//
// Antes este código vivía en el oyente general de recorrido.js (`gestor.escuchar`), mezclado con avisos y
// sonidos, y corría después de calcular los pasos. Ahora cada actividad lo llama desde su `preparar()` /
// `limpiar()` (js/misiones.js), que el gestor ejecuta antes de los pasos y al terminar o abandonar.
// Recibe los sistemas que ya existen; no crea ninguno.

/**
 * @param {object} m
 * @param {import('./inventario.js').Inventario} m.inventario
 * @param {object} m.amarres       Amarres con trinquete (quitar).
 * @param {object} m.flotantes     Objetos sueltos (guardar, objetos).
 * @param {object|null} m.descarga DescargaCarguero.
 * @param {object|null} m.balance  Balance de masas.
 * @param {object|null} m.filtro   Cambio de filtro de CO₂.
 * @param {() => void} [m.redibujar]  Marca para redibujar los paneles que dependen del escenario.
 */
export function crearEscenarios({ inventario, amarres, flotantes, descarga, balance, filtro, redibujar = () => {} }) {
  /** Saca un objeto de la mano y de su hueco, si estaba amarrado. */
  const soltarDeTodo = (f) => {
    if (f.mano) { f.mano.sostiene = null; f.mano = null; }
    if (f.datos.hueco) { inventario.retirar(f); amarres.quitar(f); }
  };

  return {
    filtro: {
      // el soporte vital arranca con el filtro gastado puesto y la puerta cerrada
      preparar() { if (filtro) filtro.preparar(); redibujar(); },
    },

    descarga: {
      /** La carga del turno vuelve a la bodega y la escotilla se traba hasta igualar la presión. */
      preparar(variante) {
        if (!descarga) return;
        descarga.preparar(variante);
        for (const f of descarga.carga) {
          soltarDeTodo(f);
          f.datos.cuarentena = false;
          f.posicion.copy(descarga.posicionInicial(f));
          f.malla.quaternion.identity();
          f.casa.copy(f.posicion);
          f.velocidad.set(0, 0, 0);
          f.libre = false;
          f.fijo = true;
          f.datos.zPrevia = null;
        }
        redibujar();
      },
      limpiar() { if (descarga) { descarga.terminar(); redibujar(); } },
    },

    balance: {
      /** Los tanques vuelven a esperar junto a la escotilla y se calcula la tolerancia con los huecos libres. */
      preparar() {
        if (!balance) return;
        for (const f of balance.tanques) {
          if (f.datos.hueco) { inventario.retirar(f); amarres.quitar(f); }
          flotantes.guardar(f);
          f.oculto = false;
        }
        balance.preparar();
      },
    },

    mantenimiento: {
      /** El taller arranca ordenado: las herramientas sueltas de Tacuarembó vuelven a su lugar. */
      preparar() {
        for (const f of flotantes.objetos) if (f.datos && f.datos.herramienta && !f.mano && f.reposo.posicion.z > 3.6) flotantes.guardar(f);
      },
    },
  };
}
