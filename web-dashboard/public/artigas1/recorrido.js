// Simulador WebXR de la Estación Artigas-1 (three.js 0.170). Modelos: kit 3D de artigas1-vr (Blender).
// Coordenadas glTF: Y arriba, el eje de la estación es Z (la punta del carguero hacia -Z).
//
// Este archivo arma las piezas, reparte la entrada de los controles y corre el bucle. Cada sistema vive en su módulo:
//   js/estacion.js      estructura: fusión de mallas, colliders, barandas, escotillas
//   js/colisiones.js    colisiones (grilla espacial de triángulos)
//   js/locomocion.js    movimiento en 0G con cuerpo sólido y agarre de barandas
//   js/manos.js         manos humanas articuladas y lectura de los controles
//   js/flotantes.js     objetos sueltos y agarre universal (puntos de agarre, pasar de mano, soltar)
//   js/herramientas.js  modelos de herramientas y sus puntos de agarre
//   js/inventario.js    bultos, huecos y contenedores     js/escaner.js   pistola lectora
//   js/paneles.js       interfaz VR (paneles y botones)   js/tablet.js    tablet logística
//   js/mapa.js          mapa de la estación               js/navegacion.js guía entre módulos
//   js/actividades.js   gestor de actividades             js/misiones.js  las cinco actividades
//   js/inspeccion.js    puntos de mantenimiento           js/sonido.js    sonidos
//   js/exterior.js      exterior, paneles solares, antenas js/eva.js      caminata espacial y cable
//   js/materiales.js, js/entorno.js, js/etiquetas.js, js/barandas.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { armarEstacion } from './js/estacion.js';
import { Locomocion0G } from './js/locomocion.js';
import { Manos, POSES } from './js/manos.js';
import { crearBiblioteca, crearEntorno } from './js/materiales.js';
import { cargarTexturasTierra, crearEntornoOrbital, COLOR_SOL, SOL } from './js/entorno.js';
import { CATEGORIAS, crearEtiquetas } from './js/etiquetas.js';
import { SistemaFlotantes } from './js/flotantes.js';
import { FabricaHerramientas, REEMPLAZOS, agarreLibre, agarrePlano } from './js/herramientas.js';
import { Inventario } from './js/inventario.js';
import { Escaner } from './js/escaner.js';
import { Sonido } from './js/sonido.js';
import { COLORES, PanelVR, SistemaPaneles, rectRedondo, renglones } from './js/paneles.js';
import { ESTADO, ETIQUETA_ESTADO, GestorActividades, formatoTiempo } from './js/actividades.js';
import { PUNTOS_EVA, PUNTOS_TALLER, definirActividades } from './js/misiones.js';
import { Inspecciones } from './js/inspeccion.js';
import { LUGAR, Navegacion, rutaExterior, rutaInterior } from './js/navegacion.js';
import { MapaEstacion } from './js/mapa.js';
import { TabletLogistica } from './js/tablet.js';
import { ESCLUSA, PUNTOS_EXTERIORES, RUTAS_EXTERIORES, crearExterior } from './js/exterior.js';
import { CAPA_TERCERA_PERSONA, EVAController, StationTransitionManager } from './js/eva.js';
import { Confort, ORDEN_TUNEL } from './js/confort.js';
import { PARAMETROS_AVISO, UbicadorCartel, distanciaLibre, siempreVisible } from './js/avisos.js';
import { Amarres, DIENTES } from './js/amarre.js';
import { MedidorFps } from './js/rendimiento.js';
import { LotesFlotantes } from './js/lotes.js';
import { VisibilidadModulos } from './js/portales.js';
import { Telemetria } from './js/telemetria.js';
import { BalanceRivera, TANQUES, crearPanelBalance, geometriaTanque } from './js/balance.js';
import { DescargaCarguero, crearPanelManifiesto, crearPanelPresion, crearPanelRfid } from './js/descarga.js';
import { CambioFiltro, crearPantallaSoporte } from './js/filtro.js';
import { Induccion, crearPanelBienvenida, crearPanelInduccion } from './js/induccion.js';
import { PASO_SESION, SesionEstudiante, conectarTelemetria, crearPanelSesion, resumenParaCerrar } from './js/sesion.js';
import { traducirBotonVR } from './js/entrada.js';
import { consejos, contenido, pasosCortos } from './js/debrief.js';
import { esServidorLocal, torsoOcultoEnCupula } from './js/vista.js';

const INICIO = 'rivera';

// ---- ajustes del jugador (se guardan en este navegador)
// De fábrica, todo en el modo que menos marea (como Mission: ISS): giro por pasos con parpadeo a negro, a los
// costados (30°) y arriba o abajo (20°), con un límite de inclinación, y túnel al moverse. El giro suave queda
// como opción en la tablet, con zona muerta, curva progresiva y velocidad máxima.
const VERSION_AJUSTES = 3;
const AJUSTES_BASE = {
  version: VERSION_AJUSTES, giro: 'pasos', sensibilidad: 1, velocidad: 1, giroVertical: true, limiteInclinacion: 80,
  zonaMuerta: 0.2, frenoAsistido: false, tunel: 'medio', calibracionManos: 0, volumen: 1,
};
/** Límites de los ajustes numéricos que se cambian desde la tablet. */
const RANGOS_AJUSTES = { sensibilidad: [0.5, 2], velocidad: [0.5, 1.5], zonaMuerta: [0.1, 0.4], volumen: [0, 1] };
/** Opciones para mirar arriba y abajo con el stick: apagado o límite de inclinación en grados. */
const LIMITES_INCLINACION = [0, 45, 60, 80];
const ajustes = { ...AJUSTES_BASE };
try {
  const guardados = JSON.parse(window.localStorage.getItem('artigas1.ajustes') || '{}');
  const version = guardados.version || 1;
  if (version < 2) delete guardados.giro;            // versión 1: giro suave de fábrica, pasa a giro por pasos
  if (version < 3) delete guardados.giroVertical;    // versiones 1 y 2: mirar arriba y abajo con el stick, ahora de fábrica
  Object.assign(ajustes, guardados, { version: VERSION_AJUSTES });
} catch { /* sin almacenamiento: valores de fábrica */ }
function guardarAjustes() {
  try { window.localStorage.setItem('artigas1.ajustes', JSON.stringify(ajustes)); } catch { /* no se guarda */ }
}

// ---- renderer: ajustes pensados para el Quest 2
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local'); // la cabeza arranca en el origen del rig: sirve sentado
renderer.xr.setFoveation(1);                // foveado fijo al máximo: menos píxeles en la periferia
document.body.appendChild(renderer.domElement);
document.body.appendChild(traducirBotonVR(VRButton.createButton(renderer)));   // textos en español (B22)

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 2600);
const rig = new THREE.Group(); // en 0G el rig es el cuerpo: se mueve y gira en las tres direcciones
rig.add(camera);
scene.add(rig);
// cámara de observación (solo en la compu, tecla V): ve al astronauta con su traje desde afuera
const camaraExterna = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 2600);
camaraExterna.layers.enable(CAPA_TERCERA_PERSONA);              // el traje: ningún ojo del visor dibuja esta capa
let terceraPersona = false;

// ---- luz: una sola luz de hemisferio más los reflejos de entorno (sin luces puntuales por píxel).
scene.add(new THREE.HemisphereLight(0xf2f6ff, 0x59606b, 1.9));
const entorno = crearEntorno(renderer);
scene.environment = entorno;
const materialPara = crearBiblioteca(renderer, entorno, SOL, COLOR_SOL);

// ---- carga
const pct = document.getElementById('pct');
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, hechos, total) => { pct.textContent = `${Math.round((hechos / total) * 100)} %`; };
manager.onError = (url) => { pct.textContent = '· falta una parte de la estación; probá recargar la página'; console.warn(`no se pudo cargar ${url}`); };
const loader = new GLTFLoader(manager);
loader.setMeshoptDecoder(MeshoptDecoder);        // estacion.glb va comprimido con meshopt (B20: 4,2 MB → 1,5 MB)

const sonido = new Sonido();
sonido.factor = ajustes.volumen;
const manos = new Manos(renderer, rig, scene, camera);
manos.calibrar(ajustes.calibracionManos);
// el guante de Blender llega aparte: mientras tanto (o si no llega) se ven las manos de cápsulas
const guanteListo = manos.cargarGuante('./', entorno).catch((e) => { console.warn('guante:', e.message); return null; });
const paneles = new SistemaPaneles(scene, sonido);
// el rayo de los controles no aprieta terminales del otro lado de un mamparo
const RAYO_PANELES = { ...PARAMETROS_AVISO, paso: 0.04, radioPrueba: 0.02 };
paneles.obstaculo = (o, d, hasta) => distanciaLibre(colisionadores(), o, d, hasta, RAYO_PANELES);
// con el cuerpo en movimiento (más de 0,4 m/s) los toques con el dedo no aprietan botones: así, deslizarse contra
// una consola o un terminal no inicia una actividad sin querer
paneles.sinToque = () => !!loco && loco.velocidad.length() > 0.4;
const transicion = new StationTransitionManager(camera);
const confort = new Confort(camera);
// fps: siempre en la consola cada 10 s; con ?fps en la dirección, también un contador en la vista
// sesión para el panel docente (js/telemetria.js): sale algo solo si el estudiante acepta el registro (js/sesion.js)
const telemetria = new Telemetria();
window.addEventListener('pagehide', () => telemetria.finalizar());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && !telemetria.terminada) telemetria.enviar(false); });
const medidorFps = new MedidorFps(camera, new URLSearchParams(window.location.search).has('fps'));
const gestor = new GestorActividades();
conectarTelemetria(gestor, telemetria);
// el estudiante de esta carga: consentimiento, código y cambio de estudiante (B02 y B06)
const sesion = new SesionEstudiante({
  telemetria, gestor, sugerido: telemetria.config.alumnoSugerido,
  almacen: (() => { try { return window.localStorage; } catch { return null; } })(),
});
const navegacion = new Navegacion(scene);
const fabrica = new FabricaHerramientas(entorno);
const amarres = new Amarres(sonido, (m, fuerza, ms) => manos.vibrar(m, fuerza, ms));

/** @type {Locomocion0G | null} */
let loco = null;
let estacion = null;
let orbital = null;
/** @type {SistemaFlotantes | null} */
let flotantes = null;
let inventario = null;
/** @type {BalanceRivera | null} */
let balance = null;
/** @type {PanelVR | null} */
let panelBalance = null;
/** @type {DescargaCarguero | null} */
let descarga = null;
/** @type {CambioFiltro | null} */
let cambioFiltro = null;
/** @type {PanelVR | null} */
let pantallaSoporte = null;
/** Paneles del minijuego A: presión, portal RFID y consola de recepción. */
let panelesDescarga = null;
/** @type {LotesFlotantes | null} */
let lotes = null;
/** Texturas de la Tierra que se cargaron (KTX2 o WebP), para las pruebas. */
let texTierraCargadas = null;
/** @type {VisibilidadModulos | null} */
let portales = null;
let inspecciones = null;
let exterior = null;
/** @type {EVAController | null} */
let eva = null;
/** @type {MapaEstacion | null} */
let mapa = null;
const escaneres = [];
const tablets = [];
const terminales = [];
// ejes de paso que los objetos sueltos dejan libres: el de la estación y el túnel de la Cúpula
const PASILLOS = [
  { a: new THREE.Vector3(0, 0, -11.4), b: new THREE.Vector3(0, 0, 6.7) },
  { a: new THREE.Vector3(0, 0, 2.11), b: new THREE.Vector3(0, -2.5, 2.11) },
];
const sistemasActivos = [];

function* colisionadores() {
  for (let i = 0; i < sistemasActivos.length; i++) if (sistemasActivos[i].activo) yield sistemasActivos[i];
}

const cabeza = new THREE.Vector3();
const mirada = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const ARRIBA = new THREE.Vector3(0, 1, 0);

// =====================================================================================================
// Avisos breves, panel de instrucciones y resultados, terminales
// =====================================================================================================
const aviso = { texto: '', tono: 'info', tiempo: 0 };
const panelAviso = new PanelVR({ ancho: 0.66, alto: 0.11, px: 1080, nombre: 'Aviso', dibujar: (ctx) => {
  ctx.fillStyle = 'rgba(10, 16, 26, 0.94)';
  ctx.fillRect(0, 0, 1080, 180);
  ctx.strokeStyle = aviso.tono === 'error' ? COLORES.rojo : aviso.tono === 'ok' ? COLORES.verde : COLORES.celeste;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 1072, 172);
  ctx.fillStyle = COLORES.blanco;
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  const r = renglones(ctx, aviso.texto, 1010).slice(0, 2);
  r.forEach((linea, i) => ctx.fillText(linea, 540, (r.length === 1 ? 104 : 76) + i * 50));
} });
panelAviso.interactivo = false;
panelAviso.malla.visible = false;
siempreVisible(panelAviso.malla, 991);   // ni una pared, ni una bolsa, ni la mano lo tapan (ver js/avisos.js)
scene.add(panelAviso.malla);
const _apuntado = new THREE.Vector3();
// el aviso no se pone encima de un panel con botones (terminales, consolas, tablet, mapa, informe)
const ubicadorAviso = new UbicadorCartel(panelAviso.malla, colisionadores, { ocupado: (o, d) => !!paneles.apuntar(o, d, _apuntado) });

/**
 * Cartel breve delante del astronauta. Queda antes de la primera pared, se dibuja encima de todo y, si el
 * jugador gira, vuelve despacio delante de los ojos (no va pegado a la cámara).
 */
function avisar(texto, tono = 'info', segundos = 3.5) {
  aviso.texto = texto;
  aviso.tono = tono;
  aviso.tiempo = segundos;
  // un aviso nuevo con el anterior todavía a la vista no salta de lugar: solo cambia el texto
  if (!panelAviso.malla.visible) ubicadorAviso.colocar(camera);
  panelAviso.malla.visible = true;
  panelAviso.redibujar();
}

const informe = { modo: '', actividad: null };
const panelInforme = new PanelVR({ ancho: 0.74, alto: 0.48, px: 1110, nombre: 'Informe_Actividad', dibujar: (ctx, p) => {
  const W = 1110;
  const H = 720;
  const a = informe.actividad;
  ctx.fillStyle = COLORES.fondo;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = COLORES.borde;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);
  if (!a) return;
  const r = a.resultado;
  const fin = (informe.modo === 'resultado' || informe.modo === 'porque') && r;
  ctx.fillStyle = fin ? (r.completada ? '#14532d' : '#7f1d1d') : COLORES.azul;
  ctx.fillRect(6, 6, W - 12, 84);
  ctx.fillStyle = COLORES.blanco;
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(a.def.titulo, 30, 62);
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(informe.modo === 'porque' && fin ? 'POR QUÉ IMPORTA' : fin ? (r.completada ? 'COMPLETADA' : 'NO SUPERADA') : 'INSTRUCCIONES', W - 30, 60);
  ctx.textAlign = 'left';
  let y = 140;
  const c = contenido(a.id);
  const parrafo = (texto, color, fuente, max = 4, alto = 36) => {
    ctx.fillStyle = color;
    ctx.font = fuente;
    for (const linea of renglones(ctx, texto, W - 60).slice(0, max)) { ctx.fillText(linea, 30, y); y += alto; }
  };
  if (fin && informe.modo === 'porque' && c) {
    // debrief (B05 y B27): por qué importa, el caso terrestre y lo que está simplificado
    parrafo('Por qué importa', COLORES.amarillo, 'bold 28px sans-serif', 1, 38);
    parrafo(c.porQue, COLORES.blanco, '27px sans-serif', 4, 35);
    y += 12;
    parrafo('En tierra', COLORES.amarillo, 'bold 28px sans-serif', 1, 38);
    parrafo(c.enTierra, COLORES.blanco, '27px sans-serif', 3, 35);
    if (c.ficcion) { y += 10; parrafo(`En el simulador: ${c.ficcion}`, COLORES.gris, '23px sans-serif', 2, 30); }
    p.boton('volver-resultado', 30, H - 110, 320, 80, '◀ RESULTADO', () => { informe.modo = 'resultado'; panelInforme.sucio = true; });
  } else if (fin) {
    ctx.font = 'bold 34px sans-serif';
    ctx.fillStyle = COLORES.amarillo;
    ctx.fillText(r.completada ? `${r.puntaje} puntos  ${'★'.repeat(r.puntaje >= 85 ? 3 : r.puntaje >= 60 ? 2 : 1)}` : r.motivo, 30, y);
    y += 52;
    ctx.font = '28px sans-serif';
    ctx.fillStyle = COLORES.blanco;
    for (const linea of [`Tiempo: ${formatoTiempo(r.segundos)} (referencia ${formatoTiempo(a.def.referencia)})   ·   Errores: ${r.errores}   ·   Pasos: ${r.pasos} de ${r.total}`, `Qué practicaste: ${a.def.concepto}`]) {
      ctx.fillText(linea, 30, y);
      y += 42;
    }
    y += 6;
    parrafo('Para la próxima', COLORES.celeste, 'bold 27px sans-serif', 1, 36);
    for (const consejo of consejos(a).slice(0, 2)) parrafo(`• ${consejo}`, COLORES.blanco, '25px sans-serif', 2, 32);
    p.boton('repetir', 30, H - 110, 300, 80, 'REPETIR', () => { cerrarInforme(); iniciarActividad(a.id); }, { estilo: 'aviso' });
    if (c) p.boton('porque', 350, H - 110, 380, 80, 'POR QUÉ IMPORTA', () => { informe.modo = 'porque'; panelInforme.sucio = true; });
  } else {
    // instrucciones en pasos cortos (B10), con el objetivo arriba
    if (c) {
      parrafo(`Objetivo: ${c.objetivo}`, COLORES.celeste, 'bold 28px sans-serif', 2, 36);
      y += 8;
      pasosCortos(a).forEach((t, i) => parrafo(`${i + 1}. ${t}`, COLORES.blanco, '29px sans-serif', 2, 38));
    } else parrafo(a.def.instrucciones, COLORES.blanco, '30px sans-serif', 9, 40);
    y += 10;
    if (a.pasoActual) parrafo(`Ahora: ${a.pasoActual.texto}`, COLORES.amarillo, 'bold 28px sans-serif', 2, 38);
  }
  p.boton('cerrar', W - 350, H - 110, 320, 80, fin ? 'CERRAR' : 'ENTENDIDO', () => cerrarInforme());
} });
panelInforme.malla.visible = false;
siempreVisible(panelInforme.malla, 990);
scene.add(panelInforme.malla);
paneles.agregar(panelInforme);
// el informe tiene botones: se ubica antes de la primera pared y queda quieto para poder apuntarle
const ubicadorInforme = new UbicadorCartel(panelInforme.malla, colisionadores, { seguir: false, bajar: 0 });

function abrirInforme(modo, actividad) {
  informe.modo = modo;
  informe.actividad = actividad;
  ubicadorInforme.colocar(camera);
  panelInforme.malla.visible = true;
  panelInforme.sucio = true;
  reubicarAviso();
}

function cerrarInforme() {
  panelInforme.malla.visible = false;
}

function crearTerminal(idActividad, posicion, giroY, extra = null) {
  const panel = new PanelVR({ ancho: 0.46, alto: 0.30, px: 920, nombre: `Terminal_${idActividad}`, dibujar: (ctx, p) => {
    const W = 920;
    const H = 600;
    const a = gestor.obtener(idActividad);
    ctx.fillStyle = COLORES.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = COLORES.amarillo;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.fillStyle = COLORES.azul;
    ctx.fillRect(8, 8, W - 16, 70);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(a.def.titulo.toUpperCase(), 26, 56);
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = a.estado === ESTADO.COMPLETADA ? COLORES.verde : a.estado === ESTADO.BLOQUEADA ? COLORES.gris : COLORES.amarillo;
    const enCurso = a.estado === ESTADO.ACTIVA || a.estado === ESTADO.PAUSADA;
    ctx.fillText(`${ETIQUETA_ESTADO[a.estado]}${enCurso ? ` · ${formatoTiempo(a.tiempo)} · ${a.errores} errores` : a.resultado && a.resultado.completada ? ` · ${a.resultado.puntaje} puntos` : ''}`, 26, 116);
    ctx.font = '25px sans-serif';
    let y = 156;
    if (enCurso) {
      for (const paso of a.pasos.slice(Math.max(0, Math.min(a.hechos - 1, a.pasos.length - 6)), Math.max(6, a.hechos + 5))) {
        ctx.fillStyle = paso.hecho ? COLORES.verde : paso === a.pasoActual ? COLORES.blanco : COLORES.gris;
        ctx.fillText(`${paso.hecho ? '✔' : paso === a.pasoActual ? '▶' : '·'} ${paso.texto}`.slice(0, 62), 26, y);
        y += 36;
      }
      if (a.ultimoAviso) { ctx.fillStyle = COLORES.celeste; ctx.fillText(a.ultimoAviso.slice(0, 64), 26, Math.min(y + 8, 440)); }
    } else {
      ctx.fillStyle = COLORES.blanco;
      // objetivo y pasos cortos (B10) en lugar del párrafo de instrucciones
      const c = contenido(a.id);
      const textos = a.estado === ESTADO.BLOQUEADA ? [gestor.impedimento(a.id)] : c ? [`Objetivo: ${c.objetivo}`, ...c.pasos.map((t, i) => `${i + 1}. ${t}`)] : [a.def.instrucciones];
      const lineas = textos.flatMap((t) => renglones(ctx, t, W - 52));
      for (const linea of lineas.slice(0, 7)) { ctx.fillText(linea, 26, y); y += 34; }
    }
    const ancho = extra ? 280 : 420;
    if (a.estado === ESTADO.ACTIVA) {
      p.boton('pausar', 26, H - 104, ancho / 2 - 6, 78, 'PAUSAR', () => gestor.pausar());
      p.boton('dejar', 26 + ancho / 2 + 6, H - 104, ancho / 2 - 6, 78, 'DEJAR', () => gestor.abandonar());
    } else if (a.estado === ESTADO.PAUSADA) {
      p.boton('seguir', 26, H - 104, ancho, 78, 'SEGUIR', () => gestor.reanudar(), { estilo: 'aviso' });
    } else {
      p.boton('iniciar', 26, H - 104, ancho, 78, a.resultado ? 'REPETIR' : 'INICIAR', () => iniciarActividad(a.id), { activo: !gestor.impedimento(a.id), estilo: 'aviso' });
    }
    if (extra) p.boton('extra', W - 26 - 560, H - 104, 560, 78, extra.texto(), extra.accion);
  } });
  panel.malla.position.copy(posicion);
  panel.malla.rotation.y = giroY;
  // marco del terminal
  const marco = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.34, 0.02), new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.6, metalness: 0.4 }));
  marco.position.z = -0.012;
  panel.malla.add(marco);
  scene.add(panel.malla);
  paneles.agregar(panel);
  terminales.push(panel);
  portales.agregar(panel.malla, posicion);
  return panel;
}

// =====================================================================================================
// Acciones del juego
// =====================================================================================================
// =====================================================================================================
// Bienvenida y práctica guiada (js/induccion.js)
// =====================================================================================================
const induccion = new Induccion();
const panelBienvenida = crearPanelBienvenida({
  practicar: () => { cerrarBienvenida(); empezarPractica(); },
  explorar: () => { cerrarBienvenida(); avisar('Explorá libre. La práctica guiada está en el menú de la tablet.'); },
});
siempreVisible(panelBienvenida.malla, 988);
panelBienvenida.malla.visible = false;
scene.add(panelBienvenida.malla);
paneles.agregar(panelBienvenida);
const ubicadorBienvenida = new UbicadorCartel(panelBienvenida.malla, colisionadores, { seguir: false, bajar: 0.05 });
const panelPractica = crearPanelInduccion(induccion, { cerrar: () => induccion.cerrar() });
siempreVisible(panelPractica.malla, 988);
panelPractica.malla.visible = false;
scene.add(panelPractica.malla);
paneles.agregar(panelPractica);
// la práctica va arriba de la mirada: abajo están las manos, la tablet y los botones con los que se practica
const ubicadorPractica = new UbicadorCartel(panelPractica.malla, colisionadores, { seguir: true, bajar: -0.32 });
let bienvenidaPendiente = false;

// ---- inicio de sesión del estudiante (js/sesion.js): consentimiento y código, antes de la bienvenida
const panelSesion = crearPanelSesion(sesion);
siempreVisible(panelSesion.malla, 989);
panelSesion.malla.visible = false;
scene.add(panelSesion.malla);
paneles.agregar(panelSesion);
const ubicadorSesion = new UbicadorCartel(panelSesion.malla, colisionadores, { seguir: false, bajar: 0.05 });
let sesionPendiente = true;                     // se muestra en el primer cuadro, en la compu y en el visor
function mostrarPanelSesion() {
  if (sesion.lista || sesion.paso === PASO_SESION.FINALIZADA) return;
  ubicadorSesion.colocar(camera);
  panelSesion.malla.visible = true;
  panelSesion.sucio = true;
  reubicarAviso();
}
const estadoSesionHtml = document.getElementById('sesion-estado');
function actualizarSesionHtml() { if (estadoSesionHtml) estadoSesionHtml.textContent = sesion.descripcion; }
sesion.alCambiar = (paso) => {
  panelSesion.sucio = true;
  actualizarSesionHtml();
  for (const t of tablets) t.panel.sucio = true;
  if (paso === PASO_SESION.LISTA) {
    panelSesion.malla.visible = false;
    avisar(telemetria.consentimiento === 'aceptado' ? `Sesión de ${telemetria.config.alumno}: se registra tu actividad` : 'Modo anónimo: no se envía nada', 'ok', 4);
    if (renderer.xr.isPresenting && !sesion.bienvenidaVista) bienvenidaPendiente = true;
  }
};
actualizarSesionHtml();
/** Para las pruebas: la recarga se puede reemplazar. */
const reinicio = { recargar: (url) => window.location.replace(url) };
let cambiandoEstudiante = false;
/** Nuevo estudiante: cierra esta sesión y recarga la estación (sin el ?alumno= de la dirección). */
function nuevoEstudiante() {
  if (cambiandoEstudiante) return;
  cambiandoEstudiante = true;
  avisar('Sesión terminada. Preparando el visor para el próximo estudiante…', 'ok', 10);
  const espera = new Promise((r) => { setTimeout(r, 1500); });       // el informe sale con keepalive igual
  Promise.race([sesion.finalizar(), espera]).catch(() => null).then(async () => {
    const xr = renderer.xr.getSession();
    if (xr) { try { await xr.end(); } catch { /* ya terminada */ } }
    const url = new URL(window.location.href);
    url.searchParams.delete('alumno');
    reinicio.recargar(url.toString());
  });
}
const botonNuevoHtml = document.getElementById('nuevo-estudiante');
if (botonNuevoHtml) botonNuevoHtml.addEventListener('click', () => {
  if (!sesion.lista) { mostrarPanelSesion(); return; }
  if (window.confirm(`¿Terminar la sesión (${sesion.descripcion}) y dejar el visor listo para otro estudiante?`)) nuevoEstudiante();
});

function mostrarBienvenida() {
  ubicadorBienvenida.colocar(camera);
  panelBienvenida.malla.visible = true;
  panelBienvenida.sucio = true;
  reubicarAviso();
}
/** Si un panel con botones aparece donde está el aviso, el aviso se corre (ver UbicadorCartel). */
function reubicarAviso() {
  if (panelAviso.malla.visible) ubicadorAviso.colocar(camera);
}
function cerrarBienvenida() {
  panelBienvenida.malla.visible = false;
  sesion.bienvenidaVista = true;                // una vez por sesión de estudiante, no por navegador (B02)
}
function empezarPractica() {
  induccion.empezar();
  ubicadorPractica.colocar(camera);
  panelPractica.malla.visible = true;
  panelPractica.sucio = true;
}
induccion.alCambiar = (tipo) => {
  panelPractica.sucio = true;
  if (tipo === 'inicio') telemetria.registrar('activity_start', 'practica');
  if (tipo === 'paso') { sonido.tocar('logro'); manos.vibrarTodas(0.5, 50); }
  if (tipo === 'fin') { sonido.tocar('logro'); telemetria.registrar('activity_end', 'practica', null, 'completada'); }
  if (tipo === 'cierre') panelPractica.malla.visible = false;
};

function iniciarActividad(id) {
  const motivo = gestor.impedimento(id);
  if (motivo) { avisar(motivo, 'error'); sonido.tocar('error'); return false; }
  if (gestor.iniciar(id)) return true;
  // sin tareas pendientes (B01): no queda activa; se explica por qué
  avisar(gestor.motivoNoInicio || 'No se pudo iniciar la actividad', 'error', 6);
  sonido.tocar('aviso');
  return false;
}

function guiar(id) {
  const afuera = eva && eva.afuera;
  const lugar = LUGAR[id];
  if (!lugar) return;
  if (afuera) {
    const ruta = id === 'esclusa' || lugar.zona === 'interior' ? RUTAS_EXTERIORES.junta_solar.slice(0, 1) : RUTAS_EXTERIORES[id];
    const vuelta = id === 'esclusa' || lugar.zona === 'interior';
    navegacion.guiar(vuelta ? 'esclusa' : id, (desde) => (vuelta ? [desde.clone(), ESCLUSA.salida.clone()] : rutaExterior(desde, ruta)));
  } else {
    const destino = lugar.zona === 'exterior' ? 'esclusa' : id;
    navegacion.guiar(destino, (desde) => rutaInterior(desde, destino));
  }
  avisar(`Seguí las flechas hasta ${LUGAR[navegacion.destino].nombre}`);
}

/** Traslado con fundido: una opción controlada, breve y que deja la vista hacia el interior del módulo. */
function trasladar(id) {
  const lugar = LUGAR[id];
  if (!lugar || lugar.zona !== 'interior' || (eva && eva.afuera)) return;
  transicion.iniciar(lugar.nombre, lugar.rol, () => ir(id), null, 0.25);
  if (mapa) mapa.cerrar();
}

function ir(id) {
  const lugar = LUGAR[id];
  const d = new THREE.Vector3(...lugar.mira).normalize();
  yaw = Math.atan2(-d.x, -d.z);
  pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
  aplicarMirada();
  _pos.set(...lugar.centro);
  // en VR la cabeza está desplazada del rig: se compensa para que la cabeza quede en el punto
  if (renderer.xr.isPresenting) _pos.sub(_v.copy(camera.position).applyQuaternion(rig.quaternion));
  if (loco) loco.teletransportar(_pos); else rig.position.copy(_pos);
}

/**
 * Tapa del tablero eléctrico del taller (punto del destornillador): placa con cuatro tornillos, montada en la
 * pared de estribor de Tacuarembó, mirando al centro del módulo.
 */
function crearTapaTablero(posicion) {
  const g = new THREE.Group();
  g.name = 'Taller_Tapa_Tablero';
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.22), new THREE.MeshStandardMaterial({ color: 0x8c96a3, roughness: 0.55, metalness: 0.6 }));
  g.add(placa);
  const cartel = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.03, 0.12), new THREE.MeshStandardMaterial({ color: 0xfcd116, roughness: 0.7 }));
  cartel.position.set(-0.007, 0.05, 0);
  g.add(cartel);
  const tornillo = new THREE.CylinderGeometry(0.009, 0.009, 0.008, 8).rotateZ(Math.PI / 2);
  const matTornillo = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.4, metalness: 0.9 });
  for (const [y, z] of [[-0.065, -0.095], [-0.065, 0.095], [0.065, -0.095], [0.065, 0.095]]) {
    const t = new THREE.Mesh(tornillo, matTornillo);
    t.position.set(-0.009, y, z);
    g.add(t);
  }
  g.position.copy(posicion).add(new THREE.Vector3(0.025, 0, 0));
  return g;
}

function reunirHerramientas() {
  for (const f of flotantes.objetos) if (f.datos && f.datos.herramienta) flotantes.guardar(f);
  avisar('Las herramientas volvieron a su lugar', 'ok');
}

// =====================================================================================================
// Armado
// =====================================================================================================
const anisotropia = Math.min(4, renderer.capabilities.getMaxAnisotropy());
Promise.all([loader.loadAsync('./estacion.glb'), cargarTexturasTierra(manager, anisotropia, renderer)]).then(([gEstacion, texTierra]) => {
  estacion = armarEstacion(gEstacion, materialPara);
  scene.add(estacion.grupo);
  portales = new VisibilidadModulos(estacion);        // no se dibuja lo que queda detrás de una escotilla cerrada
  const legibles = estacion.cargas.filter((c) => c.legible);
  const etiquetas = crearEtiquetas(legibles, renderer);
  if (etiquetas.malla) scene.add(etiquetas.malla);
  inventario = new Inventario(estacion.cargas, etiquetas.datos, CATEGORIAS);
  texTierraCargadas = texTierra;
  orbital = crearEntornoOrbital(texTierra);
  scene.add(orbital.grupo);
  portales.agregarDeAfuera(orbital.grupo);
  exterior = crearExterior(SOL, COLOR_SOL);
  scene.add(exterior.grupo);
  for (const p of exterior.pasamanos) estacion.barandas.segmentos.push(p);

  sistemasActivos.push(estacion.colisiones, ...estacion.escotillas.map((e) => e.colision), exterior.colisiones);
  loco = new Locomocion0G({ rig, cabeza: camera, colisionadores, estructura: estacion.colisiones, barandas: estacion.barandas });
  flotantes = new SistemaFlotantes({ colisionadores, pasillos: PASILLOS });

  // ---- objetos sueltos del kit: las herramientas se reemplazan por las que tienen punto de agarre
  const ponerHerramienta = (tipo, posicion, giroY = 0) => {
    const h = fabrica.crear(tipo);
    h.malla.position.copy(posicion);
    h.malla.rotation.y = giroY;
    estacion.grupo.add(h.malla);
    const f = flotantes.agregar(h.malla, h.radio, { tipo, agarre: h.agarre, fijo: true, datos: { herramienta: true, pantalla: h.pantalla } });
    f.reposo.giro.copy(h.malla.quaternion);
    if (tipo === 'escaner') {
      escaneres.push(new Escaner({ flotante: f, pantalla: h.pantalla, inventario, sonido, alLeer: alLeer }));
    } else if (tipo === 'tablet') {
      const t = new TabletLogistica({ pantalla: h.pantalla, inventario, gestor, navegacion, ajustes, acciones: {
        iniciar: iniciarActividad, pausar: () => gestor.pausar(), reanudar: () => gestor.reanudar(), abandonar: () => gestor.abandonar(), guiar,
        abrirMapa: () => mapa.abrir(camera, eva.afuera ? null : estacion.colisiones),
        ajuste: (clave, valor) => {
          const r = RANGOS_AJUSTES[clave];
          ajustes[clave] = typeof valor === 'number' && r ? Math.round(THREE.MathUtils.clamp(valor, r[0], r[1]) * 100) / 100 : valor;
          guardarAjustes();
          if (clave === 'volumen') { sonido.factor = ajustes.volumen; sonido.tocar('clic'); }
          t.panel.sucio = true;
        },
        siguienteInclinacion: () => {
          const actual = ajustes.giroVertical ? ajustes.limiteInclinacion : 0;
          const i = LIMITES_INCLINACION.indexOf(actual);
          const nuevo = LIMITES_INCLINACION[(i + 1) % LIMITES_INCLINACION.length];
          ajustes.giroVertical = nuevo > 0;
          if (nuevo > 0) ajustes.limiteInclinacion = nuevo;
          guardarAjustes();
          t.panel.sucio = true;
        },
        siguienteTunel: () => ORDEN_TUNEL[(ORDEN_TUNEL.indexOf(ajustes.tunel) + 1) % ORDEN_TUNEL.length],
        calibrarManos: () => { manos.calibrar(manos.calibracion + 1); ajustes.calibracionManos = manos.calibracion; guardarAjustes(); return manos.calibracion; },
        reunir: reunirHerramientas,
        practica: () => empezarPractica(),
        sesion: () => sesion.descripcion,
        resumenCierre: () => resumenParaCerrar(gestor),
        nuevoEstudiante,
      } });
      paneles.agregar(t.panel);
      tablets.push(t);
      f.datos.tablet = t;
    } else if (tipo === 'linterna') {
      const haz = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 12, 1, true).translate(0, -0.45, 0).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xfff0b8, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      haz.position.y = 0.1;
      haz.visible = false;
      h.malla.add(haz);
      f.datos.haz = haz;
    } else if (h.pantalla) {
      const { ctx, canvas, textura } = h.pantalla.userData.lienzo;
      ctx.fillStyle = '#0b1a2b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#7dffa8';
      ctx.font = `bold ${Math.round(canvas.height * 0.3)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(tipo === 'medidor' ? '120,4 V' : 'LISTO', canvas.width / 2, canvas.height * 0.6);
      textura.needsUpdate = true;
    }
    return f;
  };
  for (const malla of estacion.flotantes) {
    const tipoKit = /_Flot_([A-Za-z]+)_/.exec(malla.name)?.[1] || '';
    if (REEMPLAZOS[tipoKit]) {
      malla.removeFromParent();
      ponerHerramienta(REEMPLAZOS[tipoKit], malla.position, malla.position.x > 0 ? -0.6 : 0.6);
    } else if (/Paquete|Caja|Bolsa/.test(tipoKit)) {
      const f = flotantes.agregar(malla, malla.userData.radio, { tipo: 'contenedor', agarre: agarreLibre(malla.userData.radio) });
      inventario.registrarContenedor(f);
    } else {
      const plano = /Portapapeles|Manual/.test(tipoKit);
      flotantes.agregar(malla, malla.userData.radio, { tipo: tipoKit, agarre: plano ? agarrePlano(malla.geometry) : agarreLibre(malla.userData.radio) });
    }
  }
  // herramientas que el kit no trae, en su lugar de guardado
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  ponerHerramienta('escaner', V(0.62, 0.30, -5.60), -0.6);
  ponerHerramienta('tablet', V(-0.52, 0.22, -0.40), 0.5);
  ponerHerramienta('inspector', V(0.55, 0.36, 4.30), -0.6);
  ponerHerramienta('medidor', V(0.56, 0.02, 4.42), -0.6);
  ponerHerramienta('radio', V(0.60, 0.45, 3.05), -0.6);
  ponerHerramienta('tarjeta', V(0.48, -0.32, 1.25), -0.4);
  ponerHerramienta('inspector', V(2.08, 0.36, 2.86), -1.2);        // soporte exterior de la esclusa
  ponerHerramienta('llave', V(2.08, 0.08, 2.92), -1.2);

  // ---- tanques de lastre del balance de masas (js/balance.js): esperan ocultos hasta que empieza la actividad
  balance = new BalanceRivera(inventario);
  const geoTanque = geometriaTanque();
  geoTanque.computeBoundingSphere();
  for (const t of TANQUES) {
    const malla = new THREE.Mesh(geoTanque, fabrica.material);
    malla.name = `Tanque_${t.codigo}`;
    malla.position.set(...t.posicion);
    estacion.grupo.add(malla);
    const f = flotantes.agregar(malla, geoTanque.boundingSphere.radius, {
      tipo: 'contenedor', agarre: agarreLibre(geoTanque.boundingSphere.radius), fijo: true,
      datos: { codigo: t.codigo, descripcion: `Lastre de agua ${t.pesoKg} kg`, pesoKg: t.pesoKg, destino: '', hueco: null, escaneado: false, lastre: true },
    });
    f.oculto = true;
    inventario.contenedores.push(f);
    balance.tanques.push(f);
  }

  // ---- filtros de CO₂ del soporte vital (js/filtro.js): el instalado (gastado) y los de repuesto del rack TAC-B1
  const filtrosF = estacion.filtros.map((malla) => {
    const gastado = /instalado/.test(malla.name);
    const codigo = gastado ? 'FILTRO-CO2-GASTADO' : `FILTRO-CO2-${malla.name.split('_').pop()}`;
    return flotantes.agregar(malla, malla.userData.radio, { tipo: 'filtro', agarre: agarreLibre(malla.userData.radio), fijo: true, datos: { codigo, gastado, filtro: true } });
  });
  cambioFiltro = new CambioFiltro({ puerta: estacion.puertaFiltro, filtros: filtrosF });
  portales.agregar(estacion.puertaFiltro, estacion.puertaFiltro.position);

  // ---- un lote de dibujo por material para todos los objetos sueltos (js/lotes.js)
  lotes = new LotesFlotantes(scene);
  lotes.armar(flotantes.objetos);

  // ---- soltar y tomar: el contenedor queda apoyado en el hueco y se amarra con el trinquete (js/amarre.js)
  /** Nombre de un objeto para la telemetría: el código de la carga o el tipo de herramienta. */
  const nombreTelemetria = (f) => (f.datos && f.datos.codigo) || f.tipo || f.malla.name;
  flotantes.alSoltar = (f) => {
    if (f.tipo === 'contenedor' || f.tipo === 'filtro' || (f.datos && f.datos.herramienta)) telemetria.registrar('release', nombreTelemetria(f));
    if (f.tipo === 'filtro') { cambioFiltro.soltado(f); return; }
    if (f.tipo !== 'contenedor') return;
    // red de cuarentena de Colonia: lo que se suelta adentro queda retenido ahí
    if (descarga.dentroDeCuarentena(f.posicion)) {
      f.fijo = true;
      f.velocidad.set(0, 0, 0);
      f.casa.copy(f.posicion);
      f.datos.cuarentena = true;
      const manifestado = descarga.manifestado(f.datos.codigo);
      sonido.tocar(manifestado ? 'aviso' : 'ok');
      avisar(`${f.datos.codigo} en la red de cuarentena`, manifestado ? 'error' : 'ok');
      gestor.evento('cuarentena', { codigo: f.datos.codigo, manifestado });
      telemetria.registrar(manifestado ? 'snap_fail' : 'snap_ok', f.datos.codigo, 'cuarentena', manifestado ? 'estaba en el manifiesto' : null);
      panelesDescarga.manifiesto.sucio = true;
      return;
    }
    const h = inventario.huecoCercano(f.posicion, 0.32);
    if (!h) return;
    f.fijo = true;
    f.velocidad.set(0, 0, 0);
    f.posicion.copy(h.posicion);
    f.malla.quaternion.copy(h.giro);
    f.casa.copy(h.posicion);
    amarres.apoyar(f);
    const correcto = inventario.colocar(f, h);
    sonido.tocar(correcto ? 'ok' : 'aviso');
    avisar(correcto ? `${f.datos.codigo} apoyado en ${h.codigo}. Amarralo: mano libre junto al trinquete naranja y ${DIENTES} veces el gatillo` : `${f.datos.codigo} quedó en ${h.codigo}, pero su lugar es ${f.datos.destino}`, correcto ? 'ok' : 'error', correcto ? 5 : 3.5);
    gestor.evento('colocado', { codigo: f.datos.codigo, hueco: h.codigo, destino: f.datos.destino, correcto });
    telemetria.registrar(correcto ? 'snap_ok' : 'snap_fail', f.datos.codigo, h.codigo, correcto ? null : `va en ${f.datos.destino}`);
  };
  amarres.alAmarrar = (f) => {
    const h = f.datos.hueco;
    const correcto = !!h && (!f.datos.destino || h.codigo === f.datos.destino);   // los tanques de lastre van en cualquier hueco
    avisar(correcto ? `${f.datos.codigo} amarrado en ${h.codigo}` : `${f.datos.codigo} amarrado, pero en un hueco que no es el suyo`, correcto ? 'ok' : 'error');
    gestor.evento('amarrado', { codigo: f.datos.codigo, hueco: h ? h.codigo : '', destino: f.datos.destino, correcto });
    telemetria.registrar('strap', f.datos.codigo, h ? h.codigo : null, correcto ? null : 'hueco equivocado');
  };
  flotantes.alTomar = (f) => {
    if (f.tipo === 'contenedor' || f.tipo === 'filtro' || (f.datos && f.datos.herramienta)) telemetria.registrar('grab', nombreTelemetria(f));
    if (f.tipo === 'filtro') cambioFiltro.tomado(f);
    if (f.tipo === 'contenedor' && f.datos.hueco) {
      inventario.retirar(f);
      amarres.quitar(f);
    }
    if (f.datos && f.datos.cuarentena) f.datos.cuarentena = false;
    if (f.datos && f.datos.tablet) f.datos.tablet.panel.sucio = true;
  };

  // ---- actividades, puntos de trabajo, navegación y mapa
  inspecciones = new Inspecciones(scene, (tipo, datos) => {
    gestor.evento(tipo, datos);
    if (tipo === 'inspeccion') telemetria.registrar('inspect', datos.punto, null, datos.herramienta);
    if (tipo === 'herramienta_incorrecta') telemetria.registrar('snap_fail', datos.punto, datos.pide, `herramienta incorrecta: ${datos.herramienta}`);
    if (tipo === 'pista') { telemetria.pistas++; telemetria.registrar('hint', datos.punto, null, datos.texto); }
    if (tipo === 'inspeccion') { sonido.tocar('ok'); manos.vibrarTodas(0.6, 60); }
  });
  for (const [id, p] of Object.entries(PUNTOS_TALLER)) inspecciones.agregar(id, p.posicion, p.herramienta, p.segundos, p.texto);
  estacion.grupo.add(crearTapaTablero(PUNTOS_TALLER.tapa_tablero.posicion));
  for (const [id, p] of Object.entries(PUNTOS_EVA)) inspecciones.agregar(id, PUNTOS_EXTERIORES[id], p.herramienta, p.segundos, p.texto);
  // ---- minijuego A: descarga del carguero en Colonia (js/descarga.js)
  descarga = new DescargaCarguero({ contenedores: inventario.contenedores, escotilla: estacion.escotillas.find((e) => e.malla.name === 'C_Escotilla_HaciaCarguero') });
  descarga.alIgualar = () => { sonido.tocar('ok'); avisar('Presión igualada: ya se puede abrir la escotilla', 'ok'); gestor.evento('presion_igualada', {}); };
  descarga.alLeer = (f, manifestado) => {
    sonido.tocar(manifestado ? 'ok' : 'aviso');
    manos.vibrarTodas(0.5, 50);
    if (manifestado) avisar(`RFID: ${f.datos.codigo} recibido`, 'ok');
    gestor.evento('rfid', { codigo: f.datos.codigo, manifestado });
    telemetria.registrar('scan', f.datos.codigo, 'portal_rfid', manifestado ? 'rfid · en manifiesto' : 'rfid · no manifestado');
    panelesDescarga.rfid.sucio = true;
    panelesDescarga.manifiesto.sucio = true;
  };
  panelesDescarga = {
    presion: crearPanelPresion(descarga, {
      igualar: () => { if (descarga.igualar()) { sonido.tocar('aviso'); avisar('Igualando la presión…'); } },
      abrir: () => { if (descarga.abrir()) { sonido.tocar('logro'); avisar('Escotilla del carguero abierta', 'ok'); gestor.evento('escotilla_abierta', {}); } },
    }),
    rfid: crearPanelRfid(descarga),
    manifiesto: crearPanelManifiesto(descarga, {
      estado: () => gestor.obtener('descarga').estado,
      puedeIniciar: () => !gestor.impedimento('descarga'),
      iniciar: () => iniciarActividad('descarga'),
      faltante: () => {
        const todoLeido = descarga.todoLeido;
        if (todoLeido) descarga.faltanteInformado = true;
        gestor.evento('faltante', { todoLeido });
        telemetria.registrar(todoLeido ? 'snap_ok' : 'snap_fail', 'faltante', 'consola_recepcion', todoLeido ? 'faltante informado' : 'informado antes de leer toda la carga');
      },
      pausar: () => gestor.pausar(),
      reanudar: () => gestor.reanudar(),
      abandonar: () => gestor.abandonar(),
    }),
  };
  for (const p of Object.values(panelesDescarga)) {
    scene.add(p.malla);
    paneles.agregar(p);
    portales.agregar(p.malla, p.malla.position);
  }
  terminales.push(panelesDescarga.manifiesto);
  // ---- cambio del filtro de CO₂: la pantalla de soporte vital es su terminal
  cambioFiltro.alEvento = (tipo, d) => {
    if (tipo === 'filtro_puerta') { sonido.tocar('clic'); avisar(d.abierta ? 'Puerta del filtro abierta' : 'Puerta del filtro cerrada'); }
    if (tipo === 'filtro_sacado') { sonido.tocar('clic'); if (d.gastado) avisar('Filtro gastado afuera: tomá uno de repuesto del rack TAC-B1'); }
    if (tipo === 'filtro_puesto') {
      sonido.tocar(d.gastado ? 'aviso' : 'ok');
      manos.vibrarTodas(0.6, 60);
      if (!d.gastado) avisar('Filtro de repuesto encastrado: 100 %. Cerrá la puerta', 'ok');
      telemetria.registrar(d.gastado ? 'snap_fail' : 'snap_ok', d.codigo, 'alojamiento_filtro', d.gastado ? 'volvió a poner el gastado' : null);
    }
    gestor.evento(tipo, d);
    pantallaSoporte.sucio = true;
  };
  pantallaSoporte = crearPantallaSoporte(cambioFiltro, {
    estado: () => gestor.obtener('filtro').estado,
    puedeIniciar: () => !gestor.impedimento('filtro'),
    iniciar: () => iniciarActividad('filtro'),
    pausar: () => gestor.pausar(),
    reanudar: () => gestor.reanudar(),
    abandonar: () => gestor.abandonar(),
  });
  scene.add(pantallaSoporte.malla);
  paneles.agregar(pantallaSoporte);
  portales.agregar(pantallaSoporte.malla, pantallaSoporte.malla.position);
  terminales.push(pantallaSoporte);
  definirActividades(gestor, {
    inventario, inspecciones, balance, descarga, filtro: cambioFiltro,
    // B07: semilla de la sesión; con ?semilla=123 se reproduce un caso que reportó un docente
    semilla: /^\d+$/.test(new URLSearchParams(window.location.search).get('semilla') || '') ? Number(new URLSearchParams(window.location.search).get('semilla')) : undefined,
    // Almacenamiento repetido con todo ya guardado: estos contenedores vuelven sueltos a su lugar de origen,
    // igual que los tanques del balance al iniciarlo (B01)
    reacomodarContenedores: (lista) => {
      for (const f of lista) {
        if (f.datos.hueco) { inventario.retirar(f); amarres.quitar(f); }
        flotantes.guardar(f);
      }
      if (lista.length) avisar(`Partida nueva: ${lista.map((f) => f.datos.codigo).join(', ')} volvieron sueltos al almacén`, 'ok', 5);
      return lista.length;
    },
  });

  eva = new EVAController({
    rig, camara: camera, escena: scene, loco, manos, exterior, transicion, sonido,
    objetivo: () => (gestor.activa && gestor.activa.pasoActual ? gestor.activa.pasoActual.texto : 'Caminata libre · el mapa se abre con el gatillo izquierdo'),
    alCambiar: (fase) => {
      navegacion.cancelar();
      gestor.evento('eva', { fase });
      avisar(fase === 'afuera' ? 'Estás afuera. Avanzá de pasamanos en pasamanos.' : 'De vuelta en el Nodo Montevideo', 'ok');
    },
  });
  mapa = new MapaEstacion({ paneles, escena: scene, camara: camera, navegacion, gestor, acciones: { guiar, trasladar, iniciar: iniciarActividad, cancelarGuia: () => navegacion.cancelar() }, estado: () => ({ afuera: eva.afuera }) });

  crearTerminal('almacenamiento', V(0.86, 0.36, 0.615), Math.PI);
  crearTerminal('inventario', V(0.86, -0.02, 0.615), Math.PI);
  crearTerminal('recepcion', V(0.86, 0.30, -4.955), Math.PI);
  crearTerminal('mantenimiento', V(0.86, 0.30, 3.625), 0);
  // el panel de balance del Nodo es también el terminal de su actividad (js/balance.js)
  panelBalance = crearPanelBalance(balance, {
    confirmar: () => {
      const d = balance.medir();
      gestor.evento('balance_confirmar', { dentro: balance.dentro, desvio: d, tolerancia: balance.tolerancia, amarrados: balance.amarrados() });
      telemetria.registrar(balance.dentro ? 'snap_ok' : 'snap_fail', 'balance', null, `desvío ${(d * 100).toFixed(1)} cm · tolerancia ${(balance.tolerancia * 100).toFixed(1)} cm`);
    },
    estado: () => gestor.obtener('balance').estado,
    puedeIniciar: () => !gestor.impedimento('balance'),
    iniciar: () => iniciarActividad('balance'),
    pausar: () => gestor.pausar(),
    reanudar: () => gestor.reanudar(),
    abandonar: () => gestor.abandonar(),
  });
  panelBalance.malla.position.set(-1.141, 0.18, 2.105);   // sobre la pantalla del panel de balance del kit
  panelBalance.malla.rotation.y = Math.PI / 2;
  scene.add(panelBalance.malla);
  paneles.agregar(panelBalance);
  terminales.push(panelBalance);
  portales.agregar(panelBalance.malla, panelBalance.malla.position);
  crearTerminal('eva', V(1.175, 0.02, 3.02), -Math.PI / 2, { texto: () => 'SALIR AL EXTERIOR', accion: () => { camera.getWorldPosition(cabeza); const m = eva.salir(cabeza); if (m) avisar(m, 'error'); } });
  crearTerminal('eva', V(1.80, 0.0, 1.25), Math.PI / 2, { texto: () => 'ENTRAR A LA ESTACIÓN', accion: () => { camera.getWorldPosition(cabeza); const m = eva.entrar(cabeza); if (m) avisar(m, 'error'); } });

  gestor.escuchar((tipo, a, dato) => {
    // (la telemetría de cada actividad la conecta js/sesion.js → conectarTelemetria)
    for (const t of terminales) t.sucio = true;
    for (const t of tablets) t.panel.sucio = true;
    if (mapa) mapa.panel.sucio = true;
    if (tipo === 'inicio') {
      sonido.tocar('aviso'); abrirInforme('instrucciones', a); if (mapa) mapa.cerrar();
      // el taller arranca ordenado: las herramientas sueltas de Tacuarembó vuelven a su lugar
      if (a.id === 'filtro') { cambioFiltro.preparar(); pantallaSoporte.sucio = true; }
      if (a.id === 'descarga') {
        // la carga del turno vuelve a la bodega del carguero y la escotilla se traba hasta igualar la presión
        descarga.preparar();
        for (const f of descarga.carga) {
          if (f.mano) { f.mano.sostiene = null; f.mano = null; }
          if (f.datos.hueco) { inventario.retirar(f); amarres.quitar(f); }
          f.datos.cuarentena = false;
          f.posicion.copy(descarga.posicionInicial(f));
          f.malla.quaternion.identity();
          f.casa.copy(f.posicion);
          f.velocidad.set(0, 0, 0);
          f.libre = false;
          f.fijo = true;
          f.datos.zPrevia = null;
        }
        for (const p of Object.values(panelesDescarga)) p.sucio = true;
      }
      if (a.id === 'balance') {
        // los tanques vuelven a esperar junto a la escotilla y se calcula la tolerancia con los huecos libres
        for (const f of balance.tanques) {
          if (f.datos.hueco) { inventario.retirar(f); amarres.quitar(f); }
          flotantes.guardar(f);
          f.oculto = false;
        }
        balance.preparar();
      }
      if (a.id === 'mantenimiento') for (const f of flotantes.objetos) if (f.datos && f.datos.herramienta && !f.mano && f.reposo.posicion.z > 3.6) flotantes.guardar(f);
    }
    if (tipo === 'paso') { sonido.tocar('logro'); if (a.pasoActual) avisar(`✔ ${dato.texto}`, 'ok'); }
    if (tipo === 'error') { sonido.tocar('error'); avisar(dato, 'error'); manos.vibrarTodas(0.8, 90); }
    if (tipo === 'aviso') avisar(dato);
    if (tipo === 'desbloqueo') avisar(`Nueva actividad disponible: ${a.def.titulo}`, 'ok', 5);
    if ((tipo === 'fin' || tipo === 'abandono') && a.id === 'descarga') { descarga.terminar(); for (const p of Object.values(panelesDescarga)) p.sucio = true; }
    if (tipo === 'fin' || tipo === 'abandono') {
      inspecciones.activar([]);
      if (tipo === 'fin') {
        sonido.tocar(a.resultado.completada ? 'logro' : 'error');
        abrirInforme('resultado', a);
        if (!a.resultado.completada && eva.afuera) eva.regresoDeEmergencia();
      }
    }
  });
  navegacion.alLlegar = (id) => { sonido.tocar('ok'); avisar(`Llegaste: ${LUGAR[id].nombre}`, 'ok'); };
  navegacion.alCambiarModulo = (id, nuevo) => {
    if (LUGAR[id] && nuevo) avisar(`${LUGAR[id].nombre} · ${LUGAR[id].rol}`);
    for (const b of document.querySelectorAll('#modulos button')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
  };

  ir(INICIO);
  document.getElementById('cargando').remove();
  // para las pruebas automáticas y para depurar desde la consola
  // B24: el acceso de depuración (pruebas automáticas y consola) solo en un servidor local o con ?depurar.
  // Con ?depurar fuera de local, la telemetría se apaga: lo que se haga desde la consola no llega al panel docente.
  const depuracion = {
    guanteListo, manosPoses: POSES,
    THREE, renderer, scene, camera, rig, loco, estacion, etiquetas, manos, orbital, texturasTierra: () => texTierraCargadas, flotantes, ir, manosDePrueba,
    inventario, amarres, medidorFps, lotes: () => lotes, portales: () => portales, telemetria, balance: () => balance, panelBalance: () => panelBalance, descarga: () => descarga, panelesDescarga: () => panelesDescarga, cambioFiltro: () => cambioFiltro, pantallaSoporte: () => pantallaSoporte, escaneres, tablets, terminales, paneles, gestor, navegacion, mapa, exterior, eva, inspecciones, transicion, confort, sonido, ajustes, guardarAjustes, inclinacionDelCuerpo,
    acciones: { guiar, trasladar, iniciarActividad, avisar, reunirHerramientas, mostrarBienvenida, empezarPractica, mostrarPanelSesion, nuevoEstudiante }, induccion, panelBienvenida, panelPractica, aviso, panelInforme, teclas,
    sesion, panelSesion, reinicio,
    avanzar: (dt = 1 / 72, dibujar = false) => cuadro(0, null, dt, !dibujar),
  };
  const local = esServidorLocal(window.location);
  if (local || new URLSearchParams(window.location.search).has('depurar')) {
    window.artigas1 = depuracion;
    if (!local) {
      telemetria.config.backend = null;
      telemetria.estadoBackend = 'ninguno';
      console.info('Artigas-1: modo de depuración (window.artigas1). La telemetría queda apagada.');
    }
  }
}).catch((e) => {
  pct.textContent = '· no se pudo cargar la estación. Recargá la página; si sigue igual, avisale a tu docente.';
  console.error(e);
});

function alLeer(l) {
  for (const t of tablets) if (l.ok) t.lectura(l.codigo);
  if (l.ok) avisar(`${l.codigo} · ${l.descripcion} · ${l.destino ? `va en ${l.destino}` : l.ubicacion}`, 'ok');
  else avisar(`${l.texto}. ${l.detalle}.`, 'error', 2.5);
  manos.vibrarTodas(l.ok ? 0.6 : 1, l.ok ? 50 : 140);
  gestor.evento('escaneo', l);
  if (l.ok) induccion.marcar('escaneo');
  telemetria.registrar('scan', l.ok ? l.codigo : (l.bulto && l.bulto.codigo) || null, null, l.ok ? 'ok' : l.motivo);
}

// =====================================================================================================
// Vista y entrada
// =====================================================================================================
let yaw = 0;
let pitch = 0;

/** En la compu: el cuerpo gira en horizontal y la cámara inclina. En el visor manda la cabeza. */
function aplicarMirada() {
  rig.quaternion.setFromAxisAngle(ARRIBA, yaw);
  camera.rotation.set(renderer.xr.isPresenting ? 0 : pitch, 0, 0);
}

// lista de módulos del panel de la página (en la compu): traslado directo
const botones = document.getElementById('modulos');
for (const id of ['tacuarembo', 'nodo', 'cupula', 'rivera', 'colonia', 'carguero']) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = `${LUGAR[id].nombre} · ${LUGAR[id].rol.split(':')[0].split(' y ')[0].toLowerCase()}`;
  b.dataset.id = id;
  b.addEventListener('click', () => { if (eva && eva.afuera) return; ir(id); });
  botones.appendChild(b);
}
document.getElementById('ocultar').addEventListener('click', () => { document.getElementById('panel').hidden = true; });

// mouse: arrastrar para mirar; clic sin arrastrar, sobre un panel, aprieta el botón
let arrastre = null;
const mouse = { origen: new THREE.Vector3(), direccion: new THREE.Vector3(), clic: false, sobrePanel: false, ndc: new THREE.Vector2(), activo: false };
const rayoMouse = new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown', (e) => { arrastre = { x: e.clientX, y: e.clientY, movido: 0 }; manos.escritorio.gatillo = e.button === 0 && manos.escritorio.sostiene ? 1 : manos.escritorio.gatillo; });
window.addEventListener('pointerup', () => {
  if (arrastre && arrastre.movido < 5) mouse.clic = true;
  arrastre = null;
  manos.escritorio.gatillo = teclas.has('KeyX') ? 1 : 0;
});
window.addEventListener('pointermove', (e) => {
  mouse.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.activo = true;
  if (!arrastre || renderer.xr.isPresenting) return;
  const dx = e.clientX - arrastre.x;
  const dy = e.clientY - arrastre.y;
  arrastre.movido += Math.abs(dx) + Math.abs(dy);
  yaw -= dx * 0.004;
  pitch = THREE.MathUtils.clamp(pitch - dy * 0.004, -1.5, 1.5);
  arrastre.x = e.clientX;
  arrastre.y = e.clientY;
  aplicarMirada();
  if (arrastre.movido > 60) induccion.marcar('giro');     // en la compu se gira arrastrando
});
const teclas = new Set();
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  teclas.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  if (!loco || renderer.xr.isPresenting) return;
  const m = manos.escritorio;
  if (e.code === 'KeyF') m.cerrada = !m.cerrada;                       // tomar / soltar
  if (e.code === 'KeyX') m.gatillo = 1;                                // gatillo de la mano
  if (e.code === 'KeyM') mapa.alternar(camera, eva.afuera ? null : estacion.colisiones);
  if (e.code === 'KeyV') terceraPersona = !terceraPersona;
  if (e.code === 'KeyT') traerTablet();
});
window.addEventListener('keyup', (e) => { teclas.delete(e.code); if (e.code === 'KeyX') manos.escritorio.gatillo = 0; });
window.addEventListener('blur', () => teclas.clear());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  camaraExterna.aspect = camera.aspect;
  camaraExterna.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.xr.addEventListener('sessionstart', () => {
  pitch = 0; aplicarMirada(); sonido.activar(); terceraPersona = false;
  // primero el inicio de sesión; con la sesión lista, la bienvenida (una vez por estudiante), en el primer
  // cuadro con la cabeza ya ubicada
  if (!sesion.lista) sesionPendiente = true;
  else if (!sesion.bienvenidaVista) bienvenidaPendiente = true;
});
renderer.xr.addEventListener('sessionend', () => aplicarMirada());

/** En la compu: trae la tablet más cercana a la mano (tecla T). */
function traerTablet() {
  const m = manos.escritorio;
  if (m.sostiene) { m.cerrada = false; return; }
  let mejor = null;
  for (const f of flotantes.objetos) if (f.tipo === 'tablet' && !f.mano && (!mejor || f.posicion.distanceToSquared(m.posicion) < mejor.posicion.distanceToSquared(m.posicion))) mejor = f;
  if (!mejor) return;
  mejor.posicion.copy(m.posicion);
  mejor.malla.visible = true;
  m.cerrada = false;
  flotantes.gestionarManos(0, [m]);
  m.cerrada = true;
}

const empuje = new THREE.Vector3();
const adelante = new THREE.Vector3();
const derecha = new THREE.Vector3();
const arribaRig = new THREE.Vector3();
let frenando = false;
let giroListo = true;
let velGiro = 0;
let velInclinacion = 0;
let girandoSuave = false;
const previos = new Map();

function botonNuevo(clave, apretado) {
  const antes = previos.get(clave) === true;
  previos.set(clave, apretado);
  return apretado && !antes;
}

function ejes() {
  camera.getWorldDirection(adelante);
  derecha.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  arribaRig.copy(ARRIBA).applyQuaternion(rig.quaternion);
}

/**
 * Orientación con el stick derecho. Se mueve el rig (el cuerpo) alrededor de la cabeza; la cámara la maneja
 * solo el visor, así que el seguimiento de la cabeza no se toca y se suma a lo que haga el stick.
 *  - A los costados: giro alrededor del «arriba» de la estación.
 *  - Arriba y abajo: giro alrededor del eje horizontal derecho de la mirada.
 * Con esos dos ejes la vista nunca queda rolada (el horizonte de la estación no se inclina), por más giros que
 * se combinen. La inclinación acumulada con el stick se limita con `limiteInclinacion`.
 */
const _ejeHorizontal = new THREE.Vector3();
const _arribaPrueba = new THREE.Vector3();

/**
 * Eje horizontal derecho de la mirada: perpendicular a la dirección en que se mira y al arriba de la estación.
 * Sale solo de la dirección de la mirada, no del roll de la cabeza: inclinar la vista alrededor de este eje no
 * puede rolar la vista, aunque la cabeza esté girada respecto del cuerpo.
 */
function ejeInclinacion(out) {
  camera.updateWorldMatrix(true, false);
  camera.getWorldDirection(_v);
  out.crossVectors(_v, ARRIBA);
  if (out.lengthSq() < 1e-6) {
    // mirando justo arriba o abajo: el derecho sale de la columna derecha de la cámara, sin su parte vertical
    out.setFromMatrixColumn(camera.matrixWorld, 0);
    out.addScaledVector(ARRIBA, -out.dot(ARRIBA));
  }
  return out.normalize();
}

/** Inclinación del cuerpo hecha con el stick (ángulo entre su arriba y el de la estación), en radianes. */
function inclinacionDelCuerpo() {
  return _arribaPrueba.copy(ARRIBA).applyQuaternion(rig.quaternion).angleTo(ARRIBA);
}

/**
 * Cuánto se puede inclinar ahora hacia arriba (signo +) o hacia abajo (signo -) sin pasar el límite.
 * Devuelve el ángulo permitido, con el signo de `angulo`.
 */
function inclinacionPermitida(eje, angulo) {
  const limite = THREE.MathUtils.degToRad(ajustes.limiteInclinacion);
  _q.setFromAxisAngle(eje, angulo);
  const despues = _arribaPrueba.copy(ARRIBA).applyQuaternion(rig.quaternion).applyQuaternion(_q).angleTo(ARRIBA);
  if (despues <= limite + 1e-4) return angulo;
  // pasaría el límite: se permite solo lo que falta para llegar (si se está volviendo, todo)
  const antes = inclinacionDelCuerpo();
  if (despues < antes) return angulo;
  const falta = Math.max(0, limite - antes);
  return Math.sign(angulo) * Math.min(Math.abs(angulo), falta);
}

/** Gira el cuerpo alrededor de la cabeza: el seguimiento del visor no se toca. */
function girarAlrededorDeLaCabeza(eje, angulo) {
  camera.getWorldPosition(cabeza);
  _q.setFromAxisAngle(eje, angulo);
  rig.position.sub(cabeza).applyQuaternion(_q).add(cabeza);
  rig.quaternion.premultiply(_q).normalize();
}

/** Respuesta del stick: zona muerta y curva progresiva (cuadrática). Devuelve -1…1. */
function respuestaStick(v) {
  const z = ajustes.zonaMuerta;
  const a = Math.abs(v);
  if (a <= z) return 0;
  const u = Math.min(1, (a - z) / (1 - z));
  return Math.sign(v) * u * u;
}

/** Endereza el cuerpo: deja solo el giro horizontal (botón B). */
function enderezar() {
  camera.getWorldPosition(cabeza);
  camera.getWorldDirection(_v);
  const y = Math.atan2(-_v.x, -_v.z);
  const local = _pos.copy(camera.position);
  rig.quaternion.setFromAxisAngle(ARRIBA, y - Math.atan2(-Math.sin(camera.rotation.y), -Math.cos(camera.rotation.y)) + Math.PI);
  rig.quaternion.setFromAxisAngle(ARRIBA, y);
  rig.position.copy(cabeza).sub(local.applyQuaternion(rig.quaternion));
  yaw = y;
}

/**
 * Controles del visor:
 *   stick izquierdo  mover hacia donde se mira y de costado      X / Y   bajar / subir
 *   stick derecho    girar 30° y mirar arriba o abajo 20°, con parpadeo a negro (o suave)
 *                                                                A       freno    B   enderezar
 *   gatillo izq.     sostener la tablet del mapa (mientras se aprieta)   gatillo der.   usar la herramienta o apretar un botón
 *   grips            tomar y soltar
 */
function entradaXR(dt) {
  ejes();
  const izq = manos.mano('left');
  const der = manos.mano('right');
  if (izq) {
    const [x, y] = izq.ejes;
    if (Math.abs(x) > 0.15) empuje.addScaledVector(derecha, x);
    if (Math.abs(y) > 0.15) empuje.addScaledVector(adelante, -y);
    if (izq.botones[1]) empuje.add(arribaRig);
    if (izq.botones[0]) empuje.sub(arribaRig);
    // gatillo del índice izquierdo: mientras se aprieta, la mano izquierda sostiene la tablet del mapa; al
    // soltarlo, la guarda (salvo que esa mano lleve una herramienta o el gatillo haya sido para un botón)
    if (izq.gatilloNuevo && !izq.gatilloUsado && !izq.sostiene) mapa.sostener(izq);
    else if (mapa.mano === izq && mapa.abierto && !izq.gatilloApretado) mapa.cerrar();
  }
  if (der) {
    const [x, y] = der.ejes;
    const s = ajustes.sensibilidad;
    const z = ajustes.zonaMuerta;
    if (ajustes.giro === 'suave') {
      // opcional: giro continuo con zona muerta, curva progresiva, aceleración suave y velocidad máxima; el túnel
      // se cierra mientras gira
      const metaH = -respuestaStick(x) * THREE.MathUtils.degToRad(95) * s;
      const metaV = ajustes.giroVertical ? -respuestaStick(y) * THREE.MathUtils.degToRad(55) * s : 0;
      velGiro += (metaH - velGiro) * (1 - Math.exp(-12 * dt));        // sin arranques ni frenadas bruscas
      velInclinacion += (metaV - velInclinacion) * (1 - Math.exp(-12 * dt));
      if (Math.abs(velGiro) > 1e-4) girarAlrededorDeLaCabeza(ARRIBA, velGiro * dt);
      if (Math.abs(velGiro) > 0.5) induccion.marcar('giro');   // con giro suave también se practica
      if (Math.abs(velInclinacion) > 1e-4) {
        const eje = ejeInclinacion(_ejeHorizontal);
        const permitido = inclinacionPermitida(eje, velInclinacion * dt);
        if (permitido !== velInclinacion * dt) velInclinacion = 0;     // tope: frena en seco solo el giro vertical
        if (permitido !== 0) girarAlrededorDeLaCabeza(eje, permitido);
      }
      girandoSuave = Math.abs(velGiro) > 0.05 || Math.abs(velInclinacion) > 0.05;
    } else {
      // de fábrica: un salto por empujón, hecho con la vista en negro (parpadeo): 30° a los costados y 20° arriba
      // o abajo. Para el siguiente hay que volver el stick al centro. La dirección que manda es la más empujada.
      velGiro = 0;
      velInclinacion = 0;
      const horizontal = Math.abs(x) >= Math.abs(y);
      if (giroListo && horizontal && Math.abs(x) > 0.7) {
        const angulo = x > 0 ? -Math.PI / 6 : Math.PI / 6;
        if (confort.parpadear(() => girarAlrededorDeLaCabeza(ARRIBA, angulo))) { giroListo = false; induccion.marcar('giro'); }
      } else if (giroListo && !horizontal && ajustes.giroVertical && Math.abs(y) > 0.7) {
        const eje = ejeInclinacion(_ejeHorizontal).clone();
        const angulo = inclinacionPermitida(eje, y > 0 ? -Math.PI / 9 : Math.PI / 9);
        if (Math.abs(angulo) < THREE.MathUtils.degToRad(1)) {
          manos.vibrar(der, 0.25, 40);                                 // tope de inclinación: un toque, sin parpadeo
          giroListo = false;
        } else if (confort.parpadear(() => girarAlrededorDeLaCabeza(eje, angulo))) {
          giroListo = false;
        }
      } else if (Math.abs(x) < Math.max(0.3, z + 0.1) && Math.abs(y) < Math.max(0.3, z + 0.1)) {
        giroListo = true;
      }
    }
    if (der.botones[0]) frenando = true;
    if (botonNuevo('B', der.botones[1])) enderezar();
  }
}

function entradaTeclado() {
  ejes();
  if (teclas.has('KeyW') || teclas.has('ArrowUp')) empuje.add(adelante);
  if (teclas.has('KeyS') || teclas.has('ArrowDown')) empuje.sub(adelante);
  if (teclas.has('KeyD') || teclas.has('ArrowRight')) empuje.add(derecha);
  if (teclas.has('KeyA') || teclas.has('ArrowLeft')) empuje.sub(derecha);
  if (teclas.has('KeyE')) empuje.add(ARRIBA);
  if (teclas.has('KeyQ')) empuje.sub(ARRIBA);
  if (teclas.has('ShiftLeft') || teclas.has('ShiftRight')) empuje.multiplyScalar(1.8);
  if (teclas.has('Space')) frenando = true;
}

/** Lo que hace cada herramienta mientras una mano la sostiene. */
function usarHerramientas() {
  for (const e of escaneres) if (e.flotante.mano) e.usar(e.flotante.mano);
  for (const m of todasLasManos) {
    const f = m.sostiene;
    if (!f || !f.datos) continue;
    if (f.datos.haz) f.datos.haz.visible = m.gatillo > 0.3;
    if (f.tipo === 'radio' && m.gatilloNuevo) { sonido.tocar('aviso'); avisar('Control Montevideo: «Recibido, Artigas-1. Canal 2 despejado.»'); }
  }
  for (const f of flotantes.objetos) if (f.datos && f.datos.haz && !f.mano) f.datos.haz.visible = false;
}

// Manos simuladas para probar sin visor: window.artigas1.manosDePrueba.push({ posicion, cerrada, … }).
const manosDePrueba = [];
let todasLasManos = [];

// aro que marca el objeto que la mano puede tomar
const marcaObjeto = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.035, 5, 24), new THREE.MeshBasicMaterial({ color: 0xfcd116, transparent: true, opacity: 0.75, depthTest: false }), 3);
marcaObjeto.frustumCulled = false;
marcaObjeto.renderOrder = 4;
marcaObjeto.count = 0;
scene.add(marcaObjeto);
// marco del hueco de destino del contenedor que se lleva en la mano
const marcaHueco = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.30, 0.40, 0.44)), new THREE.LineBasicMaterial({ color: 0x3ecf6e }));
marcaHueco.visible = false;
scene.add(marcaHueco);
const _mm = new THREE.Matrix4();
const _ss = new THREE.Vector3();

function marcas() {
  let n = 0;
  marcaHueco.visible = false;
  camera.getWorldQuaternion(_q);
  for (const m of todasLasManos) {
    const f = m.sostiene;
    if (f && f.tipo === 'contenedor' && f.datos.escaneado) {
      const h = inventario.huecos.find((x) => x.codigo === f.datos.destino);
      if (h && !h.ocupado) { marcaHueco.visible = true; marcaHueco.position.copy(h.posicion); marcaHueco.quaternion.copy(h.giro); }
    }
    if (!m.objetoCercano || m.sostiene || n >= 3) continue;
    _mm.compose(m.objetoCercano.posicion, _q, _ss.setScalar(m.objetoCercano.radio * 1.15));
    marcaObjeto.setMatrixAt(n++, _mm);
  }
  marcaObjeto.count = n;
  if (n) marcaObjeto.instanceMatrix.needsUpdate = true;
}

// =====================================================================================================
// Bucle
// =====================================================================================================
const cuerpo = [
  { centro: new THREE.Vector3(), radio: 0.2 },   // cabeza
  { centro: new THREE.Vector3(), radio: 0.2 },   // torso
];
const reloj = new THREE.Clock();
let relojTerminales = 0;
/** Un cuadro del juego. Las pruebas lo llaman con un `dt` fijo y sin dibujar (window.artigas1.avanzar). */
function cuadro(_tiempo, _xrFrame, dtFijo = null, sinDibujar = false) {
  const dtReal = dtFijo ?? reloj.getDelta();
  const dt = dtFijo ?? Math.min(dtReal, 0.05);
  if (dtFijo === null) medidorFps.cuadro(dtReal);
  if (loco) {
    const enVisor = renderer.xr.isPresenting;
    empuje.set(0, 0, 0);
    frenando = false;
    manos.usarEscritorio = !enVisor;
    manos.leer();
    todasLasManos = manosDePrueba.length ? manos.lista.concat(manosDePrueba) : manos.lista;
    // --- interfaz: primero los paneles (un gatillo sobre un botón no abre el mapa ni dispara la herramienta)
    let puntero = null;
    if (!enVisor && mouse.activo) {
      rayoMouse.setFromCamera(mouse.ndc, camera);
      mouse.origen.copy(rayoMouse.ray.origin);
      mouse.direccion.copy(rayoMouse.ray.direction);
      puntero = mouse;
    }
    paneles.actualizar(dt, todasLasManos, puntero);
    mouse.clic = false;
    amarres.actualizar(dt, todasLasManos);              // un gatillo junto al trinquete no abre el mapa
    cambioFiltro.actualizar(dt, todasLasManos);         // ni junto a la manija de la puerta del filtro
    if (enVisor) entradaXR(dt); else entradaTeclado();
    empuje.clampLength(0, 1.8);
    // --- agarre y herramientas
    flotantes.gestionarManos(dt, todasLasManos, estacion.barandas, loco.p.alcanceBaranda);
    usarHerramientas();
    // --- movimiento
    loco.p.aceleracion = 1.1 * ajustes.velocidad;
    loco.p.velocidadEmpuje = 1.5 * ajustes.velocidad;
    loco.p.friccionLibre = ajustes.frenoAsistido && empuje.lengthSq() < 1e-6 ? 0.9 : 0.04;
    if (transicion.activa) { empuje.set(0, 0, 0); frenando = true; }
    loco.actualizar(dt, todasLasManos, empuje, frenando);
    induccion.actualizar({ agarrado: todasLasManos.some((m) => m.agarre), velocidad: loco.velocidad.length(), frenando, mapaEnLaMano: mapa.abierto && (mapa.modo === 'mano' || !enVisor) });
    if (sesionPendiente) { sesionPendiente = false; mostrarPanelSesion(); }
    if (bienvenidaPendiente) { bienvenidaPendiente = false; mostrarBienvenida(); }
    confort.nivelTunel = ajustes.tunel;
    confort.actualizar(dt, loco.velocidad.length(), girandoSuave);
    girandoSuave = false;
    camera.getWorldPosition(cabeza);
    camera.getWorldDirection(mirada);
    eva.actualizar(dt, cabeza, navegacion.actual === 'cupula');
    camera.getWorldPosition(cabeza);
    cuerpo[0].centro.copy(cabeza);
    cuerpo[1].centro.copy(cabeza).addScaledVector(arribaRig.copy(ARRIBA).applyQuaternion(rig.quaternion), -loco.p.alturaTorso);
    flotantes.actualizar(dt, cabeza, cuerpo, loco.velocidad, todasLasManos);
    for (const e of escaneres) e.actualizar(dt);
    descarga.actualizar(dt);
    if (descarga.igualando) panelesDescarga.presion.sucio = true;
    for (const t of tablets) t.actualizar(dt);
    inspecciones.actualizar(dt, todasLasManos, camera);
    gestor.tick(dt);
    navegacion.actualizar(dt, cabeza, eva.afuera);
    mapa.actualizar(dt, cabeza, mirada);
    marcas();
    if (aviso.tiempo > 0) { aviso.tiempo -= dt; if (aviso.tiempo <= 0) panelAviso.malla.visible = false; }
    ubicadorAviso.actualizar(dt, camera);
    ubicadorPractica.actualizar(dt, camera);
    relojTerminales += dt;
    if (relojTerminales > 0.5) {
      relojTerminales = 0;
      if (gestor.activa) for (const t of terminales) if (t.malla.position.distanceToSquared(cabeza) < 16) t.sucio = true;
      if (panelBalance.malla.visible && panelBalance.malla.position.distanceToSquared(cabeza) < 16) panelBalance.sucio = true;   // medición en vivo
      for (const p of Object.values(panelesDescarga)) if (p.malla.visible && p.malla.position.distanceToSquared(cabeza) < 25) p.sucio = true;
      if (pantallaSoporte.malla.visible && pantallaSoporte.malla.position.distanceToSquared(cabeza) < 16) pantallaSoporte.sucio = true;
    }
    // B17: en la Cúpula, mirando hacia los pies (hacia la ventana central), el torso y las piernas se ocultan
    manos.ocultarTorso = torsoOcultoEnCupula(navegacion.actual === 'cupula' && !eva.afuera, mirada.dot(arribaRig.copy(ARRIBA).applyQuaternion(rig.quaternion)), manos.ocultarTorso);
    manos.mostrar(dt);
    if (loco.ultimoChoque > 0.35) manos.vibrarTodas(Math.min(1, loco.ultimoChoque / 2), 30);
    for (const e of estacion.escotillas) e.actualizar(dt, cabeza);
    portales.actualizar(cabeza, eva.afuera);
    lotes.actualizar();                                // al final: ya se movió todo lo que se mueve
    orbital.actualizar(dt);
    telemetria.enVisor = enVisor;
    telemetria.actualizar(dt);
  }
  if (sinDibujar) return;
  if (terceraPersona && !renderer.xr.isPresenting && loco) {
    // cámara de observación: detrás y arriba del astronauta
    camera.getWorldPosition(cabeza);
    camera.getWorldDirection(mirada);
    camaraExterna.position.copy(cabeza).addScaledVector(mirada, -2.6).addScaledVector(ARRIBA, 0.9);
    camaraExterna.lookAt(cabeza);
    // en la caminata se ve el traje completo (js/exterior.js): los brazos y el cuerpo de primera persona
    // quedarían repetidos, así que se ocultan solo para esta vista
    const conTraje = eva.afuera;
    if (conTraje) manos.ocultarParaTercera(true);
    renderer.render(scene, camaraExterna);
    if (conTraje) manos.ocultarParaTercera(false);
  } else {
    renderer.render(scene, camera);
  }
}
renderer.setAnimationLoop(cuadro);
