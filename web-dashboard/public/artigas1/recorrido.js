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
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { armarEstacion } from './js/estacion.js';
import { Locomocion0G } from './js/locomocion.js';
import { Manos } from './js/manos.js';
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
import { EVAController, StationTransitionManager } from './js/eva.js';

const INICIO = 'rivera';

// ---- ajustes del jugador (se guardan en este navegador)
const AJUSTES_BASE = { giro: 'suave', sensibilidad: 1, velocidad: 1, giroVertical: true, frenoAsistido: false, calibracionManos: 0 };
const ajustes = { ...AJUSTES_BASE };
try { Object.assign(ajustes, JSON.parse(window.localStorage.getItem('artigas1.ajustes') || '{}')); } catch { /* sin almacenamiento: valores de fábrica */ }
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
document.body.appendChild(VRButton.createButton(renderer));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 2600);
const rig = new THREE.Group(); // en 0G el rig es el cuerpo: se mueve y gira en las tres direcciones
rig.add(camera);
scene.add(rig);
// cámara de observación (solo en la compu, tecla V): ve al astronauta con su traje desde afuera
const camaraExterna = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 2600);
camaraExterna.layers.enable(1);
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
manager.onError = (url) => { pct.textContent = `no se pudo cargar ${url}`; };
const loader = new GLTFLoader(manager);

const sonido = new Sonido();
const manos = new Manos(renderer, rig, scene, camera);
manos.calibrar(ajustes.calibracionManos);
const paneles = new SistemaPaneles(scene, sonido);
const transicion = new StationTransitionManager(camera);
const gestor = new GestorActividades();
const navegacion = new Navegacion(scene);
const fabrica = new FabricaHerramientas(entorno);

/** @type {Locomocion0G | null} */
let loco = null;
let estacion = null;
let orbital = null;
/** @type {SistemaFlotantes | null} */
let flotantes = null;
let inventario = null;
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
panelAviso.malla.renderOrder = 7;
scene.add(panelAviso.malla);

/** Cartel breve delante del astronauta, quieto en el espacio (no pegado a la cámara). */
function avisar(texto, tono = 'info', segundos = 3.5) {
  aviso.texto = texto;
  aviso.tono = tono;
  aviso.tiempo = segundos;
  camera.getWorldPosition(cabeza);
  camera.getWorldDirection(mirada);
  const m = panelAviso.malla;
  camera.getWorldQuaternion(_q);
  m.up.set(0, 1, 0).applyQuaternion(_q);
  m.position.copy(cabeza).addScaledVector(mirada, 0.95).addScaledVector(m.up, -0.30);
  m.lookAt(cabeza);
  m.visible = true;
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
  const fin = informe.modo === 'resultado' && r;
  ctx.fillStyle = fin ? (r.completada ? '#14532d' : '#7f1d1d') : COLORES.azul;
  ctx.fillRect(6, 6, W - 12, 84);
  ctx.fillStyle = COLORES.blanco;
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(a.def.titulo, 30, 62);
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(fin ? (r.completada ? 'COMPLETADA' : 'NO SUPERADA') : 'INSTRUCCIONES', W - 30, 60);
  ctx.textAlign = 'left';
  let y = 140;
  if (fin) {
    ctx.font = 'bold 34px sans-serif';
    ctx.fillStyle = COLORES.amarillo;
    ctx.fillText(r.completada ? `${r.puntaje} puntos  ${'★'.repeat(r.puntaje >= 85 ? 3 : r.puntaje >= 60 ? 2 : 1)}` : r.motivo, 30, y);
    y += 58;
    ctx.font = '30px sans-serif';
    ctx.fillStyle = COLORES.blanco;
    for (const linea of [`Tiempo: ${formatoTiempo(r.segundos)} (referencia ${formatoTiempo(a.def.referencia)})`, `Errores: ${r.errores}`, `Pasos: ${r.pasos} de ${r.total}`, `Qué practicaste: ${a.def.concepto}`]) {
      ctx.fillText(linea, 30, y);
      y += 46;
    }
    p.boton('repetir', 30, H - 110, 320, 80, 'REPETIR', () => { cerrarInforme(); iniciarActividad(a.id); }, { estilo: 'aviso' });
  } else {
    ctx.font = '30px sans-serif';
    ctx.fillStyle = COLORES.blanco;
    for (const linea of renglones(ctx, a.def.instrucciones, W - 60)) { ctx.fillText(linea, 30, y); y += 40; }
    y += 14;
    ctx.fillStyle = COLORES.amarillo;
    ctx.font = 'bold 28px sans-serif';
    if (a.pasoActual) for (const linea of renglones(ctx, `Primer paso: ${a.pasoActual.texto}`, W - 60)) { ctx.fillText(linea, 30, y); y += 38; }
  }
  p.boton('cerrar', W - 350, H - 110, 320, 80, fin ? 'CERRAR' : 'ENTENDIDO', () => cerrarInforme());
} });
panelInforme.malla.visible = false;
panelInforme.malla.renderOrder = 6;
scene.add(panelInforme.malla);
paneles.agregar(panelInforme);

function abrirInforme(modo, actividad) {
  informe.modo = modo;
  informe.actividad = actividad;
  camera.getWorldPosition(cabeza);
  camera.getWorldDirection(mirada);
  const m = panelInforme.malla;
  camera.getWorldQuaternion(_q);
  m.up.set(0, 1, 0).applyQuaternion(_q);
  let d = 0.9;
  if (estacion && !(eva && eva.afuera)) {
    for (; d > 0.5; d -= 0.07) if (estacion.colisiones.puntoMasCercano(_v.copy(cabeza).addScaledVector(mirada, d), 0.28, _pos) === Infinity) break;
  }
  m.position.copy(cabeza).addScaledVector(mirada, d);
  m.lookAt(cabeza);
  m.visible = true;
  panelInforme.sucio = true;
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
      for (const linea of renglones(ctx, a.estado === ESTADO.BLOQUEADA ? gestor.impedimento(a.id) : a.def.instrucciones, W - 52).slice(0, 7)) { ctx.fillText(linea, 26, y); y += 34; }
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
  return panel;
}

// =====================================================================================================
// Acciones del juego
// =====================================================================================================
function iniciarActividad(id) {
  const motivo = gestor.impedimento(id);
  if (motivo) { avisar(motivo, 'error'); sonido.tocar('error'); return false; }
  return gestor.iniciar(id);
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

function reunirHerramientas() {
  for (const f of flotantes.objetos) if (f.datos && f.datos.herramienta) flotantes.guardar(f);
  avisar('Las herramientas volvieron a su lugar', 'ok');
}

// =====================================================================================================
// Armado
// =====================================================================================================
const anisotropia = Math.min(4, renderer.capabilities.getMaxAnisotropy());
Promise.all([loader.loadAsync('./estacion.glb'), cargarTexturasTierra(manager, anisotropia)]).then(([gEstacion, texTierra]) => {
  estacion = armarEstacion(gEstacion, materialPara);
  scene.add(estacion.grupo);
  const legibles = estacion.cargas.filter((c) => c.legible);
  const etiquetas = crearEtiquetas(legibles, renderer);
  if (etiquetas.malla) scene.add(etiquetas.malla);
  inventario = new Inventario(estacion.cargas, etiquetas.datos, CATEGORIAS);
  orbital = crearEntornoOrbital(texTierra);
  scene.add(orbital.grupo);
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
        ajuste: (clave, valor) => { ajustes[clave] = typeof valor === 'number' ? THREE.MathUtils.clamp(valor, 0.5, clave === 'velocidad' ? 1.5 : 2) : valor; guardarAjustes(); t.panel.sucio = true; },
        calibrarManos: () => { manos.calibrar(manos.calibracion + 1); ajustes.calibracionManos = manos.calibracion; guardarAjustes(); return manos.calibracion; },
        reunir: reunirHerramientas,
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

  // ---- soltar y tomar: los contenedores quedan asegurados en los huecos del rack
  const correa = new THREE.BoxGeometry(1, 1, 1);
  const matCorrea = new THREE.MeshStandardMaterial({ color: 0xe8730c, roughness: 0.8 });
  flotantes.alSoltar = (f) => {
    if (f.tipo !== 'contenedor') return;
    const h = inventario.huecoCercano(f.posicion, 0.32);
    if (!h) return;
    f.fijo = true;
    f.velocidad.set(0, 0, 0);
    f.posicion.copy(h.posicion);
    f.malla.quaternion.copy(h.giro);
    f.casa.copy(h.posicion);
    if (!f.datos.correa) {
      f.malla.geometry.computeBoundingBox();
      const t = f.malla.geometry.boundingBox.getSize(new THREE.Vector3());
      f.datos.correa = new THREE.Mesh(correa, matCorrea);
      f.datos.correa.scale.set(0.035, t.y + 0.012, t.z + 0.012);
      f.malla.add(f.datos.correa);
    }
    f.datos.correa.visible = true;
    const correcto = inventario.colocar(f, h);
    sonido.tocar(correcto ? 'ok' : 'aviso');
    avisar(correcto ? `${f.datos.codigo} asegurado en ${h.codigo}` : `${f.datos.codigo} quedó en ${h.codigo}, pero su lugar es ${f.datos.destino}`, correcto ? 'ok' : 'error');
    gestor.evento('colocado', { codigo: f.datos.codigo, hueco: h.codigo, destino: f.datos.destino, correcto });
  };
  flotantes.alTomar = (f) => {
    if (f.tipo === 'contenedor' && f.datos.hueco) {
      inventario.retirar(f);
      if (f.datos.correa) f.datos.correa.visible = false;
    }
    if (f.datos && f.datos.tablet) f.datos.tablet.panel.sucio = true;
  };

  // ---- actividades, puntos de trabajo, navegación y mapa
  inspecciones = new Inspecciones(scene, (tipo, datos) => {
    gestor.evento(tipo, datos);
    if (tipo === 'inspeccion') { sonido.tocar('ok'); manos.vibrarTodas(0.6, 60); }
  });
  for (const [id, p] of Object.entries(PUNTOS_TALLER)) inspecciones.agregar(id, p.posicion, p.herramienta, p.segundos, p.texto);
  for (const [id, p] of Object.entries(PUNTOS_EVA)) inspecciones.agregar(id, PUNTOS_EXTERIORES[id], p.herramienta, p.segundos, p.texto);
  definirActividades(gestor, { inventario, inspecciones });

  eva = new EVAController({
    rig, camara: camera, escena: scene, loco, manos, exterior, transicion, sonido,
    objetivo: () => (gestor.activa && gestor.activa.pasoActual ? gestor.activa.pasoActual.texto : 'Caminata libre · el mapa se abre con el gatillo izquierdo'),
    alCambiar: (fase) => {
      navegacion.cancelar();
      gestor.evento('eva', { fase });
      avisar(fase === 'afuera' ? 'Estás afuera. Avanzá de pasamanos en pasamanos.' : 'De vuelta en el Nodo Montevideo', 'ok');
    },
  });
  mapa = new MapaEstacion({ paneles, escena: scene, navegacion, gestor, acciones: { guiar, trasladar, iniciar: iniciarActividad, cancelarGuia: () => navegacion.cancelar() }, estado: () => ({ afuera: eva.afuera }) });

  crearTerminal('almacenamiento', V(0.86, 0.36, 0.615), Math.PI);
  crearTerminal('inventario', V(0.86, -0.02, 0.615), Math.PI);
  crearTerminal('recepcion', V(0.86, 0.30, -4.955), Math.PI);
  crearTerminal('mantenimiento', V(0.86, 0.30, 3.625), 0);
  crearTerminal('eva', V(1.175, 0.02, 3.02), -Math.PI / 2, { texto: () => 'SALIR AL EXTERIOR', accion: () => { camera.getWorldPosition(cabeza); const m = eva.salir(cabeza); if (m) avisar(m, 'error'); } });
  crearTerminal('eva', V(1.80, 0.0, 1.25), Math.PI / 2, { texto: () => 'ENTRAR A LA ESTACIÓN', accion: () => { camera.getWorldPosition(cabeza); const m = eva.entrar(cabeza); if (m) avisar(m, 'error'); } });

  gestor.escuchar((tipo, a, dato) => {
    for (const t of terminales) t.sucio = true;
    for (const t of tablets) t.panel.sucio = true;
    if (mapa) mapa.panel.sucio = true;
    if (tipo === 'inicio') { sonido.tocar('aviso'); abrirInforme('instrucciones', a); if (mapa) mapa.cerrar(); }
    if (tipo === 'paso') { sonido.tocar('logro'); if (a.pasoActual) avisar(`✔ ${dato.texto}`, 'ok'); }
    if (tipo === 'error') { sonido.tocar('error'); avisar(dato, 'error'); manos.vibrarTodas(0.8, 90); }
    if (tipo === 'aviso') avisar(dato);
    if (tipo === 'desbloqueo') avisar(`Nueva actividad disponible: ${a.def.titulo}`, 'ok', 5);
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
  window.artigas1 = {
    THREE, renderer, scene, camera, rig, loco, estacion, etiquetas, manos, orbital, flotantes, ir, manosDePrueba,
    inventario, escaneres, tablets, terminales, paneles, gestor, navegacion, mapa, exterior, eva, inspecciones, transicion, sonido, ajustes,
    acciones: { guiar, trasladar, iniciarActividad, avisar, reunirHerramientas }, aviso, panelInforme, teclas,
    avanzar: (dt = 1 / 72, dibujar = false) => cuadro(0, null, dt, !dibujar),
  };
}).catch((e) => {
  pct.textContent = `error al cargar: ${e.message}`;
  console.error(e);
});

function alLeer(l) {
  for (const t of tablets) if (l.ok) t.lectura(l.codigo);
  if (l.ok) avisar(`${l.codigo} · ${l.descripcion} · ${l.destino ? `va en ${l.destino}` : l.ubicacion}`, 'ok');
  else avisar(`${l.texto}. ${l.detalle}.`, 'error', 2.5);
  manos.vibrarTodas(l.ok ? 0.6 : 1, l.ok ? 50 : 140);
  gestor.evento('escaneo', l);
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
renderer.xr.addEventListener('sessionstart', () => { pitch = 0; aplicarMirada(); sonido.activar(); terceraPersona = false; });
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

/** Gira el cuerpo alrededor de la cabeza: el seguimiento del visor no se toca. */
function girarAlrededorDeLaCabeza(eje, angulo) {
  camera.getWorldPosition(cabeza);
  _q.setFromAxisAngle(eje, angulo);
  rig.position.sub(cabeza).applyQuaternion(_q).add(cabeza);
  rig.quaternion.premultiply(_q).normalize();
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
 *   stick derecho    girar y mirar arriba o abajo                 A       freno    B   enderezar
 *   gatillo izq.     mapa de la estación                          gatillo der.   usar la herramienta o apretar un botón
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
    // gatillo del índice izquierdo: mapa (salvo que esa mano lleve una herramienta o esté apretando un botón)
    if (izq.gatilloNuevo && !izq.gatilloUsado && !izq.sostiene) mapa.alternar(camera, eva.afuera ? null : estacion.colisiones);
  }
  if (der) {
    const [x, y] = der.ejes;
    const s = ajustes.sensibilidad;
    if (ajustes.giro === 'suave') {
      const meta = Math.abs(x) > 0.2 ? -x * THREE.MathUtils.degToRad(95) * s : 0;
      velGiro += (meta - velGiro) * (1 - Math.exp(-12 * dt));        // sin arranques ni frenadas bruscas
      if (Math.abs(velGiro) > 1e-4) girarAlrededorDeLaCabeza(arribaRig, velGiro * dt);
    } else if (Math.abs(x) > 0.7 && giroListo) {
      girarAlrededorDeLaCabeza(arribaRig, x > 0 ? -Math.PI / 6 : Math.PI / 6);
      giroListo = false;
    } else if (Math.abs(x) < 0.3) {
      giroListo = true;
    }
    const metaV = ajustes.giroVertical && Math.abs(y) > 0.25 ? -y * THREE.MathUtils.degToRad(55) * s : 0;
    velInclinacion += (metaV - velInclinacion) * (1 - Math.exp(-12 * dt));
    if (Math.abs(velInclinacion) > 1e-4) girarAlrededorDeLaCabeza(derecha, velInclinacion * dt);
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
  const dt = dtFijo ?? Math.min(reloj.getDelta(), 0.05);
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
    camera.getWorldPosition(cabeza);
    camera.getWorldDirection(mirada);
    eva.actualizar(dt, cabeza, navegacion.actual === 'cupula');
    camera.getWorldPosition(cabeza);
    cuerpo[0].centro.copy(cabeza);
    cuerpo[1].centro.copy(cabeza).addScaledVector(arribaRig.copy(ARRIBA).applyQuaternion(rig.quaternion), -loco.p.alturaTorso);
    flotantes.actualizar(dt, cabeza, cuerpo, loco.velocidad, todasLasManos);
    for (const e of escaneres) e.actualizar(dt);
    for (const t of tablets) t.actualizar(dt);
    inspecciones.actualizar(dt, todasLasManos, camera);
    gestor.tick(dt);
    navegacion.actualizar(dt, cabeza, eva.afuera);
    mapa.actualizar(dt, cabeza, mirada);
    marcas();
    if (aviso.tiempo > 0) { aviso.tiempo -= dt; if (aviso.tiempo <= 0) panelAviso.malla.visible = false; }
    relojTerminales += dt;
    if (relojTerminales > 0.5) {
      relojTerminales = 0;
      if (gestor.activa) for (const t of terminales) if (t.malla.position.distanceToSquared(cabeza) < 16) t.sucio = true;
    }
    manos.mostrar(dt);
    if (loco.ultimoChoque > 0.35) manos.vibrarTodas(Math.min(1, loco.ultimoChoque / 2), 30);
    for (const e of estacion.escotillas) e.actualizar(dt, cabeza);
    orbital.actualizar(dt);
  }
  if (sinDibujar) return;
  if (terceraPersona && !renderer.xr.isPresenting && loco) {
    // cámara de observación: detrás y arriba del astronauta
    camera.getWorldPosition(cabeza);
    camera.getWorldDirection(mirada);
    camaraExterna.position.copy(cabeza).addScaledVector(mirada, -2.6).addScaledVector(ARRIBA, 0.9);
    camaraExterna.lookAt(cabeza);
    renderer.render(scene, camaraExterna);
  } else {
    renderer.render(scene, camera);
  }
}
renderer.setAnimationLoop(cuadro);
