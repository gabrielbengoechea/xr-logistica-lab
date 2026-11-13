// Entorno orbital: la Tierra al atardecer, la atmósfera, el sol y el campo de estrellas.
//
// La Tierra no depende de la malla para verse redonda. La malla (un casquete liviano) solo marca qué píxeles
// hay que calcular; en cada píxel el shader cruza el rayo de la cámara con una esfera matemática. Así:
//  - la silueta es un círculo perfecto, sin facetas, con el borde suavizado;
//  - la normal, el terminador día/noche y la bruma se calculan por píxel sobre la esfera, no interpolando
//    entre vértices (esa interpolación, con triángulos de 65 m a 63 m de la cámara, era la «sombra poligonal»);
//  - la atmósfera sale del mismo rayo: no hace falta una segunda esfera transparente.
//
// Geografía: dos capas en proyección azimutal de Lambert centrada en el nadir (ver artigas1-vr/Blender/tierra.py),
// cada una con textura de día y de luces nocturnas. Las luces usan las mismas coordenadas que el terreno, así
// que quedan pegadas a la superficie. Costo: 1 llamada de dibujo para la Tierra y la atmósfera, 1 para las
// estrellas y 1 para el sol.
import * as THREE from 'three';

/** Centro y radio de la Tierra en el mundo: 400 km de altura a escala (63 m sobre una esfera de 1000 m). */
export const TIERRA = { centro: new THREE.Vector3(0, -1065.2944, 2.11), radio: 1000 };
/** Radio angular de cada capa de textura (grados). Tienen que coincidir con tierra.py. */
const RADIO_BASE = 30.0;
const RADIO_DETALLE = 5.5;
const rho = (grados) => 2 * Math.sin(THREE.MathUtils.degToRad(grados) / 2);

/**
 * Dirección hacia el sol, en el mundo (Y arriba, este = +X, norte = -Z; la estación mira al nadir en -Y).
 * Atardecer de noviembre en el Río de la Plata: el sol se pone por el oeste-suroeste (acimut ~249°) y ya
 * está 2,5° bajo el horizonte del suelo. A 400 km de altura la estación lo sigue viendo, bajo, sobre el limbo.
 */
export const SOL = (() => {
  const altura = THREE.MathUtils.degToRad(-2.5);
  const horizontal = new THREE.Vector3(-0.934, 0, 0.358).normalize();
  return horizontal.multiplyScalar(Math.cos(altura)).add(new THREE.Vector3(0, Math.sin(altura), 0)).normalize();
})();
/** Color de la luz del sol que llega a la estación, enrojecida por atravesar la atmósfera casi de canto. */
export const COLOR_SOL = new THREE.Color(1.0, 0.66, 0.40);

const VERT_TIERRA = `
  varying vec3 vMundo;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vMundo = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const FRAG_TIERRA = `
  precision highp float;
  uniform vec3 uCentro;
  uniform float uRadio;
  uniform vec3 uSol;
  uniform mat3 uGiro;            // mundo -> marco de la textura (incluye la deriva de la órbita)
  uniform sampler2D uBaseDia;
  uniform sampler2D uBaseNoche;
  uniform sampler2D uDetDia;
  uniform sampler2D uDetNoche;
  uniform vec2 uRho;             // radio de cada capa en el plano de Lambert (base, detalle)
  varying vec3 vMundo;

  const float ALTURA_ATM = 0.0042;                 // altura de escala visual de la atmósfera, en radios (~27 km)
  const vec3 AZUL = vec3(0.26, 0.50, 1.0);
  const vec3 NARANJA = vec3(1.0, 0.42, 0.12);

  // color del cielo visto desde afuera según el sol en ese punto: azul de día, franja cálida en el terminador
  vec3 cieloEn(float mu) {
    float dia = smoothstep(-0.10, 0.25, mu);
    float ocaso = exp(-pow((mu - 0.03) / 0.075, 2.0));
    return AZUL * dia + NARANJA * ocaso * 0.55 + vec3(0.05, 0.07, 0.16) * smoothstep(-0.35, -0.05, mu) * (1.0 - dia);
  }

  void main() {
    vec3 o = (cameraPosition - uCentro) / uRadio;   // cámara en radios terrestres
    vec3 r = normalize(vMundo - cameraPosition);
    float b = dot(o, r);
    if (b > 0.0) discard;                            // la Tierra queda detrás
    float oo = dot(o, o);
    float p = sqrt(max(oo - b * b, 0.0));           // distancia mínima del rayo al centro (1 = roza la superficie)
    float fino = max(fwidth(p), 1e-5);
    float cobertura = 1.0 - smoothstep(1.0 - fino, 1.0 + fino, p);

    // ---- superficie: punto de la esfera que ve este píxel
    float t = -b - sqrt(max(1.0 - p * p, 0.0));
    vec3 n = normalize(o + r * t);
    float mu = dot(n, uSol);
    vec3 nl = uGiro * n;                             // este, arriba (nadir), sur
    vec2 plano = sqrt(2.0 / (1.0 + max(nl.y, -0.9))) * vec2(nl.x, -nl.z);
    vec2 uvB = 0.5 + plano / (2.0 * uRho.x);
    vec2 uvD = 0.5 + plano / (2.0 * uRho.y);
    float enDetalle = 1.0 - smoothstep(0.78, 0.97, length(plano) / uRho.y);
    vec3 albedo = mix(texture2D(uBaseDia, uvB).rgb, texture2D(uDetDia, uvD).rgb, enDetalle);
    vec2 nocheAgua = mix(texture2D(uBaseNoche, uvB).rg, texture2D(uDetNoche, uvD).rg, enDetalle);
    float luz = pow(nocheAgua.r, 2.6);               // rojo: luces urbanas (la textura guarda la raíz; algo más de contraste)
    float agua = nocheAgua.g;                        // verde: mar, ríos, lagos y embalses

    float dia = smoothstep(-0.08, 0.22, mu);
    vec3 colorSol = mix(vec3(1.0, 0.40, 0.14), vec3(1.0, 0.96, 0.90), smoothstep(0.0, 0.32, mu));
    vec3 color = albedo * colorSol * dia * 2.1;
    // crepúsculo: el terreno recibe la luz del cielo y el agua lo refleja (por eso ríos y embalses se destacan)
    float crepusculo = smoothstep(-0.30, 0.0, mu) * (1.0 - dia);
    color += mix(albedo * vec3(0.40, 0.41, 0.47), vec3(0.050, 0.075, 0.140) + albedo * 0.10, agua) * crepusculo;
    color += vec3(1.0, 0.62, 0.34) * agua * dia * (1.0 - dia) * 0.10;                       // reflejo cálido en el terminador
    color += albedo * 0.012;
    float noche = smoothstep(0.03, -0.09, mu);       // las ciudades se encienden a medida que entran en la noche
    color += vec3(1.0, 0.60, 0.24) * luz * noche * 3.0;
    // bruma: más atmósfera cuanto más rasante se mira
    float rasante = pow(1.0 - max(dot(n, -r), 0.0), 4.0);
    vec3 cielo = cieloEn(mu);
    color = mix(color, cielo, rasante * 0.62) + cielo * 0.03;

    // ---- atmósfera por fuera del disco: se apaga con la altura del rayo
    vec3 nAtm = normalize(o - r * b);
    float densidad = exp(-max(p - 1.0, 0.0) / ALTURA_ATM);
    float haciaElSol = pow(max(dot(r, uSol), 0.0), 10.0);                                    // resplandor del ocaso
    vec3 atm = (cieloEn(dot(nAtm, uSol)) * 1.15 + vec3(1.0, 0.50, 0.18) * haciaElSol * 1.6) * densidad;
    color += vec3(1.0, 0.46, 0.16) * haciaElSol * rasante * 0.5;
    float alfaAtm = clamp(densidad * 0.9, 0.0, 1.0);

    gl_FragColor = vec4(mix(atm, color, cobertura), mix(alfaAtm, 1.0, cobertura));   // color premultiplicado
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/**
 * Carga las cuatro texturas de la Tierra.
 * @param {THREE.LoadingManager} manager
 * @param {number} anisotropia
 */
export function cargarTexturasTierra(manager, anisotropia = 4) {
  const loader = new THREE.TextureLoader(manager);
  const una = (archivo, color) => loader.loadAsync(archivo).then((t) => {
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;   // la de noche lleva datos, no color
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = anisotropia;                      // la Tierra se mira casi siempre de costado
    return t;
  });
  return Promise.all([
    una('./tierra_base_dia.webp', true), una('./tierra_base_noche.webp', false),
    una('./tierra_detalle_dia.webp', true), una('./tierra_detalle_noche.webp', false),
  ]).then(([baseDia, baseNoche, detDia, detNoche]) => ({ baseDia, baseNoche, detDia, detNoche }));
}

function crearTierra(tex) {
  const giro = new THREE.Matrix3();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCentro: { value: TIERRA.centro.clone() },
      uRadio: { value: TIERRA.radio },
      uSol: { value: SOL.clone() },
      uGiro: { value: giro },
      uBaseDia: { value: tex.baseDia },
      uBaseNoche: { value: tex.baseNoche },
      uDetDia: { value: tex.detDia },
      uDetNoche: { value: tex.detNoche },
      uRho: { value: new THREE.Vector2(rho(RADIO_BASE), rho(RADIO_DETALLE)) },
    },
    vertexShader: VERT_TIERRA,
    fragmentShader: FRAG_TIERRA,
    transparent: true,                               // se dibuja después de la estación: solo los píxeles que se ven
    depthWrite: false,
    premultipliedAlpha: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  // Casquete que envuelve la esfera y su atmósfera vistas desde la estación (24° alrededor del nadir, 3 % más alto).
  const g = new THREE.SphereGeometry(TIERRA.radio * 1.03, 72, 18, 0, Math.PI * 2, 0, THREE.MathUtils.degToRad(24));
  const malla = new THREE.Mesh(g, material);
  malla.position.copy(TIERRA.centro);
  malla.name = 'Tierra';
  malla.frustumCulled = false;
  malla.renderOrder = -1;
  malla.matrixAutoUpdate = false;
  malla.updateMatrix();
  return { malla, giro };
}

/**
 * Campo de estrellas: una sola llamada de dibujo. Puntos chicos (1 a 2,6 px) con brillo y tinte propios;
 * un tercio se concentra en una banda inclinada, como la Vía Láctea, para que el cielo no sea uniforme.
 */
export function crearEstrellas(cantidad = 4200, radio = 2300) {
  // generador determinista: las estrellas quedan en el mismo lugar en cada visita
  let s = 20261112;
  const azar = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pos = new Float32Array(cantidad * 3);
  const dato = new Float32Array(cantidad * 2);       // brillo, tinte
  const polo = new THREE.Vector3(0.48, 0.62, 0.62).normalize();   // eje de la banda
  const u = new THREE.Vector3(1, 0, 0).cross(polo).normalize();
  const w = new THREE.Vector3().crossVectors(polo, u);
  const v = new THREE.Vector3();
  for (let i = 0; i < cantidad; i++) {
    const enBanda = azar() < 0.34;
    const a = azar() * Math.PI * 2;
    // altura sobre el plano: uniforme en toda la esfera o apretada contra la banda
    const y = enBanda ? (azar() + azar() + azar() - 1.5) * 0.22 : azar() * 2 - 1;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    v.copy(u).multiplyScalar(Math.cos(a) * r).addScaledVector(w, Math.sin(a) * r).addScaledVector(polo, y).multiplyScalar(radio);
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y;
    pos[i * 3 + 2] = v.z;
    dato[i * 2] = Math.pow(azar(), enBanda ? 7 : 5);  // muchas tenues, pocas brillantes
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
        float b = 0.22 + 0.78 * aDato.x;
        vColor = mix(vec3(1.0, 0.84, 0.70), vec3(0.74, 0.85, 1.0), aDato.y) * b;
        gl_PointSize = (1.0 + 1.6 * aDato.x) * uEscala;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.1, length(d));
        gl_FragColor = vec4(vColor * a, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, m);
  p.name = 'Estrellas';
  p.frustumCulled = false;
  p.renderOrder = -3;                                // antes que la Tierra, que las tapa
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
        float disco = smoothstep(0.075, 0.055, r);
        float halo = pow(max(1.0 - r, 0.0), 5.0) * 0.9 + pow(max(1.0 - r, 0.0), 2.0) * 0.10;
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.52) * (disco * 4.0 + halo), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), m);
  sol.position.copy(SOL).multiplyScalar(distancia);
  sol.lookAt(0, 0, 0);
  sol.name = 'Sol';
  sol.renderOrder = -2;
  return sol;
}

/** Deriva máxima del terreno bajo la estación (grados) y su velocidad (grados por minuto). */
const DERIVA_MAX = 6;
const DERIVA_POR_MINUTO = 0.3;

/**
 * Arma el entorno orbital.
 * @param {{baseDia: THREE.Texture, baseNoche: THREE.Texture, detDia: THREE.Texture, detNoche: THREE.Texture}} texturas
 * @returns {{grupo: THREE.Group, actualizar: (dt: number) => void, estrellas: THREE.Points, tierra: THREE.Mesh, deriva: () => number}}
 */
export function crearEntornoOrbital(texturas) {
  const grupo = new THREE.Group();
  grupo.name = 'Entorno_Orbital';
  const { malla, giro } = crearTierra(texturas);
  const estrellas = crearEstrellas();
  grupo.add(estrellas, crearSol(), malla);
  let angulo = 0;
  const aplicar = () => {
    // La estación avanza hacia el este: el terreno corre hacia el oeste. Giro alrededor del eje norte-sur.
    const c = Math.cos(angulo);
    const s = Math.sin(angulo);
    giro.set(c, s, 0, -s, c, 0, 0, 0, 1);
  };
  aplicar();
  return {
    grupo,
    estrellas,
    tierra: malla,
    deriva: () => THREE.MathUtils.radToDeg(angulo),
    /** La deriva es lenta y se detiene a los 6°: Uruguay no se va de la vista durante la sesión. */
    actualizar(dt) {
      const tope = THREE.MathUtils.degToRad(DERIVA_MAX);
      if (angulo >= tope) return;
      angulo = Math.min(tope, angulo + THREE.MathUtils.degToRad(DERIVA_POR_MINUTO) * dt / 60);
      aplicar();
    },
  };
}
