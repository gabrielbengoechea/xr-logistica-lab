// B05, B10 y B27 (Sprint 02): cada actividad tiene objetivo, pasos cortos, porqué, caso terrestre y consejos.
import { describe, expect, it } from 'vitest'
import { CONTENIDO, MAX_PALABRAS_PASO, consejos, contarPalabras, contenido, pasosCortos } from '../../public/artigas1/js/debrief.js'
import { RUTA_SUGERIDA } from '../../public/artigas1/js/misiones.js'

describe('debrief y pasos cortos', () => {
  it('todas las actividades de la ruta tienen contenido completo', () => {
    for (const id of RUTA_SUGERIDA) {
      const c = contenido(id)
      expect(c, id).not.toBeNull()
      for (const k of ['objetivo', 'porQue', 'enTierra', 'siErrores', 'siLento']) expect(c[k], `${id}.${k}`).toMatch(/\S/)
      expect(c.pasos.length, id).toBeGreaterThanOrEqual(3)
    }
  })

  it(`B10: ningún paso pasa de ${MAX_PALABRAS_PASO} palabras`, () => {
    for (const [id, c] of Object.entries(CONTENIDO)) for (const p of c.pasos) expect(contarPalabras(p), `${id}: ${p}`).toBeLessThanOrEqual(MAX_PALABRAS_PASO)
  })

  it('B27: se aclara lo simplificado en balance, EVA, descarga y filtro', () => {
    for (const id of ['balance', 'eva', 'descarga', 'filtro']) expect(contenido(id).ficcion, id).toMatch(/\S/)
  })

  it('el conteo nombra la estantería de este intento', () => {
    expect(pasosCortos({ id: 'inventario', datos: { estante: 'RIV-E3' } })[0]).toContain('RIV-E3')
  })

  it('los consejos dependen del resultado', () => {
    const def = { referencia: 100 }
    expect(consejos({ id: 'recepcion', def, resultado: { completada: true, errores: 2, segundos: 50 } })).toEqual([CONTENIDO.recepcion.siErrores])
    expect(consejos({ id: 'recepcion', def, resultado: { completada: true, errores: 0, segundos: 150 } })).toEqual([CONTENIDO.recepcion.siLento])
    expect(consejos({ id: 'eva', def, resultado: { completada: false, errores: 0, segundos: 50, motivo: 'Se terminó el tiempo' } })[0]).toMatch(/No se completó/)
    expect(consejos({ id: 'recepcion', def, resultado: { completada: true, errores: 0, segundos: 50 } })[0]).toMatch(/cambia/)
    expect(consejos({ id: 'balance', def, resultado: { completada: true, errores: 0, segundos: 50 } })[0]).not.toMatch(/cambia/)
  })
})
