// B25 (Sprint 02): la copia de three.js del recorrido (public/artigas1/vendor) es idéntica a la de npm.
// Si falla después de actualizar three: node scripts/vendorizar-three.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { esServidorLocal } from '../../public/artigas1/js/vista.js'

const vendor = 'public/artigas1/vendor'
const npm = 'node_modules/three'
const recorrer = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? recorrer(join(d, n)) : [join(d, n)]))

describe('B25 · three.js vendorizado', () => {
  it('el núcleo es el mismo archivo que el de npm', () => {
    expect(readFileSync(join(vendor, 'three.module.min.js')).equals(readFileSync(join(npm, 'build/three.module.min.js')))).toBe(true)
  })
  it('cada addon copiado es idéntico al de npm', () => {
    const archivos = recorrer(join(vendor, 'addons'))
    expect(archivos.length).toBeGreaterThan(5)
    for (const f of archivos) {
      const r = relative(join(vendor, 'addons'), f)
      expect(readFileSync(f).equals(readFileSync(join(npm, 'examples/jsm', r))), r).toBe(true)
    }
  })
})

describe('B24 · depuración solo en local', () => {
  it('reconoce el servidor local y no un sitio publicado', () => {
    expect(esServidorLocal({ protocol: 'http:', hostname: 'localhost' })).toBe(true)
    expect(esServidorLocal({ protocol: 'http:', hostname: '127.0.0.1' })).toBe(true)
    expect(esServidorLocal({ protocol: 'file:', hostname: '' })).toBe(true)
    expect(esServidorLocal({ protocol: 'https:', hostname: 'gabrielbengoechea.github.io' })).toBe(false)
    expect(esServidorLocal({ protocol: 'http:', hostname: '192.168.0.10' })).toBe(false)
  })
})
