// B02 y B06 (Sprint 01): dos estudiantes en el mismo visor. Cada carga de la página es una sesión: se arma igual
// que en recorrido.js (Telemetria + GestorActividades + SesionEstudiante con el mismo localStorage).
import { describe, expect, it, vi } from 'vitest'
import { ESTADO, GestorActividades } from '../../public/artigas1/js/actividades.js'
import { CLAVES_DEL_VISOR, PASO_SESION, SesionEstudiante, conectarTelemetria, crearPanelSesion } from '../../public/artigas1/js/sesion.js'
import { Telemetria } from '../../public/artigas1/js/telemetria.js'
import { traducirBotonVR } from '../../public/artigas1/js/entrada.js'

function almacen(inicial = {}) {
  const m = new Map(Object.entries(inicial))
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}

function servidor() {
  const posts = []
  const pedir = vi.fn(async (url, op = {}) => {
    if (op.method === 'POST') { posts.push({ url, cuerpo: JSON.parse(op.body) }); return new Response('{}', { status: 201 }) }
    return new Response(JSON.stringify({ status: 'ok', version: '1', models_available: 0, sessions: 0 }), { status: 200 })
  })
  return { pedir, posts, sesiones: () => posts.filter((p) => p.url.endsWith('/telemetry/session')).map((p) => p.cuerpo) }
}

/** Una carga de la página: lo mismo que arma recorrido.js. */
function cargar(st, srv, sugerido = '') {
  const telemetria = new Telemetria({ config: { alumno: 'anonimo', backend: 'http://aula:8000', clave: '' }, pedir: srv.pedir })
  const gestor = new GestorActividades()
  conectarTelemetria(gestor, telemetria)
  gestor.registrar({ id: 'almacenamiento', titulo: 'Almacenamiento', referencia: 60, pasos: () => [{ id: 'a', texto: 'A' }, { id: 'b', texto: 'B' }], alEvento: (a, t, d) => { if (t === 'hecho') a.completarPaso(d.id) } })
  gestor.registrar({ id: 'inventario', titulo: 'Inventario', referencia: 60, pasos: () => [{ id: 'x', texto: 'X' }], alEvento: (a, t, d) => { if (t === 'hecho') a.completarPaso(d.id) } })
  const sesion = new SesionEstudiante({ telemetria, gestor, almacen: st, sugerido })
  return { telemetria, gestor, sesion }
}

const esperar = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)) }
const conCodigo = (sesion, codigo) => { sesion.aceptar(); for (const d of codigo) sesion.teclear(d); return sesion.confirmarCodigo() }

describe('B02 · cambio de estudiante en un visor compartido', () => {
  it('A juega y termina; B empieza de cero, con otro código, otra sesión y la bienvenida de nuevo', async () => {
    const ajustes = JSON.stringify({ version: 3, giro: 'suave', velocidad: 1.25 })
    const st = almacen({ 'artigas1.ajustes': ajustes, 'artigas1.calibracionManos': '3', 'artigas1.backend': 'http://aula:8000', 'artigas1.alumno': 'viejo-7', 'artigas1.bienvenida': '1' })
    const srv = servidor()

    // ---- estudiante A
    const A = cargar(st, srv)
    expect(st.getItem('artigas1.alumno')).toBeNull()                 // lo que dejaba la versión anterior se borra
    expect(st.getItem('artigas1.bienvenida')).toBeNull()
    expect(A.sesion.paso).toBe(PASO_SESION.CONSENTIMIENTO)
    expect(A.sesion.bienvenidaVista).toBe(false)
    expect(conCodigo(A.sesion, '101')).toBe(true)
    A.sesion.bienvenidaVista = true                                   // la vio (lo marca recorrido.js al cerrarla)
    A.gestor.iniciar('almacenamiento')
    A.gestor.evento('hecho', { id: 'a' }); A.gestor.evento('hecho', { id: 'b' })
    expect(A.gestor.obtener('almacenamiento').estado).toBe(ESTADO.COMPLETADA)
    A.gestor.iniciar('inventario')                                    // queda en curso al terminar la sesión
    const finalA = await A.sesion.finalizar()
    await esperar()
    expect(A.sesion.paso).toBe(PASO_SESION.FINALIZADA)
    expect(A.gestor.activa).toBeNull()
    expect(finalA.student_id).toBe('101')
    expect(finalA.ended_at).not.toBeNull()
    expect(finalA.events.filter((e) => e.type === 'activity_end').map((e) => `${e.part} ${e.detail.split(' ')[0]}`)).toEqual(['almacenamiento completada', 'inventario abandonada'])

    // ---- estudiante B (la estación se recarga)
    const B = cargar(st, srv)
    expect(B.sesion.paso).toBe(PASO_SESION.CONSENTIMIENTO)            // se vuelve a pedir la decisión
    expect(B.telemetria.consentimiento).toBeNull()
    expect(B.sesion.bienvenidaVista).toBe(false)                      // nueva bienvenida
    expect(B.sesion.codigo).toBe('')                                  // el código de A no aparece
    expect(conCodigo(B.sesion, '202')).toBe(true)
    B.gestor.iniciar('inventario')
    B.gestor.evento('hecho', { id: 'x' })
    await B.sesion.finalizar()
    await esperar()

    const deA = srv.sesiones().filter((r) => r.student_id === '101')
    const deB = srv.sesiones().filter((r) => r.student_id === '202')
    expect(deA.length).toBeGreaterThan(0)
    expect(deB.length).toBeGreaterThan(0)
    const idsA = new Set(deA.map((r) => r.session_id)), idsB = new Set(deB.map((r) => r.session_id))
    expect(idsA.size).toBe(1); expect(idsB.size).toBe(1)
    expect([...idsA][0]).not.toBe([...idsB][0])
    // nada de A en los informes de B
    const ultimoB = deB.at(-1)
    expect(ultimoB.events.some((e) => e.part === 'almacenamiento')).toBe(false)
    expect(ultimoB.parts_total).toBe(1)
    // cada session_id pertenece a un solo estudiante
    for (const p of srv.posts) expect(p.cuerpo.student_id).toBe(idsA.has(p.cuerpo.session_id) ? '101' : '202')
    // los ajustes del visor siguen ahí
    expect(st.getItem('artigas1.ajustes')).toBe(ajustes)
    expect(st.getItem('artigas1.calibracionManos')).toBe('3')
    expect(st.getItem('artigas1.backend')).toBe('http://aula:8000')
    for (const k of CLAVES_DEL_VISOR) if (k !== 'artigas1.clave') expect(st.m.has(k)).toBe(true)
  })

  it('B anónimo después de A con registro: no se manda nada de B ni se reusa el consentimiento de A', async () => {
    const st = almacen()
    const srv = servidor()
    const A = cargar(st, srv)
    conCodigo(A.sesion, '5')
    await A.sesion.finalizar()
    await esperar()
    const antes = srv.posts.length
    const B = cargar(st, srv)
    expect(B.sesion.anonimo()).toBe(true)
    B.gestor.iniciar('inventario'); B.gestor.evento('hecho', { id: 'x' })
    const informeB = await B.sesion.finalizar()
    await esperar()
    expect(srv.posts.length).toBe(antes)
    expect(informeB.student_id).toBe('anonimo')
    expect(informeB.session_id).not.toBe(A.telemetria.sessionId)
  })

  it('?alumno= solo propone el código: hay que aceptar el registro y confirmarlo', () => {
    const { sesion, telemetria } = cargar(almacen(), servidor(), 'ana-3')
    expect(telemetria.config.alumno).toBe('anonimo')
    sesion.aceptar()
    expect(sesion.codigo).toBe('ana-3')
    sesion.borrar(); sesion.teclear('4')
    sesion.confirmarCodigo()
    expect(telemetria.config.alumno).toBe('ana-4')
  })

  it('el teclado solo acepta dígitos y LISTO no sirve sin código', () => {
    const { sesion } = cargar(almacen(), servidor())
    expect(sesion.teclear('1')).toBe(false)                           // antes de aceptar no hay teclado
    sesion.aceptar()
    expect(sesion.confirmarCodigo()).toBe(false)
    expect(sesion.teclear('a')).toBe(false)
    expect(sesion.teclear('7')).toBe(true)
    expect(sesion.volver()).toBe(true)
    expect(sesion.codigo).toBe('')
    expect(sesion.paso).toBe(PASO_SESION.CONSENTIMIENTO)
  })

  it('el panel de inicio ofrece las dos opciones y el teclado completo', () => {
    // jsdom no dibuja: un contexto 2D que no hace nada y mide 12 px por letra
    const ctx = new Proxy({ measureText: (t) => ({ width: String(t).length * 12 }) }, {
      get: (o, k) => (k in o ? o[k] : () => {}), set: () => true,
    })
    const espia = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx)
    const { sesion } = cargar(almacen(), servidor())
    const panel = crearPanelSesion(sesion)
    const ids = () => { panel.redibujar(); return panel.botones.map((b) => b.id) }
    expect(ids()).toEqual(['aceptar', 'anonimo'])
    panel.botones.find((b) => b.id === 'aceptar').accion()
    const teclado = ids()
    for (const d of '0123456789') expect(teclado).toContain(`tecla:${d}`)
    expect(teclado).toEqual(expect.arrayContaining(['borrar', 'listo', 'volver']))
    espia.mockRestore()
  })
})

describe('B22 · botón de entrada en español', () => {
  it('traduce los textos de VRButton y los sigue traduciendo cuando cambian', async () => {
    const b = document.createElement('button')
    b.textContent = 'VR NOT SUPPORTED'
    traducirBotonVR(b)
    expect(b.textContent).toBe('REALIDAD VIRTUAL NO COMPATIBLE')
    expect(b.title).toMatch(/mouse y el teclado/)
    b.textContent = 'ENTER VR'
    await new Promise((r) => setTimeout(r, 0))
    expect(b.textContent).toBe('ENTRAR EN REALIDAD VIRTUAL')
    b.textContent = 'EXIT VR'
    await new Promise((r) => setTimeout(r, 0))
    expect(b.textContent).toBe('VOLVER AL MODO DE ESCRITORIO')
  })
})
