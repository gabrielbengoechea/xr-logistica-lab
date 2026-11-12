/**
 * En el sitio publicado en GitHub Pages no hay servidor: el panel en vivo (sesiones, puntajes y lo que pasa en
 * cada visor) necesita el backend del aula. El visor 3D y el inventario sí funcionan.
 */
export function PanelSinServidor() {
  return (
    <section className="mx-auto max-w-2xl rounded-lg border border-borde bg-elevada p-6">
      <h2 className="text-lg font-semibold">El panel en vivo necesita el servidor del aula</h2>
      <p className="mt-2 text-sm leading-relaxed text-tenue">
        Esta es la versión publicada en internet. Para ver quién está practicando, los puntajes y lo que pasa en cada
        visor, abrí el tablero en la compu del aula con <code className="rounded bg-plano px-1">iniciar-xr-lab.bat</code>.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-tenue">Acá podés usar el visor 3D y el inventario.</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <a href="#visor" className="rounded-md bg-acento px-3 py-1.5 font-medium text-acento-tinta">
          Abrir el visor 3D
        </a>
        <a href="#inventario" className="rounded-md px-3 py-1.5 font-medium ring-1 ring-borde hover:bg-plano">
          Ver el inventario
        </a>
      </div>
    </section>
  )
}
