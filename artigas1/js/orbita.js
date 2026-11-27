// Panel de la órbita acelerada en la Cúpula (Sprint 03, B28). Aparece al entrar a la Cúpula, delante de la
// vista, y se puede cerrar. Al salir de la Cúpula la órbita vuelve al tiempo real.
import { FACTOR_ORBITA, PERIODO_ORBITA_MIN, SEGUNDOS_POR_VUELTA } from './entorno.js';
import { COLORES, PanelVR, renglones } from './paneles.js';

export const TEXTO_ORBITA = [
  `Una vuelta a la Tierra dura unos ${PERIODO_ORBITA_MIN} minutos. Con la órbita acelerada pasa en ${SEGUNDOS_POR_VUELTA} segundos.`,
  'Mirá el Río de la Plata: el día y la noche pasan por Uruguay. En la ISS hay unos 16 amaneceres por día.',
];

/**
 * @param {{acelerada: boolean, vuelta: number, acelerar: (si: boolean) => void}} orbital
 * @param {{cerrar: () => void}} acciones
 */
export function crearPanelOrbita(orbital, acciones) {
  const W = 900, H = 470;
  return new PanelVR({ ancho: 0.56, alto: 0.56 * H / W, px: W, nombre: 'Orbita_Cupula', dibujar: (ctx, p) => {
    ctx.fillStyle = COLORES.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORES.azul;
    ctx.fillRect(0, 0, W, 76);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Cúpula Faro · órbita', 24, 52);
    ctx.font = '26px sans-serif';
    let y = 122;
    for (const t of TEXTO_ORBITA) { for (const r of renglones(ctx, t, W - 48)) { ctx.fillText(r, 24, y); y += 34; } y += 8; }
    ctx.fillStyle = orbital.acelerada ? COLORES.amarillo : COLORES.gris;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(orbital.acelerada ? `Acelerada ×${FACTOR_ORBITA} · vuelta al ${Math.round(orbital.vuelta * 100)} %` : 'Tiempo real', 24, y + 6);
    p.boton('orbita', 24, H - 104, 520, 84, orbital.acelerada ? 'VOLVER A TIEMPO REAL' : 'ACELERAR ÓRBITA', () => orbital.acelerar(!orbital.acelerada), { estilo: 'aviso' });
    p.boton('cerrar-orbita', 564, H - 104, W - 588, 84, 'CERRAR', () => acciones.cerrar());
  } });
}
