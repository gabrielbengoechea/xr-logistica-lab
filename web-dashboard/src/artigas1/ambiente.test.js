// B09 (Sprint 03): ambiente sonoro por módulo y respiración en la caminata espacial.
import { describe, expect, it } from 'vitest'
import { PERFILES, objetivoAmbiente } from '../../public/artigas1/js/ambiente.js'
import { LUGARES } from '../../public/artigas1/js/navegacion.js'

describe('B09 · ambiente', () => {
  it('cada lugar de la estación tiene su firma y no hay dos iguales', () => {
    for (const l of LUGARES.filter((x) => x.zona !== 'exterior')) expect(PERFILES[l.id], l.id).toBeDefined()   // afuera suena la EVA
    const firmas = Object.values(PERFILES).map((p) => `${p.aire}|${p.corte}|${p.zumbido}`)
    expect(new Set(firmas).size).toBe(firmas.length)
  })
  it('adentro suena el módulo; afuera, solo la respiración', () => {
    expect(objetivoAmbiente('tacuarembo', false)).toMatchObject({ ...PERFILES.tacuarembo, respiracion: 0 })
    expect(objetivoAmbiente('tacuarembo', true)).toMatchObject({ aire: 0, nivelZumbido: 0, respiracion: 1 })
    expect(objetivoAmbiente('desconocido', false).aire).toBeGreaterThan(0)
  })
})
