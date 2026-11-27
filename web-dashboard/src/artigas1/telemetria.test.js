// B06 y B26 (Sprint 01): la telemetría del recorrido web solo manda datos con consentimiento, y solo a un
// backend que existe. El contrato SessionReport no cambia.
import { describe, expect, it, vi } from 'vitest'
import { BACKEND, ESCENARIO_WEB, RUTA_SALUD, Telemetria, leerConfig } from '../../public/artigas1/js/telemetria.js'

const BACK = 'http://aula.local:8000'

/** fetch falso: el backend contesta salud ok y 201 a los POST. `modo` cambia cómo responde. */
function servidor(modo = 'backend') {
  const pedidos = []
  const pedir = vi.fn(async (url, op = {}) => {
    pedidos.push({ url, metodo: op.method || 'GET', cuerpo: op.body ? JSON.parse(op.body) : null, cabeceras: op.headers || {} })
    if (modo === 'caido') throw new TypeError('Failed to fetch')
    if (modo === 'estatico') return new Response('<html>no</html>', { status: op.method === 'POST' ? 501 : 404, headers: { 'Content-Type': 'text/html' } })
    if (modo === 'spa') return new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } })
    if (String(url).endsWith(RUTA_SALUD)) return new Response(JSON.stringify({ status: 'ok', version: '1', models_available: 0, sessions: 0 }), { status: 200 })
    return new Response('{}', { status: 201 })
  })
  return { pedir, pedidos, posts: () => pedidos.filter((p) => p.metodo === 'POST') }
}

const nueva = (s, extra = {}) => {
  let t = 0
  const tl = new Telemetria({ config: { alumno: 'anonimo', backend: BACK, clave: 'secreta', ...extra }, ahora: () => t, pedir: s.pedir })
  tl.avanzarReloj = (dt) => { t += dt }
  return tl
}
const esperar = () => new Promise((r) => setTimeout(r, 0))

/** Campos y reglas de backend/app/schemas.py → SessionReport (extra="forbid"). */
function cumpleContrato(r) {
  const campos = ['session_id', 'student_id', 'scenario', 'device', 'interaction', 'started_at', 'ended_at', 'parts_total', 'parts_placed', 'assembly_errors', 'hints_used', 'events']
  expect(Object.keys(r).sort()).toEqual([...campos].sort())
  expect(r.session_id).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  expect(r.student_id.length).toBeGreaterThanOrEqual(1)
  expect(r.student_id.length).toBeLessThanOrEqual(64)
  expect(r.scenario).toBe(ESCENARIO_WEB)
  expect(['quest2', 'quest3', 'web']).toContain(r.device)
  expect(r.parts_placed).toBeLessThanOrEqual(r.parts_total)
  const ts = r.events.map((e) => e.t)
  expect(ts).toEqual([...ts].sort((a, b) => a - b))
}

describe('B06 · consentimiento', () => {
  it('sin decisión no hace ningún pedido, ni siquiera la prueba del backend', async () => {
    const s = servidor()
    const tl = nueva(s)
    tl.registrar('scan', 'B1')
    await tl.enviar(false)
    tl.avanzarReloj(40); tl.actualizar(40)
    await tl.finalizar()
    await esperar()
    expect(s.pedir).not.toHaveBeenCalled()
    expect(tl.omitidos).toBeGreaterThan(0)
  })

  it('en modo anónimo no hay POST y la sesión se sigue contando en memoria', async () => {
    const s = servidor()
    const tl = nueva(s)
    tl.anonimo()
    tl.registrar('activity_start', 'almacenamiento')
    tl.cerrarActividad(3, 3, 1)
    await tl.enviar(true)
    expect(s.posts()).toHaveLength(0)
    expect(s.pedir).not.toHaveBeenCalled()
    expect(tl.informe().student_id).toBe('anonimo')
    expect(tl.informe().parts_placed).toBe(3)
  })

  it('con aceptación manda con el código del estudiante y respeta el contrato SessionReport', async () => {
    const s = servidor()
    const tl = nueva(s)
    expect(tl.aceptar('  12 ')).toBe(true)
    tl.registrar('hint', 'p', null, 'en vivo')
    tl.progreso(4, 2, 1)
    await esperar(); await esperar()
    await tl.enviar(true)
    const urls = s.pedidos.map((p) => `${p.metodo} ${p.url}`)
    expect(urls[0]).toBe(`GET ${BACK}${RUTA_SALUD}`)
    const sesion = s.posts().find((p) => p.url.endsWith('/api/v1/telemetry/session'))
    const vivo = s.posts().find((p) => p.url.endsWith('/api/v1/telemetry/event'))
    expect(vivo.cuerpo.student_id).toBe('12')
    expect(sesion.cuerpo.student_id).toBe('12')
    expect(sesion.cabeceras['X-API-Key']).toBe('secreta')
    expect(sesion.cuerpo.events.at(-1).type).toBe('session_end')
    cumpleContrato(sesion.cuerpo)
    // el GET de salud no lleva datos del estudiante
    expect(s.pedidos[0].cuerpo).toBeNull()
  })

  it('no acepta un código vacío', () => {
    const tl = nueva(servidor())
    expect(tl.aceptar('   ')).toBe(false)
    expect(tl.consentimiento).toBeNull()
  })

  it('el consentimiento no pasa a otra sesión: cada Telemetria empieza sin decidir', () => {
    const a = nueva(servidor())
    a.aceptar('12')
    const b = nueva(servidor())
    expect(b.consentimiento).toBeNull()
    expect(b.config.alumno).toBe('anonimo')
    expect(b.sessionId).not.toBe(a.sessionId)
  })
})

describe('B26 · servidores estáticos', () => {
  it('sitio estático (404 en salud): ningún POST y la telemetría queda apagada', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const s = servidor('estatico')
    const tl = nueva(s)
    tl.aceptar('12')
    tl.registrar('scan', 'B1')
    await tl.enviar(false)
    await tl.enviar(true)
    expect(s.posts()).toHaveLength(0)
    expect(s.pedidos.filter((p) => p.url.endsWith(RUTA_SALUD))).toHaveLength(1)    // se prueba una sola vez
    expect(tl.estadoBackend).toBe(BACKEND.AUSENTE)
    expect(tl.activa).toBe(false)
    expect(info).toHaveBeenCalledTimes(1)
    info.mockRestore()
  })

  it('servidor que contesta 200 con HTML a todo (SPA): tampoco se toma como backend', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const s = servidor('spa')
    const tl = nueva(s)
    tl.aceptar('12')
    await tl.enviar(false)
    expect(s.posts()).toHaveLength(0)
    expect(tl.estadoBackend).toBe(BACKEND.AUSENTE)
    info.mockRestore()
  })

  it('backend caído (error de red) se distingue de no tener backend y se vuelve a probar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = servidor('caido')
    const tl = nueva(s)
    tl.aceptar('12')
    await tl.enviar(false)
    expect(tl.estadoBackend).toBe(BACKEND.SIN_CONEXION)
    await tl.enviar(false)                                   // antes de los 30 s no se reintenta
    expect(s.pedidos).toHaveLength(1)
    tl.avanzarReloj(31)
    await tl.enviar(false)
    expect(s.pedidos).toHaveLength(2)
    expect(s.posts()).toHaveLength(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('GitHub Pages y file:// no tienen backend: ni se prueba', () => {
    const almacen = new Map()
    const st = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v) }
    expect(leerConfig({ search: '', hostname: 'gabrielbengoechea.github.io', protocol: 'https:', origin: 'https://gabrielbengoechea.github.io' }, st).backend).toBeNull()
    expect(leerConfig({ search: '', hostname: '', protocol: 'file:', origin: 'null' }, st).backend).toBeNull()
    const local = leerConfig({ search: '', hostname: 'localhost', protocol: 'http:', origin: 'http://localhost:8765' }, st)
    expect(local.backend).toBe('http://localhost:8765')
    const tl = new Telemetria({ config: leerConfig({ search: '', hostname: 'x.github.io', protocol: 'https:', origin: 'https://x.github.io' }, st) })
    tl.aceptar('12')
    expect(tl.estadoBackend).toBe(BACKEND.NINGUNO)
    expect(tl.activa).toBe(false)
  })

  it('?alumno= solo sugiere el código: no se guarda en el navegador (B02)', () => {
    const almacen = new Map()
    const st = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v) }
    const c = leerConfig({ search: '?alumno=ana-3&backend=http://10.0.0.5:8000/', hostname: 'localhost', protocol: 'http:', origin: 'http://localhost' }, st)
    expect(c.alumnoSugerido).toBe('ana-3')
    expect(c.alumno).toBe('anonimo')
    expect(c.backend).toBe('http://10.0.0.5:8000')
    expect(almacen.has('artigas1.alumno')).toBe(false)
    expect(almacen.get('artigas1.backend')).toBe('http://10.0.0.5:8000/')
  })
})
