/** Celda de la grilla del visor según el tamaño del modelo: 1 cm para un globo de mesa, 10 m para un buque. */
export function celdaGrilla(tamano: number): { celda: number; seccion: number } {
  const celda = 10 ** Math.floor(Math.log10(Math.max(tamano, 0.01) / 10))
  return { celda, seccion: celda * 10 }
}
