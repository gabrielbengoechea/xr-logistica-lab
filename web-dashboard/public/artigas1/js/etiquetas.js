// Etiquetas logísticas de la carga: un atlas generado en un canvas y un solo InstancedMesh para todas.
// Cada etiqueta lleva código, descripción, categoría, peso, ubicación, un código tipo QR y una advertencia.
import * as THREE from 'three';

const COLS = 8;
const FILAS = 16;
const ANCHO = 256;
const ALTO = 128;

const CATEGORIAS = [
  { nombre: 'ALIMENTOS', color: '#2e7d32', items: ['Raciones liofilizadas', 'Yerba mate envasada', 'Agua potable 6 L', 'Fruta deshidratada'], aviso: 'CONSUMIR PRIMERO LO QUE VENCE' },
  { nombre: 'REPUESTOS', color: '#455a64', items: ['Filtros de CO₂', 'Kit de válvulas', 'Bomba de circulación', 'Juntas y sellos'], aviso: 'NO APILAR · PIEZA FRÁGIL' },
  { nombre: 'MÉDICO', color: '#c62828', items: ['Botiquín de a bordo', 'Insumos estériles', 'Medicación controlada'], aviso: 'MATERIAL CRÍTICO · MANTENER SELLADO' },
  { nombre: 'HIGIENE', color: '#00838f', items: ['Toallas y paños', 'Kit de higiene personal', 'Bolsas de residuos'], aviso: 'MANTENER SECO' },
  { nombre: 'EXPERIMENTO', color: '#6a1b9a', items: ['Muestras UTEC Rivera', 'Cultivo de semillas', 'Sensores de vibración'], aviso: 'NO INVERTIR · CADENA DE FRÍO' },
  { nombre: 'QUÍMICOS', color: '#ef6c00', items: ['Hidróxido de litio', 'Limpiador de superficies'], aviso: 'LEJOS DE ALIMENTOS' },
];

function azarDe(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Dibuja un código de 13 x 13 módulos con los tres localizadores de un QR. Es un gráfico, no un QR legible. */
function dibujarCodigo(ctx, x, y, lado, azar) {
  const n = 13;
  const m = lado / n;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 2, y - 2, lado + 4, lado + 4);
  ctx.fillStyle = '#111';
  const localizador = (cx, cy) => {
    ctx.fillRect(x + cx * m, y + cy * m, 5 * m, 5 * m);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + (cx + 1) * m, y + (cy + 1) * m, 3 * m, 3 * m);
    ctx.fillStyle = '#111';
    ctx.fillRect(x + (cx + 2) * m, y + (cy + 2) * m, m, m);
  };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const enLocalizador = (i < 6 && j < 6) || (i > 6 && j < 6 && i >= n - 6) || (i < 6 && j >= n - 6);
    if (!enLocalizador && azar() < 0.48) ctx.fillRect(x + i * m, y + j * m, m + 0.3, m + 0.3);
  }
  localizador(0, 0);
  localizador(n - 5, 0);
  localizador(0, n - 5);
}

function dibujarEtiqueta(ctx, x, y, e) {
  const cat = CATEGORIAS[e.categoria];
  ctx.fillStyle = '#f4f4f0';
  ctx.fillRect(x, y, ANCHO, ALTO);
  ctx.fillStyle = cat.color;
  ctx.fillRect(x, y, ANCHO, 26);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(cat.nombre, x + 8, y + 14);
  ctx.textAlign = 'right';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('ARTIGAS-1', x + ANCHO - 8, y + 14);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#111';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(e.codigo, x + 8, y + 44);
  ctx.font = '13px sans-serif';
  ctx.fillText(e.descripcion, x + 8, y + 66);
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`${e.pesoKg.toFixed(1).replace('.', ',')} kg`, x + 8, y + 86);
  ctx.font = '12px monospace';
  ctx.fillText(e.ubicacion, x + 74, y + 86);
  ctx.fillStyle = '#b71c1c';
  ctx.font = 'bold 9.5px sans-serif';
  ctx.fillText(`⚠ ${cat.aviso}`, x + 8, y + 108);
  dibujarCodigo(ctx, x + ANCHO - 72, y + 34, 62, azarDe(e.semilla));
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, ANCHO - 2, ALTO - 2);
}

/** "R_Demo_RIV-E2_A3" -> "RIV-E2-A3"; "C_Carga_E_C1_N3_BTC_1" -> "CR01-E-C1-N3". */
export function ubicacionDe(nombre) {
  let m = /Demo_([A-Z]+-?[A-Z]\d)_([AB]\d)/.exec(nombre);
  if (m) return `${m[1]}-${m[2]}`;
  m = /Carga_([EB])_(C\d)_(N\d)/.exec(nombre);
  if (m) return `CR01-${m[1]}-${m[2]}-${m[3]}`;
  return 'EN TRÁNSITO';
}

/**
 * @param {{nombre: string, matriz: THREE.Matrix4, grande: boolean}[]} cargas  Bolsas con bolsillo de etiqueta.
 * @returns {{malla: THREE.InstancedMesh|null, datos: object[]}}
 */
export function crearEtiquetas(cargas, renderer) {
  const total = Math.min(cargas.length, COLS * FILAS);
  if (total === 0) return { malla: null, datos: [] };
  const canvas = document.createElement('canvas');
  canvas.width = COLS * ANCHO;
  canvas.height = FILAS * ALTO;
  const ctx = canvas.getContext('2d');
  const datos = [];
  const desfases = new Float32Array(total * 2);
  const geo = new THREE.PlaneGeometry(0.19, 0.095);
  const mat = new THREE.MeshBasicMaterial({ color: 0xdadad6 });
  const malla = new THREE.InstancedMesh(geo, mat, total);
  const local = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  for (let i = 0; i < total; i++) {
    const c = cargas[i];
    const azar = azarDe(i * 7919 + 17);
    // las bolsas grandes llevan repuestos o experimentos; las chicas, cualquier categoría
    const cat = c.grande ? CATEGORIAS[azar() < 0.5 ? 1 : 4] : CATEGORIAS[Math.floor(azar() * CATEGORIAS.length)];
    const e = {
      codigo: `${c.grande ? 'BTC2' : 'BTC1'}-${String(i + 1).padStart(4, '0')}`,
      categoria: CATEGORIAS.indexOf(cat),
      descripcion: cat.items[Math.floor(azar() * cat.items.length)],
      pesoKg: c.grande ? 16 + azar() * 12 : 3.5 + azar() * 7,
      ubicacion: ubicacionDe(c.nombre),
      semilla: i * 104729 + 3,
    };
    datos.push(e);
    const col = i % COLS;
    const fila = Math.floor(i / COLS);
    dibujarEtiqueta(ctx, col * ANCHO, fila * ALTO, e);
    desfases[i * 2] = col / COLS;
    desfases[i * 2 + 1] = 1 - (fila + 1) / FILAS;
    // bolsillo de la etiqueta: al frente de la bolsa (+Z en glTF), 2 mm por delante de la tela
    local.makeTranslation(0, c.grande ? 0.024 : 0.0125, 0.2575);
    malla.setMatrixAt(i, m.multiplyMatrices(c.matriz, local));
  }
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  mat.map = textura;
  geo.setAttribute('aDesfase', new THREE.InstancedBufferAttribute(desfases, 2));
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aDesfase;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv = uv * vec2(${(1 / COLS).toFixed(6)}, ${(1 / FILAS).toFixed(6)}) + aDesfase;`);
  };
  malla.instanceMatrix.needsUpdate = true;
  malla.name = 'Etiquetas_Logisticas';
  malla.frustumCulled = false;       // las instancias están repartidas por toda la estación
  return { malla, datos };
}
