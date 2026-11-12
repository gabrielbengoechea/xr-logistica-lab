// Recorrido WebXR de la Estación Artigas-1 (three.js 0.170). Modelos: kit 3D de artigas1-vr (Blender).
// Coordenadas glTF: Y arriba, el eje de la estación es Z (la punta del carguero hacia -Z).
//
// Este archivo solo arma las piezas y corre el bucle. Cada sistema vive en su módulo:
//   js/estacion.js     estructura: fusión de mallas, colliders, barandas, escotillas
//   js/colisiones.js   colisiones (grilla espacial de triángulos)
//   js/locomocion.js   movimiento en 0G con cuerpo sólido y agarre
//   js/barandas.js     capa de interacción de las barandas
//   js/manos.js        controles y manos en VR
//   js/materiales.js   materiales PBR, reflejos, vidrio
//   js/entorno.js      Tierra, atmósfera, sol y estrellas
//   js/etiquetas.js    etiquetas logísticas de la carga
//   js/flotantes.js    objetos sueltos en microgravedad
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { armarEstacion } from './js/estacion.js';
import { Locomocion0G } from './js/locomocion.js';
import { Manos } from './js/manos.js';
import { crearBiblioteca, crearEntorno } from './js/materiales.js';
import { cargarTexturasTierra, crearEntornoOrbital, COLOR_SOL, SOL } from './js/entorno.js';
import { crearEtiquetas } from './js/etiquetas.js';
import { SistemaFlotantes } from './js/flotantes.js';

const MODULOS = [
  { id: 'tacuarembo', nombre: 'Tacuarembó · taller', pos: [0.2, 0.1, 6.3], mira: [0.4, -0.1, -1] },
  { id: 'nodo', nombre: 'Nodo Montevideo', pos: [0.55, 0.15, 2.4], mira: [-1, -0.05, -0.35] },
  { id: 'cupula', nombre: 'Cúpula Faro', pos: [0.05, -1.95, 2.11], mira: [0.25, -0.75, -1] },
  { id: 'rivera', nombre: 'Rivera · almacén', pos: [0.1, 0.1, 0.15], mira: [0, -0.05, -1] },
  { id: 'colonia', nombre: 'Colonia · recepción', pos: [-0.3, 0.2, -5.35], mira: [0.2, -0.1, -1] },
  { id: 'carguero', nombre: 'Carguero Charrúa', pos: [0.05, 0.1, -9.15], mira: [0, -0.05, -1] },
];
const INICIO = 3; // Rivera

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
const rig = new THREE.Group(); // en 0G el rig es el cuerpo: se mueve en las tres direcciones
rig.add(camera);
scene.add(rig);

// ---- luz: una sola luz de hemisferio más los reflejos de entorno (sin luces puntuales por píxel).
// Las tiras LED son emisivas en la paleta; el sol de la Cúpula va en el material (js/materiales.js).
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

const manos = new Manos(renderer, rig);
/** @type {Locomocion0G | null} */
let loco = null;
let estacion = null;
let orbital = null;
/** @type {SistemaFlotantes | null} */
let flotantes = null;
// ejes de paso que los objetos sueltos dejan libres: el de la estación y el túnel de la Cúpula
const PASILLOS = [
  { a: new THREE.Vector3(0, 0, -11.4), b: new THREE.Vector3(0, 0, 6.7) },
  { a: new THREE.Vector3(0, 0, 2.11), b: new THREE.Vector3(0, -2.5, 2.11) },
];
const sistemasActivos = [];

function* colisionadores() {
  for (let i = 0; i < sistemasActivos.length; i++) if (sistemasActivos[i].activo) yield sistemasActivos[i];
}

const anisotropia = Math.min(4, renderer.capabilities.getMaxAnisotropy());
Promise.all([loader.loadAsync('./estacion.glb'), cargarTexturasTierra(manager, anisotropia)]).then(([gEstacion, texTierra]) => {
  estacion = armarEstacion(gEstacion, materialPara);
  scene.add(estacion.grupo);
  const etiquetas = crearEtiquetas(estacion.cargas, renderer);
  if (etiquetas.malla) scene.add(etiquetas.malla);
  orbital = crearEntornoOrbital(texTierra);
  scene.add(orbital.grupo);

  sistemasActivos.push(estacion.colisiones, ...estacion.escotillas.map((e) => e.colision));
  loco = new Locomocion0G({ rig, cabeza: camera, colisionadores, estructura: estacion.colisiones, barandas: estacion.barandas });
  flotantes = new SistemaFlotantes({ colisionadores, pasillos: PASILLOS });
  for (const malla of estacion.flotantes) flotantes.agregar(malla, malla.userData.radio);
  ir(INICIO, true);
  document.getElementById('cargando').remove();
  // para las pruebas automáticas y para depurar desde la consola
  window.artigas1 = { THREE, renderer, scene, camera, rig, loco, estacion, etiquetas, manos, orbital, flotantes, ir, manosDePrueba };
}).catch((e) => {
  pct.textContent = `error al cargar: ${e.message}`;
  console.error(e);
});

// ---- navegación por módulos (salto con fundido, como en el plan)
let yaw = 0;
let pitch = 0;
let actual = INICIO;
const _pos = new THREE.Vector3();

function ir(i, inmediato = false) {
  actual = (i + MODULOS.length) % MODULOS.length;
  const m = MODULOS[actual];
  const fundido = document.getElementById('fundido');
  const mover = () => {
    // en VR la cabeza ya está desplazada del rig: se compensa para que la cabeza quede en el punto
    _pos.set(...m.pos);
    if (renderer.xr.isPresenting) _pos.sub(camera.position.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, rig.rotation.y));
    if (loco) loco.teletransportar(_pos); else rig.position.copy(_pos);
    const d = new THREE.Vector3(...m.mira).normalize();
    yaw = Math.atan2(-d.x, -d.z);
    pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    aplicarMirada();
    for (const b of document.querySelectorAll('#modulos button')) {
      b.setAttribute('aria-pressed', String(b.dataset.id === m.id));
    }
  };
  if (inmediato || renderer.xr.isPresenting) {
    mover();
    return;
  }
  fundido.style.opacity = '1';
  setTimeout(() => { mover(); fundido.style.opacity = '0'; }, 250);
}

function aplicarMirada() {
  rig.rotation.set(0, yaw, 0);
  camera.rotation.set(renderer.xr.isPresenting ? 0 : pitch, 0, 0);
}

const botones = document.getElementById('modulos');
MODULOS.forEach((m, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = m.nombre;
  b.dataset.id = m.id;
  b.addEventListener('click', () => ir(i));
  botones.appendChild(b);
});
document.getElementById('ocultar').addEventListener('click', () => { document.getElementById('panel').hidden = true; });

// mouse / toque: arrastrar para mirar
let arrastre = null;
renderer.domElement.addEventListener('pointerdown', (e) => { arrastre = { x: e.clientX, y: e.clientY }; });
window.addEventListener('pointerup', () => { arrastre = null; });
window.addEventListener('pointermove', (e) => {
  if (!arrastre || renderer.xr.isPresenting) return;
  yaw -= (e.clientX - arrastre.x) * 0.004;
  pitch = THREE.MathUtils.clamp(pitch - (e.clientY - arrastre.y) * 0.004, -1.5, 1.5);
  arrastre = { x: e.clientX, y: e.clientY };
  aplicarMirada();
});
const teclas = new Set();
window.addEventListener('keydown', (e) => { teclas.add(e.code); if (e.code === 'Space') e.preventDefault(); });
window.addEventListener('keyup', (e) => teclas.delete(e.code));
window.addEventListener('blur', () => teclas.clear());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.xr.addEventListener('sessionstart', () => { pitch = 0; aplicarMirada(); });
renderer.xr.addEventListener('sessionend', () => aplicarMirada());

// ---- entrada: se traduce a «empuje» (dirección en el mundo) y «freno»
const empuje = new THREE.Vector3();
const adelante = new THREE.Vector3();
const derecha = new THREE.Vector3();
const ARRIBA = new THREE.Vector3(0, 1, 0);
const cabeza = new THREE.Vector3();
const previos = new Map();
let giroListo = true;
let frenando = false;

function botonNuevo(clave, apretado) {
  const antes = previos.get(clave) === true;
  previos.set(clave, apretado);
  return apretado && !antes;
}

function ejes() {
  camera.getWorldDirection(adelante);
  derecha.crossVectors(adelante, ARRIBA).normalize();
}

function girarAlrededorDeLaCabeza(angulo) {
  camera.getWorldPosition(cabeza);
  rig.position.sub(cabeza).applyAxisAngle(ARRIBA, angulo).add(cabeza);
  rig.rotation.y += angulo;
  yaw = rig.rotation.y;
}

function entradaXR() {
  const sesion = renderer.xr.getSession();
  if (!sesion) return;
  ejes();
  for (const fuente of sesion.inputSources) {
    const gp = fuente.gamepad;
    if (!gp) continue;
    if (gp.buttons[0]?.pressed) frenando = true;                 // gatillo de cualquier mano: freno
    if (gp.axes.length < 4) continue;
    const x = gp.axes[2];
    const y = gp.axes[3];
    if (fuente.handedness === 'left') {
      if (Math.abs(x) > 0.15) empuje.addScaledVector(derecha, x);
      if (Math.abs(y) > 0.15) empuje.addScaledVector(adelante, -y);
    } else if (fuente.handedness === 'right') {
      if (Math.abs(y) > 0.3) empuje.addScaledVector(ARRIBA, -y);  // stick derecho arriba/abajo: subir y bajar
      if (Math.abs(x) > 0.7 && giroListo) {
        girarAlrededorDeLaCabeza(x > 0 ? -Math.PI / 6 : Math.PI / 6);
        giroListo = false;
      } else if (Math.abs(x) < 0.3) {
        giroListo = true;
      }
      if (botonNuevo('A', gp.buttons[4]?.pressed === true)) ir(actual + 1);
      if (botonNuevo('B', gp.buttons[5]?.pressed === true)) ir(actual - 1);
    }
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

// Manos simuladas para probar el agarre sin visor: window.artigas1.manosDePrueba.push({ posicion, cerrada }).
const manosDePrueba = [];

// ---- bucle
const cuerpo = [
  { centro: new THREE.Vector3(), radio: 0.2 },   // cabeza
  { centro: new THREE.Vector3(), radio: 0.2 },   // torso
];
const reloj = new THREE.Clock();
function cuadro() {
  const dt = Math.min(reloj.getDelta(), 0.05);
  if (loco) {
    empuje.set(0, 0, 0);
    frenando = false;
    if (renderer.xr.isPresenting) entradaXR(); else entradaTeclado();
    empuje.clampLength(0, 1.8);
    manos.leer();
    const todas = manosDePrueba.length ? manos.lista.concat(manosDePrueba) : manos.lista;
    flotantes.gestionarManos(dt, todas, estacion.barandas, loco.p.alcanceBaranda);
    loco.actualizar(dt, todas, empuje, frenando);
    camera.getWorldPosition(cabeza);
    cuerpo[0].centro.copy(cabeza);
    cuerpo[1].centro.copy(cabeza).y -= loco.p.alturaTorso;
    flotantes.actualizar(dt, cabeza, cuerpo, loco.velocidad, todas);
    manos.mostrar();
    if (loco.ultimoChoque > 0.35) manos.vibrarTodas(Math.min(1, loco.ultimoChoque / 2), 30);
    camera.getWorldPosition(cabeza);
    for (const e of estacion.escotillas) e.actualizar(dt, cabeza);
    orbital.actualizar(dt);
  }
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(cuadro);
