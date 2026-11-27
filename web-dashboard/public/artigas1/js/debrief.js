// Contenido educativo de cada actividad (Sprint 02: B05, B10 y B27). Lógica pura: sin three.js ni DOM.
//
// Por actividad:
//   objetivo     qué se practica, en una línea;
//   pasos        instrucciones cortas (15 palabras como máximo cada una) que reemplazan el párrafo en el VR;
//   porQue       por qué se hace así en logística;
//   enTierra     el caso terrestre equivalente (depósito, puerto, camión, planta);
//   ficcion      qué está simplificado o inventado en el simulador (B27), si corresponde;
//   siErrores    qué revisar si hubo errores;
//   siLento      qué revisar si se pasó del tiempo de referencia.
//
// ESTADO DEL CONTENIDO: BORRADOR PARA REVISIÓN DOCENTE. Lo escribió el equipo de desarrollo con conceptos
// generales de logística; antes de usarlo para evaluar, que lo revise un docente de Logística de UTEC
// (criterio de aceptación de B05 en la auditoría). REVISADO_POR queda vacío hasta entonces.
export const ESTADO_CONTENIDO = 'borrador';
export const REVISADO_POR = '';

export const MAX_PALABRAS_PASO = 15;

export const CONTENIDO = {
  recepcion: {
    objetivo: 'Recibir la carga comparándola con el manifiesto.',
    pasos: [
      'Tomá la pistola lectora con el grip.',
      'Apuntá a la etiqueta de cada bulto del manifiesto y apretá el gatillo.',
      'Si ves un bulto dañado o sin etiqueta, escanealo igual: es una discrepancia.',
    ],
    porQue: 'Comparar lo que llega con el manifiesto detecta faltantes, sobrantes y daños antes de que la carga entre al stock. Lo que no se registra al recibir, después es difícil de reclamar.',
    enTierra: 'En un depósito o en el puerto, la recepción coteja la mercadería contra el remito o el conocimiento de embarque y deja constancia de cada diferencia.',
    siErrores: 'Escaneaste bultos que no estaban en el manifiesto: antes de leer, fijate en la lista de la tablet qué códigos esperás.',
    siLento: 'Recorré la bodega en orden, estante por estante, en lugar de buscar cada código por separado.',
  },
  almacenamiento: {
    objetivo: 'Ubicar cada carga en su lugar asignado y asegurarla.',
    pasos: [
      'Escaneá un contenedor: la pistola te dice en qué hueco va.',
      'Llevalo flotando hasta ese hueco y soltalo ahí.',
      'Mano libre en el trinquete naranja: gatillo tres veces.',
      'Con la luz verde queda amarrado. Seguí con el próximo.',
    ],
    porQue: 'Cada carga tiene una ubicación asignada: así se encuentra rápido y el inventario sabe dónde está. Amarrarla evita que se mueva y golpee algo; en gravedad cero, lo que no está sujeto flota.',
    enTierra: 'En un depósito, el sistema de gestión asigna la ubicación de cada pallet. En un camión o un contenedor, la carga se trinca con cinchas para que no se desplace al frenar o en una curva.',
    siErrores: 'Soltaste contenedores en huecos que no eran los suyos: escaneá antes de mover y llevá cada uno directo a su destino.',
    siLento: 'Escaneá y llevá de a un contenedor por vez, por el camino más corto entre el contenedor y su hueco.',
  },
  inventario: {
    objetivo: 'Contar una estantería sin parar la operación (conteo cíclico).',
    pasos: [
      'Andá a la estantería indicada en Rivera.',
      'Escaneá cada bulto de esa estantería, uno por uno.',
      'Solo los de esa estantería: otro bulto cuenta como error.',
    ],
    porQue: 'El conteo cíclico revisa una parte del stock por vez, sin cerrar el depósito. Encuentra diferencias entre lo que dice el sistema y lo que hay, antes de que causen un pedido mal preparado.',
    enTierra: 'Muchos depósitos cuentan con más frecuencia los artículos de mayor valor o rotación (clasificación ABC) y el resto con menos frecuencia.',
    siErrores: 'Leíste bultos de otra estantería: confirmá la ubicación en la etiqueta antes de contar.',
    siLento: 'Recorré la estantería en un sentido fijo (de arriba abajo o de izquierda a derecha) para no saltearte ni repetir.',
  },
  descarga: {
    objetivo: 'Descargar el carguero con RFID, separar lo no documentado e informar el faltante.',
    pasos: [
      'En el panel de presión: IGUALAR y después ABRIR.',
      'Pasá cada contenedor de la bodega a Colonia por el aro RFID.',
      'El que no está en el manifiesto va a la red de cuarentena.',
      'Con todo leído, INFORMAR FALTANTE en la consola de recepción.',
    ],
    porQue: 'El RFID lee etiquetas sin apuntarles una por una, así la recepción es más rápida. Lo que llega sin documentación se separa hasta aclararlo, y lo que falta se informa para reclamarlo o reponerlo.',
    enTierra: 'En un centro de distribución: lectura en el andén, zona de retención para mercadería no conforme y reporte de diferencias al proveedor o al transportista.',
    ficcion: 'El portal RFID y la red de cuarentena son recursos del simulador para practicar el procedimiento.',
    siErrores: 'Mandaste a cuarentena algo que estaba en el manifiesto, o informaste el faltante antes de leer todo: mirá la consola antes de decidir.',
    siLento: 'Igualá y abrí primero; después pasá los contenedores de a uno por el aro, sin volver a la bodega por cada lectura.',
  },
  balance: {
    objetivo: 'Ubicar carga pesada para que el centro de masa quede dentro de la tolerancia.',
    pasos: [
      'Los tres tanques esperan en Rivera, junto a la escotilla del Nodo.',
      'Ubicalos en huecos libres y amarralos.',
      'Los pesados van del lado contrario al que se corre el punto.',
      'Con el punto dentro del círculo, CONFIRMAR en el panel.',
    ],
    porQue: 'Dónde se pone la carga cambia el centro de masa del conjunto. Si queda corrido, el vehículo es menos estable o necesita más esfuerzo para corregirlo.',
    enTierra: 'Es el mismo razonamiento que la estiba de un camión, un avión o un buque: el peso se reparte para que el centro de gravedad quede dentro de los límites.',
    ficcion: 'En una estación real de cientos de toneladas, tres tanques casi no mueven el centro de masa: acá el efecto está exagerado para practicar el concepto.',
    siErrores: 'Confirmaste fuera de tolerancia: mirá hacia dónde se corre el punto y poné el tanque más pesado del lado opuesto.',
    siLento: 'Antes de mover, mirá el panel: elegí el lado según el desvío y después llevá los tanques.',
  },
  mantenimiento: {
    objetivo: 'Hacer una ronda de mantenimiento con la herramienta correcta en cada punto.',
    pasos: [
      'Las herramientas están junto al banco; la linterna, al fondo del módulo.',
      'Cada aro tiene un cartel con la herramienta que pide.',
      'Apuntá al aro y mantené el gatillo hasta que se ponga verde.',
    ],
    porQue: 'Cada tarea pide su herramienta: usar otra puede dañar el equipo o dar una lectura falsa. La ronda con lista de puntos asegura que no quede nada sin revisar.',
    enTierra: 'Mantenimiento preventivo de autoelevadores, cintas transportadoras o cámaras de frío: rondas con lista de control y herramienta asignada a cada tarea.',
    siErrores: 'Usaste una herramienta que no correspondía: leé el cartel del aro antes de acercarte.',
    siLento: 'Juntá todas las herramientas antes de empezar y recorré los puntos en orden, del más cercano al más lejano.',
  },
  filtro: {
    objetivo: 'Cambiar un consumible crítico usando un repuesto del stock.',
    pasos: [
      'Abrí la puerta: mano libre en la manija y gatillo.',
      'Sacá el filtro gastado.',
      'Poné uno de repuesto del rack TAC-B1.',
      'Cerrá la puerta.',
    ],
    porQue: 'El filtro es un consumible crítico: sin repuesto a mano, el soporte vital no puede seguir. Por eso se guarda stock de seguridad y se sigue su vida útil.',
    enTierra: 'Repuestos críticos de una planta o de un barco: se mantiene un stock de seguridad según cuánto tarda en llegar la reposición.',
    ficcion: 'En la ISS, la remoción de CO₂ es un sistema más complejo que un cartucho: acá se simplifica a un cambio de filtro.',
    siErrores: 'Volviste a poner el filtro gastado: dejalo aparte apenas lo sacás para no confundirlo.',
    siLento: 'Traé el repuesto del rack antes de abrir la puerta.',
  },
  eva: {
    objetivo: 'Trabajar afuera respetando el cable de seguridad y el tiempo de reserva.',
    pasos: [
      'Tomá el inspector y la llave del soporte de la esclusa.',
      'Afuera, avanzá de pasamanos en pasamanos con el cable enganchado.',
      'Hacé las tres tareas y volvé a entrar antes de 12 minutos.',
    ],
    porQue: 'Afuera, el cable y la reserva de tiempo son límites que no se negocian: cada tarea se planifica para volver con margen.',
    enTierra: 'Trabajo en altura o en espacios confinados: arnés, permiso de trabajo y tiempo controlado.',
    ficcion: 'Las caminatas espaciales reales se hacen de a dos y duran horas; los 12 minutos son una necesidad del simulador.',
    siErrores: 'Usaste una herramienta que no correspondía en un punto exterior: revisá el cartel antes de llegar.',
    siLento: 'Planificá el recorrido antes de salir: primero el punto más lejano y después volvé tomando los demás.',
  },
};

/** Actividades cuyo contenido cambia en cada intento (js/variacion.js). */
export const CAMBIA_AL_REPETIR = ['recepcion', 'inventario'];

/** Contenido de una actividad, o null si no tiene. */
export function contenido(id) {
  return CONTENIDO[id] || null;
}

/** Pasos cortos de una actividad (con datos de este intento, como la estantería del conteo). */
export function pasosCortos(actividad) {
  const c = contenido(actividad.id);
  if (!c) return [];
  if (actividad.id === 'inventario' && actividad.datos && actividad.datos.estante) {
    return [`Andá a la estantería ${actividad.datos.estante} de Rivera.`, ...c.pasos.slice(1)];
  }
  return c.pasos;
}

/** Qué revisar según el resultado. Devuelve una lista corta de consejos (puede venir vacía). */
export function consejos(actividad) {
  const c = contenido(actividad.id);
  const r = actividad.resultado;
  if (!c || !r) return [];
  const out = [];
  if (r.errores > 0) out.push(c.siErrores);
  if (r.segundos > actividad.def.referencia) out.push(c.siLento);
  if (!r.completada && r.motivo) out.unshift(`No se completó: ${r.motivo}.`);
  if (!out.length) out.push(CAMBIA_AL_REPETIR.includes(actividad.id) ? 'Sin errores y dentro del tiempo. Probá REPETIR: el contenido cambia en cada intento.' : 'Sin errores y dentro del tiempo de referencia.');
  return out;
}

export const contarPalabras = (texto) => String(texto).trim().split(/\s+/).filter(Boolean).length;
