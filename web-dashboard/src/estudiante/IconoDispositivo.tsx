import type { Dispositivo } from './simuladores'

/** Íconos de trazo para el visor, la compu y el celular (decorativos: el texto va siempre al lado). */
export function IconoDispositivo({ tipo, className = 'h-5 w-5' }: { tipo: Dispositivo; className?: string }) {
  const comun = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (tipo === 'quest') {
    return (
      <svg {...comun}>
        <path d="M4 8.5C4 7.1 5.1 6 6.5 6h11C18.9 6 20 7.1 20 8.5v5c0 1.4-1.1 2.5-2.5 2.5h-2.2c-.8 0-1.5-.5-1.8-1.2l-.6-1.4a1 1 0 0 0-1.8 0l-.6 1.4c-.3.7-1 1.2-1.8 1.2H6.5A2.5 2.5 0 0 1 4 13.5z" />
        <path d="M2 10v2M22 10v2" />
      </svg>
    )
  }
  if (tipo === 'compu') {
    return (
      <svg {...comun}>
        <rect x="4" y="5" width="16" height="11" rx="1.5" />
        <path d="M2 19h20" />
      </svg>
    )
  }
  return (
    <svg {...comun}>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M11 18.5h2" />
    </svg>
  )
}
