import { duracion, haceCuanto, kilos, nombreNodo, porcentaje, bytes, medidas } from './formato'

describe('formato', () => {
  it('duración legible', () => {
    expect(duracion(null)).toBe('—')
    expect(duracion(42.4)).toBe('42 s')
    expect(duracion(75)).toBe('1 min 15 s')
    expect(duracion(120)).toBe('2 min')
    expect(duracion(3725)).toBe('1 h 2 min')
  })

  it('porcentaje recortado a 0–100', () => {
    expect(porcentaje(0.256)).toBe('26 %')
    expect(porcentaje(1.4)).toBe('100 %')
    expect(porcentaje(-1)).toBe('0 %')
  })

  it('masa, tamaño y medidas', () => {
    expect(kilos(5335)).toMatch(/^5,3 t$/)
    expect(kilos(18)).toBe('18 kg')
    expect(kilos(0.08)).toBe('80 g')
    expect(bytes(34044)).toBe('33,2 KB')
    expect(bytes(undefined)).toBe('—')
    expect(medidas([4, 2.63, 1.33])).toBe('4 × 2,63 × 1,33 m')
    expect(medidas([0.1, 0.1135, 0.1])).toBe('0,1 × 0,114 × 0,1 m')
  })

  it('hace cuánto', () => {
    const t = Date.parse('2026-10-31T14:00:00Z')
    expect(haceCuanto('2026-10-31T13:59:55Z', t)).toBe('recién')
    expect(haceCuanto('2026-10-31T13:59:30Z', t)).toBe('hace 30 s')
    expect(haceCuanto('2026-10-31T13:57:00Z', t)).toBe('hace 3 min')
  })

  it('nombres de nodo', () => {
    expect(nombreNodo('Part_Placa_OBC')).toBe('Placa OBC')
    expect(nombreNodo('Snap_Ranura_EPS')).toBe('Ranura EPS')
    expect(nombreNodo('Part_Rueda.001')).toBe('Rueda')
    expect(nombreNodo(null)).toBe('')
  })
})
