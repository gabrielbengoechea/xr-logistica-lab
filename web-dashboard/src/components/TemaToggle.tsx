import { useEffect, useState } from 'react'

type Tema = 'sistema' | 'claro' | 'oscuro'
const CLAVE = 'xrlab.tema'

function leer(): Tema {
  try {
    const t = window.localStorage.getItem(CLAVE)
    return t === 'claro' || t === 'oscuro' ? t : 'sistema'
  } catch {
    return 'sistema'
  }
}

/** Claro / oscuro / según el sistema. Se recuerda en este navegador. */
export function TemaToggle() {
  const [tema, setTema] = useState<Tema>(leer)
  useEffect(() => {
    const raiz = document.documentElement
    if (tema === 'sistema') raiz.removeAttribute('data-theme')
    else raiz.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light')
    try {
      window.localStorage.setItem(CLAVE, tema)
    } catch {
      // modo privado: no se recuerda, pero funciona
    }
  }, [tema])
  const siguiente: Record<Tema, Tema> = { sistema: 'claro', claro: 'oscuro', oscuro: 'sistema' }
  const texto: Record<Tema, string> = { sistema: 'Tema: sistema', claro: 'Tema: claro', oscuro: 'Tema: oscuro' }
  return (
    <button
      type="button"
      onClick={() => setTema(siguiente[tema])}
      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-tenue ring-1 ring-borde hover:text-tinta"
      title="Cambiar el tema"
    >
      {texto[tema]}
    </button>
  )
}
