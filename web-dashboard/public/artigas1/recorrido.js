// Recorrido WebXR de la Estación Artigas-1 (three.js 0.170). Modelos: kit 3D de artigas1-vr (Blender).
// Coordenadas glTF: Y arriba, el eje de la estación es Z (la punta del carguero hacia -Z).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

const MODULOS = [
  { id: 'tacuarembo', nombre: 'Tacuarembó · taller', pos: [0.2, 0.1, 6.3], mira: [0.4, -0.1, -1] },
  { id: 'nodo', nombre: 'Nodo Montevideo', pos: [0.55, 0.15, 2.4], mira: [-1, -0.05, -0.35] },
  { id: 'cupula', nombre: 'Cúpula Faro', pos: [0.1, -2.05, 2.25], mira: [0, -1, -0.25] },
  { id: 'rivera', nombre: 'Rivera · almacén', pos: [0.2, 0.15, 0.15], mira: [0, -0.05, -1] },
  { id: 'colonia', nombre: 'Colonia · recepción', pos: [-0.3, 0.2, -5.35], mira: [0.2, -0.1, -1] },
  { id: 'carguero', nombre: 'Carguero Charrúa', pos: [0.05, 0.1, -9.15], mira: [0, -0.05, -1] },
];
const INICIO = 3; // Rivera

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local'); // la cabeza arranca en el origen del rig: sirve sentado
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.03, 2600);
const rig = new THREE.Group(); // en 0G el rig es el cuerpo: se mueve en las tres direcciones
rig.add(camera);
scene.add(rig);

// ---- luz: ambiente pareja adentro y un sol para la Tierra
scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.4));
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sol = new THREE.DirectionalLight(0xfff4e0, 2.2);
sol.position.set(300, 400, 200);
scene.add(sol);
for (const z of [5.2, 2.1, -0.8, -3.2, -6.8, -10.2]) {
  const l = new THREE.PointLight(0xfff6ea, 2.5, 6, 2);
  l.position.set(0, 0.6, z);
  scene.add(l);
}

// ---- carga de modelos
const manager = new THREE.LoadingManager();
const pct = document.getElementById('pct');
manager.onProgress = (_url, hechos, total) => { pct.textContent = `${Math.round((hechos / total) * 100)} %`; };
manager.onLoad = () => { document.getElementById('cargando').remove(); };
manager.onError = (url) => { pct.textContent = `no se pudo cargar ${url}`; };

new THREE.TextureLoader(manager).load('./estrellas.webp', (t) => {
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
});
const loader = new GLTFLoader(manager);
loader.load('./estacion.glb', (g) => {
  g.scene.traverse((o) => {
    if (o.isMesh) {
      o.matrixAutoUpdate = false; // la estación no se mueve
      o.updateMatrix();
    }
  });
  scene.add(g.scene);
});
const tierra = []; // la esfera y el casquete de detalle: giran sobre su propio eje polar (Y local)
loader.load('./tierra.glb', (g) => {
  g.scene.traverse((o) => { if (o.isMesh) tierra.push(o); });
  scene.add(g.scene);
});

// ---- navegación
let yaw = 0;
let pitch = 0;
let actual = INICIO;

function ir(i) {
  actual = (i + MODULOS.length) % MODULOS.length;
  const m = MODULOS[actual];
  const fundido = document.getElementById('fundido');
  const mover = () => {
    rig.position.set(...m.pos);
    const d = new THREE.Vector3(...m.mira).normalize();
    yaw = Math.atan2(-d.x, -d.z);
    pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    aplicarMirada();
    for (const b of document.querySelectorAll('#modulos button')) {
      b.setAttribute('aria-pressed', String(b.dataset.id === m.id));
    }
  };
  if (renderer.xr.isPresenting) {
    mover();
    return;
  }
  fundido.style.opacity = '1';
  setTimeout(() => { mover(); fundido.style.opacity = '0'; }, 250);
}

function aplicarMirada() {
  if (renderer.xr.isPresenting) {
    rig.rotation.set(0, yaw, 0);
    camera.rotation.set(0, 0, 0);
  } else {
    rig.rotation.set(0, yaw, 0);
    camera.rotation.set(pitch, 0, 0);
  }
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
window.addEventListener('keydown', (e) => teclas.add(e.code));
window.addEventListener('keyup', (e) => teclas.delete(e.code));
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.xr.addEventListener('sessionstart', () => { pitch = 0; aplicarMirada(); });
renderer.xr.addEventListener('sessionend', () => aplicarMirada());

// ---- mando del Quest
const previos = new Map();
let giroListo = true;
const adelante = new THREE.Vector3();
const derecha = new THREE.Vector3();
const arriba = new THREE.Vector3(0, 1, 0);

function botonNuevo(clave, apretado) {
  const antes = previos.get(clave) === true;
  previos.set(clave, apretado);
  return apretado && !antes;
}

function controlesXR(dt) {
  const sesion = renderer.xr.getSession();
  if (!sesion) return;
  for (const fuente of sesion.inputSources) {
    const gp = fuente.gamepad;
    if (!gp || gp.axes.length < 4) continue;
    const x = gp.axes[2];
    const y = gp.axes[3];
    if (fuente.handedness === 'left') {
      if (Math.abs(x) > 0.15 || Math.abs(y) > 0.15) {
        camera.getWorldDirection(adelante);
        derecha.crossVectors(adelante, arriba).normalize();
        rig.position.addScaledVector(adelante, -y * 1.0 * dt).addScaledVector(derecha, x * 1.0 * dt);
      }
    } else if (fuente.handedness === 'right') {
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

const cabeza = new THREE.Vector3();
function girarAlrededorDeLaCabeza(angulo) {
  camera.getWorldPosition(cabeza);
  rig.position.sub(cabeza).applyAxisAngle(arriba, angulo).add(cabeza);
  rig.rotation.y += angulo;
  yaw = rig.rotation.y;
}

function controlesTeclado(dt) {
  const v = (teclas.has('ShiftLeft') || teclas.has('ShiftRight') ? 2.4 : 1.2) * dt;
  camera.getWorldDirection(adelante);
  derecha.crossVectors(adelante, arriba).normalize();
  if (teclas.has('KeyW') || teclas.has('ArrowUp')) rig.position.addScaledVector(adelante, v);
  if (teclas.has('KeyS') || teclas.has('ArrowDown')) rig.position.addScaledVector(adelante, -v);
  if (teclas.has('KeyD') || teclas.has('ArrowRight')) rig.position.addScaledVector(derecha, v);
  if (teclas.has('KeyA') || teclas.has('ArrowLeft')) rig.position.addScaledVector(derecha, -v);
  if (teclas.has('KeyE')) rig.position.y += v;
  if (teclas.has('KeyQ')) rig.position.y -= v;
}

const reloj = new THREE.Clock();
ir(INICIO);
renderer.setAnimationLoop(() => {
  const dt = Math.min(reloj.getDelta(), 0.05);
  if (renderer.xr.isPresenting) {
    controlesXR(dt);
  } else {
    controlesTeclado(dt);
  }
  for (const t of tierra) t.rotateY(dt * 0.000145); // medio grado por minuto, siempre para el mismo lado
  renderer.render(scene, camera);
});
