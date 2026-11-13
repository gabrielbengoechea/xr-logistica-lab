// Las actividades educativas de Artigas-1. Cada una enseña una operación logística y se juega con las
// mecánicas del simulador: escáner, contenedores, herramientas, navegación y caminata espacial.
// Acá solo están las reglas; el reloj, los estados y el puntaje los lleva js/actividades.js.
import * as THREE from 'three';
import { NOMBRE_HERRAMIENTA } from './inspeccion.js';

/** Puntos de trabajo del taller (interior). Los del exterior están en js/exterior.js. */
export const PUNTOS_TALLER = {
  filtro_co2: { posicion: new THREE.Vector3(-1.17, -0.36, 4.86), herramienta: 'linterna', segundos: 1.5, texto: 'Revisá el filtro de CO₂ con la linterna' },
  soporte_vital: { posicion: new THREE.Vector3(-1.15, 0.19, 4.93), herramienta: 'inspector', segundos: 1.5, texto: 'Apuntá el inspector a la pantalla de soporte vital' },
  banco_bus: { posicion: new THREE.Vector3(0.95, -0.12, 4.97), herramienta: 'medidor', segundos: 1.5, texto: 'Medí la tensión del bus en el banco con el medidor' },
  valvula: { posicion: new THREE.Vector3(-1.15, -0.36, 5.28), herramienta: 'llave', segundos: 2.0, texto: 'Ajustá la válvula del filtro con la llave' },
};
export const PUNTOS_EVA = {
  junta_solar: { herramienta: 'inspector', segundos: 2.0, texto: 'Inspeccioná la junta del panel solar' },
  antena: { herramienta: 'inspector', segundos: 2.0, texto: 'Revisá el montaje de la antena principal' },
  conector_radiador: { herramienta: 'llave', segundos: 2.5, texto: 'Ajustá el conector del radiador con la llave' },
};

/**
 * @param {import('./actividades.js').GestorActividades} gestor
 * @param {{inventario: import('./inventario.js').Inventario, inspecciones: import('./inspeccion.js').Inspecciones}} mundo
 */
export function definirActividades(gestor, mundo) {
  const { inventario, inspecciones } = mundo;
  const delCarguero = inventario.bultos.filter((b) => b.legible && b.ubicacion.startsWith('CR01')).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const manifiesto = delCarguero.filter((_, i) => i % Math.max(1, Math.floor(delCarguero.length / 5)) === 0).slice(0, 5);

  gestor.registrar({
    id: 'recepcion', titulo: 'Recepción del carguero', modulo: 'carguero', concepto: 'Recepción e identificación de mercancías',
    instrucciones: 'Llegó el Charrúa. Con la pistola lectora, escaneá los bultos del manifiesto en su bodega. Si encontrás un bulto dañado o sin etiqueta, escanealo igual: queda informado como discrepancia.',
    referencia: 150,
    pasos: () => [
      ...manifiesto.map((b) => ({ id: b.codigo, texto: `Escaneá ${b.codigo} · ${b.ubicacion}` })),
      { id: 'discrepancia', texto: 'Informá una discrepancia (bulto dañado o sin etiqueta)' },
    ],
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
    instrucciones: 'Hay contenedores sueltos. Escaneá cada uno: la pistola te dice en qué hueco va. Llevalo flotando hasta ese hueco del rack y soltalo ahí: queda asegurado con su correa.',
    referencia: 240,
    pasos: (a) => {
      // los tres más cercanos al almacén que todavía no están en su lugar
      const centro = new THREE.Vector3(0, 0, -2.1);
      const elegidos = inventario.contenedores.filter((f) => !f.datos.hueco || f.datos.hueco.codigo !== f.datos.destino)
        .sort((x, y) => x.posicion.distanceToSquared(centro) - y.posicion.distanceToSquared(centro)).slice(0, 3);
      a.datos.codigos = elegidos.map((f) => f.datos.codigo);
      return elegidos.map((f) => ({ id: f.datos.codigo, texto: `Asegurá ${f.datos.codigo} en ${f.datos.destino}` }));
    },
    alEvento(a, tipo, d) {
      if (tipo === 'escaneo' && d.ok && d.tipo === 'contenedor') a.aviso(`${d.codigo} va en ${d.destino}`);
      if (tipo !== 'colocado' || !a.datos.codigos.includes(d.codigo)) return;
      if (d.correcto) a.completarPaso(d.codigo);
      else a.error(`${d.codigo} no va en ${d.hueco}: va en ${d.destino}`);
    },
  });

  gestor.registrar({
    id: 'inventario', titulo: 'Conteo de inventario', modulo: 'rivera', concepto: 'Control de inventario (conteo cíclico)',
    instrucciones: 'Conteo cíclico de una estantería de Rivera. Escaneá todos los bultos de esa estantería, uno por uno. Escanear un bulto de otra estantería cuenta como error.',
    referencia: 150,
    pasos: (a) => {
      // la estantería de estribor con más bultos
      const cuenta = new Map();
      for (const b of inventario.bultos) if (b.legible && /^RIV-E\d/.test(b.ubicacion)) cuenta.set(b.ubicacion.slice(0, 6), (cuenta.get(b.ubicacion.slice(0, 6)) || 0) + 1);
      const estante = [...cuenta.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0][0];
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

  const conPuntos = (puntos) => ({
    pasos: () => {
      inspecciones.activar(Object.keys(puntos));
      return Object.entries(puntos).map(([id, p]) => ({ id, texto: p.texto }));
    },
    alEvento(a, tipo, d) {
      if (tipo === 'inspeccion') a.completarPaso(d.punto);
      if (tipo === 'herramienta_incorrecta') a.error(`Ahí hace falta ${NOMBRE_HERRAMIENTA[d.pide] || d.pide}`);
    },
  });

  gestor.registrar({
    id: 'mantenimiento', titulo: 'Mantenimiento del taller', modulo: 'tacuarembo', concepto: 'Mantenimiento y uso de herramientas',
    instrucciones: 'Ronda de mantenimiento en Tacuarembó. Cada punto marcado pide una herramienta: tomala, apuntala o apoyala en el punto y mantené el gatillo hasta que el aro se ponga verde.',
    referencia: 210,
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
}
