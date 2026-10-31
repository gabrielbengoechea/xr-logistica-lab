/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del backend en producción (en desarrollo el proxy de Vite apunta a :8000). */
  readonly VITE_API_BASE?: string
  /** '1' para el sitio estático de GitHub Pages: los datos salen de archivos JSON y no hay telemetría en vivo. */
  readonly VITE_SITIO_ESTATICO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
