import { ApiError, getJson, mensajeDeError, wsUrl } from './api'

describe('cliente de la API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('arma el texto de error de FastAPI', () => {
    expect(mensajeDeError(404, { detail: 'No existe la sesión x' })).toBe('No existe la sesión x')
    expect(mensajeDeError(422, { detail: [{ msg: 'campo requerido' }, { msg: 'muy largo' }] })).toBe('campo requerido; muy largo')
    expect(mensajeDeError(500, null)).toBe('Error 500')
  })

  it('getJson devuelve el cuerpo o lanza ApiError con el detalle', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 })))
    await expect(getJson<{ ok: number }>('/api/v1/x')).resolves.toEqual({ ok: 1 })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Falta la clave' }), { status: 401 })))
    await expect(getJson('/api/v1/x')).rejects.toEqual(new ApiError(401, 'Falta la clave'))
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(getJson('/api/v1/x')).rejects.toMatchObject({ status: 0, message: 'Sin conexión con el servidor' })
  })

  it('la URL del WebSocket sigue al protocolo de la página', () => {
    expect(wsUrl('/ws/telemetry', { protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173/ws/telemetry')
    expect(wsUrl('/ws/telemetry', { protocol: 'https:', host: 'lab.utec.edu.uy' })).toBe('wss://lab.utec.edu.uy/ws/telemetry')
  })
})
