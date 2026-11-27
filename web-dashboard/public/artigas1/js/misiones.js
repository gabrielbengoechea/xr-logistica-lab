// Las actividades educativas de Artigas-1. Cada una enseña una operación logística y se juega con las
// mecánicas del simulador: escáner, contenedores, herramientas, navegación y caminata espacial.
// Acá solo están las reglas; el reloj, los estados y el puntaje los lleva js/actividades.js.
import * as THREE from 'three';
import { NOMBRE_HERRAMIENTA } from './inspeccion.js';
import { CARGA_CARGUERO } from './descarga.js';
import { crearAzar, elegirDistinto, semillaNueva } from './variacion.js';

/** Puntos de trabajo del taller (interior). Los del exterior están en js/exterior.js. */
export const PUNTOS_TALLER = {
  filtro_co2: { posicion: new THREE.Vector3(-1.17, -0.36, 4.86), herramienta: 'linterna', segundos: 1.5, texto: 'Revisá el filtro de CO₂ con la linterna' },
  soporte_vital: { posicion: new THREE.Vector3(-1.15, 0.19, 4.93), herramienta: 'inspector', segundos: 1.5, texto: 'Apuntá el inspector a la pantalla de soporte vital' },
  banco_bus: { posicion: new THREE.Vector3(0.95, -0.12, 4.97), herramienta: 'medidor', segundos: 1.5, texto: 'Medí la tensión del bus en el banco con el medidor' },
  valvula: { posicion: new THREE.Vector3(-1.15, -0.36, 5.28), herramienta: 'llave', segundos: 2.0, texto: 'Ajustá la válvula del filtro con la llave' },
  tapa_tablero: { posicion: new THREE.Vector3(1.15, 0.35, 5.70), herramienta: 'destornillador', segundos: 2.0, texto: 'Ajustá los tornillos de la tapa del tablero eléctrico con el destornillador' },
};
export const PUNTOS_EVA = {
  junta_solar: { herramienta: 'inspector', segundos: 2.0, texto: 'Inspeccioná la junta del panel solar' },
  antena: { herramienta: 'inspector', segundos: 2.0, texto: 'Revisá el montaje de la antena principal' },
  conector_radiador: { herramienta: 'llave', segundos: 2.5, texto: 'Ajustá el conector del radiador con la llave' },
};

/**
 * Ruta sugerida (B11): de lo más simple (identificar carga) a lo más exigente (caminata espacial). Recepción e
 * inventario enseñan a leer la carga; almacenamiento, a ubicarla; descarga junta todo con RFID; balance pide
 * razonar; el taller y el filtro, procedimientos con herramientas; la EVA, seguridad.
 */
export const RUTA_SUGERIDA = ['recepcion', 'almacenamiento', 'inventario', 'descarga', 'balance', 'mantenimiento', 'filtro', 'eva'];

/**
 * @param {import('./actividades.js').GestorActividades} gestor
 * @param {{inventario: import('./inventario.js').Inventario, inspecciones: import('./inspeccion.js').Inspecciones}} mundo
 */
export function definirActividades(gestor, mundo) {
  // reacomodarContenedores(lista) → cuántos devolvió a su lugar de origen (opcional: lo da recorrido.js)
  const { inventario, inspecciones, balance, descarga, filtro, reacomodarContenedores } = mundo;
  // escenario de cada actividad (js/escenarios.js, B13): opcional, para probar sin el mundo 3D
  const esc = mundo.escenarios || {};
  const delCarguero = inventario.bultos.filter((b) => b.legible && b.ubicacion.startsWith('CR01')).sort((a, b) => a.codigo.localeCompare(b.codigo));
  // Variación entre intentos (B07): cada intento saca su generador de la semilla de la sesión
  const semilla = Number.isFinite(mundo.semilla) ? mundo.semilla >>> 0 : semillaNueva();
  const azarDe = (a) => {
    let h = 2166136261;
    for (const c of a.id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    a.datos.variante = `${semilla}-${a.intentos + 1}`;
    return crearAzar((semilla ^ h) + (a.intentos + 1) * 7919);
  };

  gestor.registrar({
    id: 'recepcion', titulo: 'Recepción del carguero', modulo: 'carguero', concepto: 'Recepción e identificación de mercancías',
    instrucciones: 'Llegó el Charrúa. Con la pistola lectora, escaneá los bultos del manifiesto en su bodega. Si encontrás un bulto dañado o sin etiqueta, escanealo igual: queda informado como discrepancia.',
    referencia: 150,
    pasos: (a) => {
      // cinco bultos del carguero, distintos en cada intento
      const manifiesto = elegirDistinto(delCarguero, 5, azarDe(a), (b) => b.codigo, a.datos.anterior || null)
        .sort((x, y) => x.codigo.localeCompare(y.codigo));
      a.datos.anterior = manifiesto.map((b) => b.codigo);
      return [
        ...manifiesto.map((b) => ({ id: b.codigo, texto: `Escaneá ${b.codigo} · ${b.ubicacion}` })),
        { id: 'discrepancia', texto: 'Informá una discrepancia (bulto dañado o sin etiqueta)' },
      ];
    },
    alEvento(a, tipo, d) {
      if (tipo !== 'escaneo') return;
      if (d.motivo === 'ilegible') {
        if (!a.completarPaso('discrepancia')) a.aviso('Esa discrepancia ya está informada');
      } else if (d.ok && d.tipo === 'bulto') {
        if (a.pasos.some((p) => p.id === d.codigo)) {
          if (!a.completarPaso(d.codigo)) a.aviso(`${d.codigo} ya estaba recibido`);
        } else a.error(`${d.codigo} no está en el manifiesto de hoy`);
      }
    },
  });

  gestor.registrar({
    id: 'almacenamiento', titulo: 'Almacenamiento en Rivera', modulo: 'rivera', concepto: 'Ubicación y aseguramiento de cargas',
    instrucciones: 'Hay contenedores sueltos. Escaneá cada uno: la pistola te dice en qué hueco va. Llevalo flotando hasta ese hueco del rack y soltalo ahí: queda apoyado, con la correa floja en ámbar. Para amarrarlo, acercá la mano libre al trinquete naranja y apretá el gatillo tres veces, hasta que la luz se ponga verde.',
    referencia: 240,
    pasos: (a) => {
      // los tres más cercanos al almacén que todavía no están en su lugar
      const centro = new THREE.Vector3(0, 0, -2.1);
      const almacenables = () => inventario.contenedores.filter((f) => !f.datos.lastre && !f.datos.cuarentena && f.datos.destino);
      const pendientes = () => almacenables().filter((f) => !f.datos.hueco || f.datos.hueco.codigo !== f.datos.destino);
      let elegidos = pendientes();
      a.datos.reacomodados = 0;
      // Con todos ya guardados (partida anterior completa), se arma una partida nueva: los contenedores bien
      // ubicados que nadie tiene en la mano vuelven a su lugar de origen, sueltos (lo hace el mundo, que
      // conoce las amarras y la física). Sin ese ayudante o sin nada para mover, quedan cero pasos y el gestor
      // no la inicia (ver sinPasos).
      if (!elegidos.length && reacomodarContenedores) {
        const ubicados = almacenables().filter((f) => !f.mano && f.datos.hueco && f.datos.hueco.codigo === f.datos.destino)
          .sort((x, y) => x.datos.codigo.localeCompare(y.datos.codigo)).slice(0, 3);
        a.datos.reacomodados = ubicados.length ? reacomodarContenedores(ubicados) || 0 : 0;
        elegidos = pendientes();
      }
      elegidos = elegidos.sort((x, y) => x.posicion.distanceToSquared(centro) - y.posicion.distanceToSquared(centro)).slice(0, 3);
      a.datos.codigos = elegidos.map((f) => f.datos.codigo);
      return elegidos.map((f) => ({ id: f.datos.codigo, texto: `Llevá ${f.datos.codigo} a ${f.datos.destino} y amarralo` }));
    },
    sinPasos: () => 'El almacenamiento ya está completo: todos los contenedores están amarrados en su hueco. Soltá alguno de su lugar para practicar de nuevo.',
    alEvento(a, tipo, d) {
      if (tipo === 'escaneo' && d.ok && d.tipo === 'contenedor') a.aviso(`${d.codigo} va en ${d.destino}`);
      if ((tipo !== 'colocado' && tipo !== 'amarrado') || !a.datos.codigos.includes(d.codigo)) return;
      // apoyarlo en el hueco equivocado es el error; en el correcto, el paso se cumple recién al amarrarlo
      if (tipo === 'colocado' && !d.correcto) a.error(`${d.codigo} no va en ${d.hueco}: va en ${d.destino}`);
      if (tipo === 'amarrado' && d.correcto) a.completarPaso(d.codigo);
    },
  });

  gestor.registrar({
    id: 'inventario', titulo: 'Conteo de inventario', modulo: 'rivera', concepto: 'Control de inventario (conteo cíclico)',
    instrucciones: 'Conteo cíclico de una estantería de Rivera. Escaneá todos los bultos de esa estantería, uno por uno. Escanear un bulto de otra estantería cuenta como error.',
    referencia: 150,
    pasos: (a) => {
      // una estantería de estribor con cuatro bultos o más, distinta de la del intento anterior (B07)
      const cuenta = new Map();
      for (const b of inventario.bultos) if (b.legible && /^RIV-E\d/.test(b.ubicacion)) cuenta.set(b.ubicacion.slice(0, 6), (cuenta.get(b.ubicacion.slice(0, 6)) || 0) + 1);
      const ordenadas = [...cuenta.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
      const candidatas = ordenadas.filter(([, n]) => n >= 4).map(([e]) => e);
      const opciones = candidatas.length ? candidatas : ordenadas.slice(0, 1).map(([e]) => e);
      const [estante] = elegirDistinto(opciones, 1, azarDe(a), (e) => e, a.datos.estante ? [a.datos.estante] : null);
      a.datos.estante = estante;
      return inventario.bultos.filter((b) => b.legible && b.ubicacion.startsWith(estante)).map((b) => ({ id: b.codigo, texto: `Contá el bulto de ${b.ubicacion}` }));
    },
    alEvento(a, tipo, d) {
      if (tipo !== 'escaneo' || !d.ok || d.tipo !== 'bulto') return;
      if (a.pasos.some((p) => p.id === d.codigo)) {
        if (!a.completarPaso(d.codigo)) a.aviso(`${d.codigo} ya estaba contado`);
      } else a.error(`${d.codigo} es de ${d.ubicacion}, fuera del conteo de ${a.datos.estante}`);
    },
  });

  if (filtro) {
    gestor.registrar({
      id: 'filtro', titulo: 'Cambio del filtro de CO₂', modulo: 'tacuarembo', concepto: 'Mantenimiento de soporte vital y repuestos',
      preparar: () => esc.filtro && esc.filtro.preparar(),
      instrucciones: 'El filtro de CO₂ del soporte vital está al 12 %. Abrí su puerta (mano libre en la manija y gatillo), sacá el filtro gastado, tomá uno de repuesto del rack TAC-B1, encastralo soltándolo en su lugar y cerrá la puerta.',
      referencia: 150,
      pasos: () => [
        { id: 'abrir', texto: 'Abrí la puerta del filtro (gatillo en la manija)' },
        { id: 'sacar', texto: 'Sacá el filtro gastado' },
        { id: 'instalar', texto: 'Poné un filtro de repuesto del rack TAC-B1' },
        { id: 'cerrar', texto: 'Cerrá la puerta' },
      ],
      alEvento(a, tipo, d) {
        if (tipo === 'filtro_puerta' && d.abierta) a.completarPaso('abrir');
        if (tipo === 'filtro_puerta' && !d.abierta) {
          if (d.conFiltro && !d.gastado) a.completarPaso('cerrar');
          else a.aviso(d.conFiltro ? 'La puerta quedó cerrada con el filtro gastado' : 'La puerta quedó cerrada sin filtro');
        }
        if (tipo === 'filtro_sacado' && d.gastado) a.completarPaso('sacar');
        if (tipo === 'filtro_puesto') {
          if (d.gastado) a.error('Ese es el filtro gastado: poné uno de repuesto del rack TAC-B1');
          else a.completarPaso('instalar');
        }
      },
    });
  }

  if (descarga) {
    gestor.registrar({
      id: 'descarga', titulo: 'Descarga del carguero', modulo: 'colonia', concepto: 'Recepción con RFID, discrepancias y cuarentena',
      // Variación (Sprint 03): en cada intento cambia cuál contenedor llegó sin manifestar y qué código faltó
      preparar: (a) => {
        const azar = azarDe(a);
        const codigos = CARGA_CARGUERO.map((c) => c.codigo);
        const [sobrante] = elegirDistinto(codigos, 1, azar, (c) => c, a.datos.sobrante ? [a.datos.sobrante] : null);
        const faltante = `CNT-00${90 + Math.floor(azar() * 10)}`;
        a.datos.sobrante = sobrante;
        if (esc.descarga) esc.descarga.preparar({ sobrante, faltante });
        else descarga.preparar({ sobrante, faltante });
      },
      limpiar: () => (esc.descarga ? esc.descarga.limpiar() : descarga.terminar()),
      instrucciones: `Llegó el Charrúa con su manifiesto. En el panel de presión junto a la escotilla del carguero, IGUALAR y después ABRIR. Pasá cada contenedor de la bodega a Colonia por el aro del portal RFID: se lee solo. El que no está en el manifiesto va a la red de cuarentena (babor de Colonia). Cuando todo lo que llegó esté leído, INFORMAR FALTANTE en la consola de recepción.`,
      referencia: 300,
      pasos: () => [
        { id: 'igualar', texto: 'Igualá la presión de la bodega (panel de presión)' },
        { id: 'abrir', texto: 'Abrí la escotilla del carguero' },
        ...descarga.manifiesto.filter((c) => c !== descarga.faltante).map((c) => ({ id: `rfid:${c}`, texto: `Pasá ${c} por el portal RFID` })),
        { id: 'cuarentena', texto: 'Dejá el contenedor no manifestado en la red de cuarentena' },
        { id: 'faltante', texto: 'Informá el faltante en la consola de recepción' },
      ],
      alEvento(a, tipo, d) {
        if (tipo === 'presion_igualada') a.completarPaso('igualar');
        if (tipo === 'escotilla_abierta') a.completarPaso('abrir');
        if (tipo === 'rfid') {
          if (d.manifestado) a.completarPaso(`rfid:${d.codigo}`);
          else a.aviso(`${d.codigo} no está en el manifiesto: llevalo a la red de cuarentena`);
        }
        if (tipo === 'cuarentena') {
          if (d.manifestado) a.error(`${d.codigo} está en el manifiesto: no va a cuarentena`);
          else a.completarPaso('cuarentena');
        }
        if (tipo === 'faltante') {
          if (!d.todoLeido) a.error('Antes de informar un faltante, pasá toda la carga por el portal');
          else a.completarPaso('faltante');
        }
      },
    });
  }

  if (balance) {
    gestor.registrar({
      id: 'balance', titulo: 'Balance de masas', modulo: 'nodo', concepto: 'Distribución de la carga y centro de masa',
      preparar: () => esc.balance && esc.balance.preparar(),
      instrucciones: 'Llegaron tres tanques de agua (lastre) y esperan en Rivera, junto a la escotilla del Nodo. Ubicalos en huecos libres de los racks y amarralos, de modo que el centro de masa de la carga quede dentro del círculo del panel de balance del Nodo. Los tanques pesados van del lado contrario al que está corrido el punto. Después apretá CONFIRMAR en el panel.',
      referencia: 300,
      pasos: () => [
        ...balance.tanques.map((f) => ({ id: f.datos.codigo, texto: `Ubicá y amarrá el tanque ${f.datos.codigo} (${f.datos.pesoKg} kg)` })),
        { id: 'confirmar', texto: 'Con el punto dentro del círculo, CONFIRMAR en el panel de balance' },
      ],
      alEvento(a, tipo, d) {
        if (tipo === 'amarrado' && balance.tanques.some((f) => f.datos.codigo === d.codigo)) {
          a.completarPaso(d.codigo);
          balance.medir();
          a.aviso(`Desvío: ${(balance.desvio * 100).toFixed(1)} cm (tolerancia ${(balance.tolerancia * 100).toFixed(1)} cm)`);
        }
        if (tipo !== 'balance_confirmar') return;
        if (d.amarrados < balance.tanques.length) a.aviso(`Faltan amarrar ${balance.tanques.length - d.amarrados} tanques`);
        else if (!d.dentro) a.error(`Fuera de tolerancia: ${(d.desvio * 100).toFixed(1)} cm (máximo ${(d.tolerancia * 100).toFixed(1)} cm). Cambiá algún tanque de lado.`);
        else a.completarPaso('confirmar');
      },
    });
  }

  const conPuntos = (puntos) => ({
    pasos: () => {
      inspecciones.activar(Object.keys(puntos));
      return Object.entries(puntos).map(([id, p]) => ({ id, texto: p.texto }));
    },
    alEvento(a, tipo, d) {
      if (tipo === 'inspeccion') a.completarPaso(d.punto);
      if (tipo === 'herramienta_incorrecta') a.error(`Ahí hace falta ${NOMBRE_HERRAMIENTA[d.pide] || d.pide}`);
      if (tipo === 'pista') a.aviso(d.texto);
    },
  });

  gestor.registrar({
    id: 'mantenimiento', titulo: 'Mantenimiento del taller', modulo: 'tacuarembo', concepto: 'Mantenimiento y uso de herramientas',
    preparar: () => esc.mantenimiento && esc.mantenimiento.preparar(),
    instrucciones: 'Ronda de mantenimiento en Tacuarembó. Las herramientas están junto al banco de trabajo; la linterna, al fondo del módulo. Cada punto tiene un aro y un cartel con la herramienta que pide. Tomala, apuntala o apoyala en el punto y mantené apretado el gatillo hasta que la barra se llene y el aro se ponga verde.',
    referencia: 250,
    ...conPuntos(PUNTOS_TALLER),
  });

  const eva = conPuntos(PUNTOS_EVA);
  gestor.registrar({
    id: 'eva', titulo: 'Caminata espacial de inspección', modulo: 'esclusa', concepto: 'Seguridad operacional y mantenimiento exterior',
    instrucciones: 'Salí por la esclusa del Nodo. Afuera, avanzá de pasamanos en pasamanos con el cable enganchado. Tomá el inspector y la llave del soporte de la esclusa, hacé las tres tareas y volvé a entrar. Tenés 12 minutos de reserva.',
    requiere: ['mantenimiento'], referencia: 420, limite: 720,
    pasos: () => [{ id: 'salir', texto: 'Salí al exterior por la esclusa' }, ...eva.pasos(), { id: 'volver', texto: 'Volvé a entrar por la esclusa' }],
    alEvento(a, tipo, d) {
      if (tipo === 'eva' && d.fase === 'afuera') a.completarPaso('salir');
      if (tipo === 'eva' && d.fase === 'adentro') {
        if (a.pasos.filter((p) => p.id !== 'volver').every((p) => p.hecho)) a.completarPaso('volver');
        else a.aviso('Todavía quedan tareas afuera');
      }
      eva.alEvento(a, tipo, d);
    },
  });
  gestor.ruta = RUTA_SUGERIDA.filter((id) => gestor.obtener(id));
}
