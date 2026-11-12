// Entorno orbital: la Tierra con día, noche y atmósfera, el sol y el campo de estrellas.
// Todo con shaders chicos y pocas llamadas de dibujo: 2 para la Tierra, 1 para el halo, 1 para las estrellas
// y 1 para el sol.
import * as THREE from 'three';

/**
 * Dirección hacia el sol, en el mundo (glTF: Y arriba, norte = -Z, este = +X; la estación mira al nadir en -Y).
 * El sol está bajo sobre el horizonte oeste-noroeste: 12° de altura vistos desde el suelo bajo la estación.
 * Así el Río de la Plata está de día y la línea día/noche queda a la vista hacia el este, sobre el Atlántico.
 */
export const SOL = (() => {
  const altura = THREE.MathUtils.degToRad(12);
  const horizontal = new THREE.Vector3(-0.92, 0, -0.39).normalize();
  return horizontal.multiplyScalar(Math.cos(altura)).add(new THREE.Vector3(0, Math.sin(altura), 0)).normalize();
})();

const VERT_TIERRA = `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const FRAG_TIERRA = `
  uniform sampler2D uMapa;
  uniform vec3 uSol;
  uniform float uUsarAlfa;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 tex = texture2D(uMapa, vUv);
    vec3 n = normalize(vN);
    float ndl = dot(n, uSol);
    float dia = smoothstep(-0.10, 0.22, ndl);                       // terminador ancho y suave
    vec3 noche = tex.rgb * 0.015 + vec3(0.004, 0.007, 0.018);
    vec3 color = mix(noche, tex.rgb * (0.45 + 0.75 * dia), dia);
    color += vec3(0.55, 0.22, 0.06) * dia * (1.0 - dia) * 0.5;      // franja cálida del atardecer
    float borde = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 3.0);  // bruma azul hacia el limbo
    color = mix(color, vec3(0.30, 0.55, 1.0) * (0.15 + 0.85 * dia), borde * 0.75);
    gl_FragColor = vec4(color, mix(1.0, tex.a, uUsarAlfa));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function materialTierra(mapa, transparente) {
  return new THREE.ShaderMaterial({
    uniforms: { uMapa: { value: mapa }, uSol: { value: SOL.clone() }, uUsarAlfa: { value: transparente ? 1 : 0 } },
    vertexShader: VERT_TIERRA,
    fragmentShader: FRAG_TIERRA,
    transparent: transparente,
    depthWrite: !transparente,
  });
}

function crearHalo(centro, radio) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uSol: { value: SOL.clone() } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: VERT_TIERRA,
    fragmentShader: `
      uniform vec3 uSol;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        float c = max(dot(n, normalize(vV)), 0.0);
        float dia = smoothstep(-0.25, 0.25, dot(n, uSol));
        float a = pow(1.0 - c, 4.0) * smoothstep(0.0, 0.22, c);     // brilla en el limbo y se apaga en el borde
        gl_FragColor = vec4(vec3(0.25, 0.55, 1.0) * a * dia * 1.6, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(radio, 64, 32), m);
  halo.position.copy(centro);
  halo.name = 'Halo_Atmosfera';
  return halo;
}

/** Campo de estrellas: una sola llamada de dibujo (THREE.Points), con tamaño y color por estrella. */
export function crearEstrellas(cantidad = 3200, radio = 2300) {
  // generador determinista: las estrellas quedan en el mismo lugar en cada visita
  let s = 20261112;
  const azar = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pos = new Float32Array(cantidad * 3);
  const dato = new Float32Array(cantidad * 2);       // brillo, tinte
  for (let i = 0; i < cantidad; i++) {
    const y = azar() * 2 - 1;
    const a = azar() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(a) * r * radio;
    pos[i * 3 + 1] = y * radio;
    pos[i * 3 + 2] = Math.sin(a) * r * radio;
    dato[i * 2] = Math.pow(azar(), 5);               // muchas tenues, pocas brillantes
    dato[i * 2 + 1] = azar();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aDato', new THREE.BufferAttribute(dato, 2));
  const m = new THREE.ShaderMaterial({
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    uniforms: { uEscala: { value: 1 } },
    vertexShader: `
      attribute vec2 aDato;
      uniform float uEscala;
      varying vec3 vColor;
      void main() {
        float b = 0.35 + 0.65 * aDato.x;
        vColor = mix(vec3(1.0, 0.86, 0.72), vec3(0.75, 0.86, 1.0), aDato.y) * b;
        gl_PointSize = (1.4 + 2.6 * aDato.x) * uEscala;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.15, length(d));
        gl_FragColor = vec4(vColor * a, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, m);
  p.name = 'Estrellas';
  p.frustumCulled = false;
  return p;
}

function crearSol(distancia = 2200) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float disco = smoothstep(0.16, 0.12, r);
        float halo = pow(max(1.0 - r, 0.0), 3.0) * 0.6;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * (disco * 3.0 + halo), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), m);
  sol.position.copy(SOL).multiplyScalar(distancia);
  sol.lookAt(0, 0, 0);
  sol.name = 'Sol';
  return sol;
}

/**
 * Arma el entorno a partir del GLB de la Tierra (esfera + casquete de detalle del Río de la Plata).
 * @returns {{grupo: THREE.Group, actualizar: (dt: number) => void, estrellas: THREE.Points}}
 */
export function crearEntornoOrbital(gltfTierra) {
  const grupo = new THREE.Group();
  grupo.name = 'Entorno_Orbital';
  const giran = [];
  let centro = null;
  let radio = 1000;
  gltfTierra.scene.updateMatrixWorld(true);
  gltfTierra.scene.traverse((o) => {
    if (!o.isMesh) return;
    const detalle = o.name.includes('Detalle');
    const mapa = o.material.map;
    o.material.dispose();
    o.material = materialTierra(mapa, detalle);
    o.renderOrder = detalle ? 1 : 0;
    giran.push(o);
    if (!detalle) {
      centro = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      o.geometry.computeBoundingSphere();
      radio = o.geometry.boundingSphere.radius;
    }
  });
  grupo.add(gltfTierra.scene);
  if (centro) grupo.add(crearHalo(centro, radio * 1.02));
  const estrellas = crearEstrellas();
  grupo.add(estrellas);
  grupo.add(crearSol());
  return {
    grupo,
    estrellas,
    // medio grado por minuto, siempre para el mismo lado (el eje polar es el Y local de la esfera)
    actualizar(dt) { for (const t of giran) t.rotateY(dt * 0.000145); },
  };
}
