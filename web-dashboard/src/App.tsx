import { useEffect, useState } from 'react'
import { Pestanas } from './components/Pestanas'
import { TemaToggle } from './components/TemaToggle'
import { Portal } from './estudiante/Portal'
import { SITIO_ESTATICO } from './lib/api'
import { PanelSinServidor } from './panel/PanelSinServidor'
import { Inventario } from './inventario/Inventario'
import { PanelDocente } from './panel/PanelDocente'
import { Visor } from './viewer/Visor'

type Vista = 'inicio' | 'panel' | 'visor' | 'inventario'

const PESTANAS: { id: Exclude<Vista, 'inicio'>; texto: string }[] = [
  { id: 'panel', texto: 'Panel docente' },
  { id: 'visor', texto: 'Visor 3D' },
  { id: 'inventario', texto: 'Inventario' },
]

/** Sin hash se abre la portada de estudiantes; #panel, #visor e #inventario son el tablero del docente. */
function vistaDelHash(): Vista {
  const h = window.location.hash.replace('#', '')
  return h === 'panel' || h === 'visor' || h === 'inventario' ? h : 'inicio'
}

export default function App() {
  const [vista, setVista] = useState<Vista>(vistaDelHash)
  useEffect(() => {
    const alCambiarHash = () => {
      setVista(vistaDelHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', alCambiarHash)
    return () => window.removeEventListener('hashchange', alCambiarHash)
  }, [])
  const cambiar = (v: Vista) => {
    setVista(v)
    window.history.replaceState(null, '', `#${v}`)
  }
  if (vista === 'inicio') return <Portal />
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-borde bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}icono.svg`} alt="" className="h-8 w-8" />
            <div>
              <h1 className="text-base font-semibold leading-tight">XR Logística Lab</h1>
              <p className="text-xs text-tenue">
                Tablero del docente ·{' '}
                <a href="#" className="underline underline-offset-2 hover:text-tinta">
                  ver la portada de estudiantes
                </a>
              </p>
            </div>
          </div>
          <Pestanas pestanas={PESTANAS} activa={vista} alCambiar={cambiar} etiqueta="Secciones del tablero" />
          <TemaToggle />
        </div>
      </header>
      <main id={`panel-${vista}`} role="tabpanel" aria-labelledby={`pestana-${vista}`} className="mx-auto w-full max-w-[110rem] flex-1 px-4 py-5">
        {/* El panel queda montado aunque se mire otra pestaña: así no se pierde el feed en vivo ni la conexión. */}
        <div hidden={vista !== 'panel'}>
          {SITIO_ESTATICO ? <PanelSinServidor /> : <PanelDocente />}
        </div>
        {vista === 'visor' && <Visor />}
        {vista === 'inventario' && <Inventario />}
      </main>
    </div>
  )
}
