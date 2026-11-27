// Copia three.js de node_modules a public/artigas1/vendor (Sprint 02, B25). El recorrido se sirve sin bundler y
// necesita su copia; src/artigas1/vendor.test.js verifica que sea idéntica a la versión de package.json.
//   node scripts/vendorizar-three.mjs
import { copyFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const vendor = 'public/artigas1/vendor'
const npm = 'node_modules/three'
copyFileSync(join(npm, 'build/three.module.min.js'), join(vendor, 'three.module.min.js'))
copyFileSync(join(npm, 'LICENSE'), join(vendor, 'LICENSE-three.txt'))
const recorrer = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? recorrer(join(d, n)) : [join(d, n)]))
for (const f of recorrer(join(vendor, 'addons'))) {
  const r = relative(join(vendor, 'addons'), f)
  copyFileSync(join(npm, 'examples/jsm', r), f)
  console.log('OK', r)
}
