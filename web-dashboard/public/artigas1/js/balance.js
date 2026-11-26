// Minijuego B · Balance de masas del depósito de Rivera.
//
// En gravedad cero la carga no «pesa» hacia abajo, pero tiene masa: si queda toda de un lado, el centro de masa
// de la estación se corre del eje y los propulsores gastan propelente para mantener la orientación. Llegaron
// tres tanques de agua (lastre) y hay que ubicarlos en huecos libres de Rivera para que el centro de masa
// lateral de la carga quede dentro del círculo de tolerancia, amarrarlos y confirmar en el panel de balance del
// Nodo.
//
// Cuentas (las mismas que StationMass.cs del proyecto Unity, sin la masa de la estructura, que es simétrica):
//   CM = Σ mᵢ·rᵢ / Σ mᵢ   sobre los bultos de Rivera y los contenedores apoyados en sus huecos;
//   desvío lateral = distancia del CM al eje de la estación (x, y): el largo del módulo (z) no se cuenta.
// La tolerancia se elige al empezar: la mejor ubicación posible con los huecos libres de ese momento más 2,5 cm.
// Así siempre hay solución, y poner los tres tanques del mismo lado queda afuera.
import * as THREE from 'three';
import { Armado } from './herramientas.js';
import { COLORES, PanelVR, renglones } from './paneles.js';

/** Tanques de lastre: código, masa y lugar donde esperan (Rivera, junto a la escotilla del Nodo). */
export const TANQUES = [
  { codigo: 'AGUA-60', pesoKg: 60, posicion: [0.5, -0.5, -0.35] },
  { codigo: 'AGUA-45', pesoKg: 45, posicion: [-0.5, -0.5, -0.35] },
  { codigo: 'AGUA-35', pesoKg: 35, posicion: [0.5, 0.5, -0.35] },
];
export const TOLERANCIA_EXTRA = 0.025;                   // m por encima de la mejor ubicación posible
export const TOLERANCIA_MIN = 0.03;
export const TOLERANCIA_MAX = 0.08;

/** Centro de masa de una lista de { masa, posicion }. */
export function centroDeMasa(cargas, out = new THREE.Vector3()) {
  let total = 0;
  out.set(0, 0, 0);
  for (const c of cargas) {
    const m = Math.max(0, c.masa);
    out.addScaledVector(c.posicion, m);
    total += m;
  }
  return total > 0 ? out.multiplyScalar(1 / total) : out;
}

/** Desvío lateral: distancia al eje de la estación (el eje Z). */
export const desvioLateral = (cm) => Math.hypot(cm.x, cm.y);

/**
 * La mejor ubicación de los tanques en los huecos libres (prueba todas, tanques en huecos distintos).
 * @param {{masa: number, posicion: THREE.Vector3}} base  Masa y centro de masa de la carga que ya está.
 * @param {number[]} masas
 * @param {{codigo: string, posicion: THREE.Vector3}[]} huecos
 * @returns {{desvio: number, huecos: string[]}}
 */
export function mejorUbicacion(base, masas, huecos) {
  const mx = base.masa * base.posicion.x, my = base.masa * base.posicion.y;
  const total = base.masa + masas.reduce((a, b) => a + b, 0);
  let mejor = { desvio: Infinity, huecos: [] };
  const usados = new Array(huecos.length).fill(false);
  const elegidos = [];
  const probar = (i, sx, sy) => {
    if (i === masas.length) {
      const d = Math.hypot(sx / total, sy / total);
      if (d < mejor.desvio) mejor = { desvio: d, huecos: elegidos.map((k) => huecos[k].codigo) };
      return;
    }
    for (let k = 0; k < huecos.length; k++) {
      if (usados[k]) continue;
      usados[k] = true;
      elegidos.push(k);
      probar(i + 1, sx + masas[i] * huecos[k].posicion.x, sy + masas[i] * huecos[k].posicion.y);
      elegidos.pop();
      usados[k] = false;
    }
  };
  probar(0, mx, my);
  return mejor;
}

/** Malla de un tanque de agua: cilindro azul con aros blancos y tapa, del tamaño de un hueco del rack. */
export function geometriaTanque() {
  return new Armado()
    .cil(0.105, 0.105, 0.34, 0x2f6fb3, [0, 0, 0], [Math.PI / 2, 0, 0], 14)
    .cil(0.109, 0.109, 0.03, 0xe8eef6, [0, 0, -0.11], [Math.PI / 2, 0, 0], 14)
    .cil(0.109, 0.109, 0.03, 0xe8eef6, [0, 0, 0.11], [Math.PI / 2, 0, 0], 14)
    .cil(0.03, 0.03, 0.03, 0x22262b, [0, 0, 0.185], [Math.PI / 2, 0, 0], 8)
    .terminar();
}

export class BalanceRivera {
  /** @param {import('./inventario.js').Inventario} inventario */
  constructor(inventario) {
    this.inventario = inventario;
    /** @type {object[]} flotantes de los tanques */
    this.tanques = [];
    this.tolerancia = TOLERANCIA_MAX;
    this.mejor = null;
    this.cm = new THREE.Vector3();
    this.desvio = 0;
  }

  /** Huecos de Rivera libres. */
  huecosLibres() {
    return this.inventario.huecos.filter((h) => !h.ocupado && h.codigo.startsWith('RIV'));
  }

  /** Masas de Rivera: bultos y contenedores apoyados en sus huecos (incluidos los tanques). */
  cargas() {
    const lista = [];
    for (const b of this.inventario.bultos) if (b.ubicacion.startsWith('RIV') && b.centro) lista.push({ masa: b.pesoKg, posicion: b.centro });
    for (const f of this.inventario.contenedores) {
      const h = f.datos.hueco;
      if (h && h.codigo.startsWith('RIV')) lista.push({ masa: f.datos.pesoKg, posicion: h.posicion });
    }
    return lista;
  }

  /** Recalcula el centro de masa y el desvío. */
  medir() {
    centroDeMasa(this.cargas(), this.cm);
    this.desvio = desvioLateral(this.cm);
    return this.desvio;
  }

  get dentro() { return this.desvio <= this.tolerancia; }

  /** Al empezar: la tolerancia sale de la mejor ubicación posible con los huecos libres de ahora. */
  preparar() {
    const fuera = this.tanques.filter((f) => !f.datos.hueco);
    const base = this.cargas();
    const masa = base.reduce((a, c) => a + c.masa, 0);
    this.mejor = mejorUbicacion({ masa, posicion: centroDeMasa(base) }, fuera.map((f) => f.datos.pesoKg), this.huecosLibres());
    this.tolerancia = THREE.MathUtils.clamp(this.mejor.desvio + TOLERANCIA_EXTRA, TOLERANCIA_MIN, TOLERANCIA_MAX);
    this.medir();
  }

  /** Tanques amarrados en Rivera. */
  amarrados() {
    return this.tanques.filter((f) => f.datos.hueco && f.datos.hueco.codigo.startsWith('RIV') && f.datos.amarre && f.datos.amarre.amarrado).length;
  }
}

/**
 * Panel del balance en el Nodo: ocupa la pantalla del panel de balance del kit (que traía una imagen fija) y
 * muestra el corte del módulo con el centro de masa ampliado, el círculo de tolerancia, el estado de cada
 * tanque y los botones. Es también el terminal de la actividad (INICIAR, PAUSAR, DEJAR): en la pared de babor
 * del Nodo no entra otro terminal sin chocar con la baranda, el matafuegos o la escotilla.
 * @param {BalanceRivera} balance
 * @param {{confirmar: () => void, estado: () => string, puedeIniciar: () => boolean, iniciar: () => void,
 *   pausar: () => void, reanudar: () => void, abandonar: () => void}} acciones
 * @param {{ancho: number, alto: number}} [medidas]  Metros: las de la pantalla del kit.
 */
export function crearPanelBalance(balance, acciones, { ancho = 1.18, alto = 0.58 } = {}) {
  const W = 1200, H = Math.round(W * alto / ancho);
  const panel = new PanelVR({ ancho, alto, px: W, nombre: 'Terminal_balance', dibujar: (ctx, p) => {
    balance.medir();
    ctx.fillStyle = COLORES.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORES.azul;
    ctx.fillRect(0, 0, W, 62);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('BALANCE DE MASAS · DEPÓSITO RIVERA', 24, 44);
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORES.amarillo;
    const estado = acciones.estado();
    ctx.fillText(estado === 'ACTIVA' ? 'EN CURSO' : estado === 'PAUSADA' ? 'EN PAUSA' : 'MEDICIÓN EN VIVO', W - 24, 42);
    // --- corte del módulo, ampliado: el círculo grande son 20 cm alrededor del eje
    const R = (H - 62) / 2 - 26, cx = 40 + R, cy = 62 + (H - 62) / 2, escala = R / 0.2;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#3a4656';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    ctx.fillStyle = COLORES.gris;
    ctx.font = '20px sans-serif';
    ctx.fillText('BABOR', cx - R + 42, cy - 8);
    ctx.fillText('ESTRIBOR', cx + R - 54, cy - 8);
    ctx.fillText('TECHO', cx, cy - R + 24);
    ctx.fillText('PISO', cx, cy + R - 10);
    ctx.fillText('10 cm', cx + R / 2 + 30, cy + 22);
    const rt = balance.tolerancia * escala;
    ctx.fillStyle = balance.dentro ? 'rgba(62, 207, 110, 0.22)' : 'rgba(252, 209, 22, 0.18)';
    ctx.beginPath(); ctx.arc(cx, cy, rt, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = balance.dentro ? COLORES.verde : COLORES.amarillo;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, rt, 0, Math.PI * 2); ctx.stroke();
    // el CM: x de la estación hacia la derecha (estribor), y hacia arriba; si se va lejos, queda en el borde
    let px = balance.cm.x * escala, py = -balance.cm.y * escala;
    const d = Math.hypot(px, py);
    if (d > R - 12) { px *= (R - 12) / d; py *= (R - 12) / d; }
    ctx.fillStyle = balance.dentro ? COLORES.verde : COLORES.rojo;
    ctx.beginPath(); ctx.arc(cx + px, cy + py, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORES.blanco;
    ctx.lineWidth = 3;
    ctx.stroke();
    // --- estado
    ctx.textAlign = 'left';
    const x0 = cx + R + 50;
    let y = 120;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillStyle = balance.dentro ? COLORES.verde : COLORES.rojo;
    ctx.fillText(`Desvío: ${(balance.desvio * 100).toFixed(1)} cm  ${balance.dentro ? 'DENTRO' : 'FUERA'}`, x0, y);
    y += 44;
    ctx.font = '28px sans-serif';
    ctx.fillStyle = COLORES.blanco;
    ctx.fillText(`Tolerancia: ${(balance.tolerancia * 100).toFixed(1)} cm`, x0, y);
    y += 56;
    for (const f of balance.tanques) {
      const h = f.datos.hueco;
      const amarrado = f.datos.amarre && f.datos.amarre.amarrado && h;
      ctx.fillStyle = amarrado ? COLORES.verde : h ? COLORES.amarillo : COLORES.gris;
      ctx.fillText(`${amarrado ? '✔' : h ? '◐' : '·'} ${f.datos.codigo}  ${h ? `${h.codigo}${amarrado ? '' : ' (sin amarrar)'}` : 'sin ubicar'}`, x0, y);
      y += 40;
    }
    ctx.font = '22px sans-serif';
    ctx.fillStyle = COLORES.gris;
    for (const linea of renglones(ctx, 'Los tanques pesados van del lado contrario al que está corrido el punto.', W - x0 - 30)) { ctx.fillText(linea, x0, y + 6); y += 28; }
    const ancho = W - x0 - 30, yb = H - 104;
    if (estado === 'ACTIVA') {
      p.boton('confirmar', x0, yb, ancho - 300, 78, 'CONFIRMAR', acciones.confirmar, { estilo: 'aviso' });
      p.boton('pausar', x0 + ancho - 288, yb, 138, 78, 'PAUSAR', acciones.pausar);
      p.boton('dejar', x0 + ancho - 138, yb, 138, 78, 'DEJAR', acciones.abandonar);
    } else if (estado === 'PAUSADA') {
      p.boton('seguir', x0, yb, ancho, 78, 'SEGUIR', acciones.reanudar, { estilo: 'aviso' });
    } else {
      p.boton('iniciar', x0, yb, ancho, 78, estado === 'COMPLETADA' || estado === 'FALLIDA' ? 'REPETIR' : 'INICIAR', acciones.iniciar, { activo: acciones.puedeIniciar(), estilo: 'aviso' });
    }
  } });
  return panel;
}
