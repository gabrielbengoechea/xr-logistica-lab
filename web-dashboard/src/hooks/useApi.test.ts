import { renderHook, waitFor, act } from '@testing-library/react'
import { fetchFalso } from '../test/datos'
import { useApi } from './useApi'

describe('useApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('trae los datos y los vuelve a pedir con reload', async () => {
    const f = fetchFalso({ '/api/v1/health': { status: 'ok' } })
    vi.stubGlobal('fetch', f)
    const { result } = renderHook(() => useApi<{ status: string }>('/api/v1/health'))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toEqual({ status: 'ok' }))
    expect(result.current.error).toBeNull()
    act(() => result.current.reload())
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2))
  })

  it('informa el error del servidor', async () => {
    vi.stubGlobal('fetch', fetchFalso({}, { '/api/v1/x': 500 }))
    const { result } = renderHook(() => useApi('/api/v1/x'))
    await waitFor(() => expect(result.current.error).toBe('Algo salió mal'))
    expect(result.current.loading).toBe(false)
  })

  it('con path null no pide nada', () => {
    const f = fetchFalso({})
    vi.stubGlobal('fetch', f)
    const { result } = renderHook(() => useApi(null))
    expect(result.current.loading).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })
})
