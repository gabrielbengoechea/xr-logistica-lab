/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del backend en producción (en desarrollo el proxy de Vite apunta a :8000). */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
