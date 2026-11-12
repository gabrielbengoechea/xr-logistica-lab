// Biblioteca de materiales PBR de la estación. Parte de los materiales del GLB (paleta con metalicidad y
// rugosidad por celda, atlas de carteles) y les suma lo que la paleta no puede dar:
//  - reflejos de entorno (IBL) generados una sola vez con la iluminación de la cabina;
//  - juntas de panel y variación de rugosidad en la estructura, calculadas en espacio de mundo (sin texturas);
//  - luz del sol sobre la Cúpula, coherente con el exterior;
//  - vidrio con efecto Fresnel de bajo costo (una sola capa transparente).
import * as THREE from 'three';

/** Entorno de reflejos: una cabina clara con tiras de luz arriba, horneada a un cubemap prefiltrado chico. */
export function crearEntorno(renderer) {
  const esc = new THREE.Scene();
  const caja = new THREE.Mesh(
    new THREE.BoxGeometry(6, 4, 6),
    new THREE.MeshBasicMaterial({ color: 0x8f949b, side: THREE.BackSide }),
  );
  esc.add(caja);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: 0x4a5058 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = -1.99;
  esc.add(piso);
  const tira = new THREE.MeshBasicMaterial({ color: 0xffffff });
  tira.color.setScalar(9);                                     // tiras LED: mucho más brillantes que las paredes
  for (const x of [-1.6, 1.6]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), tira);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, 1.98, 0);
    esc.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(esc, 0.03);
  pmrem.dispose();
  caja.geometry.dispose();
  piso.geometry.dispose();
  return rt.texture;
}

/**
 * Parchea un MeshStandardMaterial para sumar detalle de superficie sin texturas ni objetos extra.
 * @param {THREE.MeshStandardMaterial} material
 * @param {{juntas?: number, sol?: THREE.Vector3|null, colorSol?: THREE.Color}} o
 *   juntas: intensidad de las juntas de panel (0 = sin juntas). sol: dirección hacia el sol en el mundo.
 */
export function conDetalle(material, { juntas = 0, sol = null, colorSol = new THREE.Color(1, 0.95, 0.85) } = {}) {
  const m = material.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uJuntas = { value: juntas };
    shader.uniforms.uSol = { value: sol ? sol.clone() : new THREE.Vector3(0, 1, 0) };
    shader.uniforms.uSolColor = { value: sol ? colorSol : new THREE.Color(0, 0, 0) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vArtigasMundo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvArtigasMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vArtigasMundo;
uniform float uJuntas;
uniform vec3 uSol;
uniform vec3 uSolColor;
float artigasJunta(vec3 wp, vec3 n) {
  vec3 g = wp * 2.0;                                  // un panel cada 0,5 m
  vec3 d = abs(fract(g + 0.5) - 0.5);                 // distancia a la junta más cercana, por eje
  vec3 ancho = fwidth(g) + 0.012;
  vec3 l = 1.0 - smoothstep(vec3(0.0), ancho, d);
  vec3 peso = 1.0 - abs(n);                           // una pared no dibuja las juntas de su propio eje
  return max(max(l.x * peso.x, l.y * peso.y), l.z * peso.z);
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
vec3 artigasN = normalize(cross(dFdx(vArtigasMundo), dFdy(vArtigasMundo)));
float artigasJ = uJuntas > 0.0 ? artigasJunta(vArtigasMundo, artigasN) * uJuntas : 0.0;
// cepillado: vetas finas a lo largo del eje de la estación, solo en la rugosidad
float artigasVeta = sin(vArtigasMundo.x * 310.0 + sin(vArtigasMundo.y * 23.0) * 2.0) * sin(vArtigasMundo.y * 270.0);
roughnessFactor = clamp(roughnessFactor + artigasJ * 0.25 + artigasVeta * 0.035, 0.04, 1.0);
diffuseColor.rgb *= 1.0 - artigasJ * 0.45;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * uSolColor * max(dot(artigasN, uSol), 0.0);`);
  };
  m.customProgramCacheKey = () => `artigas-detalle-${juntas > 0 ? 1 : 0}-${sol ? 1 : 0}`;
  return m;
}

/** Vidrio de la Cúpula: casi invisible de frente, con reflejo azulado en ángulo rasante y brillo del sol. */
export function crearVidrio(sol) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uSol: { value: sol.clone() },
      uTinte: { value: new THREE.Color(0.55, 0.78, 0.95) },
      uAntirreflejo: { value: new THREE.Color(0.62, 0.45, 0.85) },
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uSol;
      uniform vec3 uTinte;
      uniform vec3 uAntirreflejo;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        float c = abs(dot(n, v));
        float f = 1.0 - c;
        float fresnel = f * f * f;                           // Schlick barato: (1 - cos)^3
        vec3 r = reflect(-v, n * sign(dot(n, v)));
        float brillo = pow(max(dot(r, uSol), 0.0), 48.0);
        vec3 color = mix(uAntirreflejo, uTinte, smoothstep(0.0, 0.6, f)) + vec3(1.0, 0.96, 0.9) * brillo;
        float alfa = clamp(0.035 + 0.5 * fresnel + brillo * 0.7, 0.0, 0.9);
        gl_FragColor = vec4(color, alfa);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * Prepara los materiales del GLB. Devuelve una función que elige el material final de cada malla.
 * @param {THREE.Texture} entorno
 * @param {THREE.Vector3} sol Dirección hacia el sol (mundo).
 */
export function crearBiblioteca(renderer, entorno, sol) {
  const cache = new Map();
  const vidrio = crearVidrio(sol);
  const anisotropia = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  /** @param {THREE.Material} original @param {'general'|'estructura'|'cupula'} uso */
  return function materialPara(original, uso) {
    const clave = `${original.uuid}|${uso}`;
    let m = cache.get(clave);
    if (m) return m;
    const nombre = original.name || '';
    if (nombre.includes('Vidrio')) {
      m = vidrio;
    } else if (nombre.includes('Pantallas')) {
      // pantallas: se ven por su propia luz; un material sin iluminación es lo más barato
      m = new THREE.MeshBasicMaterial({ map: original.map, name: nombre });
    } else if (nombre.includes('Paleta')) {
      original.envMap = entorno;
      original.envMapIntensity = 0.9;
      if (uso === 'estructura') m = conDetalle(original, { juntas: 1 });
      else if (uso === 'cupula') m = conDetalle(original, { sol });
      else m = original;
      m.name = `${nombre}_${uso}`;
    } else {
      // carteles y placas de vinilo
      original.envMap = entorno;
      original.envMapIntensity = 0.35;
      if (original.map) original.map.anisotropy = anisotropia;
      m = original;
    }
    cache.set(clave, m);
    return m;
  };
}
