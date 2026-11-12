import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom no implementa scrollTo (la app vuelve arriba al cambiar de sección).
window.scrollTo = (() => {}) as typeof window.scrollTo
