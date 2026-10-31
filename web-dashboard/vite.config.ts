/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo, /api, /ws y /models van al backend (uvicorn en :8000). XRLAB_BACKEND cambia el destino.
const backend = process.env.XRLAB_BACKEND ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/models': backend,
      '/ws': { target: backend.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // React aparte: si no, Rollup lo mete en el paquete de three y el panel esperaría 1 MB que no usa.
        manualChunks(id: string) {
          // ayudantes de Vite/Rollup compartidos: con React (que siempre se carga), no con three
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'react'
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (/[\\/]node_modules[\\/](three|@react-three|three-stdlib|troika|camera-controls|maath|meshline|zustand|its-fine|suspend-react)/.test(id)) return 'three'
          return undefined
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
