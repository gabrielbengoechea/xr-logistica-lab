import { useState } from 'react'
import { IconoDispositivo } from './IconoDispositivo'
import { GRUPOS, NOMBRE_DISPOSITIVO, type Dispositivo } from './simuladores'
import { TarjetaSimulador } from './TarjetaSimulador'

const FILTROS: { id: Dispositivo | 'todos'; texto: string }[] = [
  { id: 'todos', texto: 'Cualquiera' },
  { id: 'quest', texto: NOMBRE_DISPOSITIVO.quest },
  { id: 'compu', texto: NOMBRE_DISPOSITIVO.compu },
  { id: 'celular', texto: NOMBRE_DISPOSITIVO.celular },
]

/** Portada para estudiantes: elegir un simulador y entrar. El tablero del docente queda en «Soy docente». */
export function Portal() {
  const [con, setCon] = useState<Dispositivo | 'todos'>('todos')
  const grupos = GRUPOS.map((g) => ({
    ...g,
    simuladores: g.simuladores.filter((s) => con === 'todos' || s.dispositivos.includes(con)),
  })).filter((g) => g.simuladores.length > 0)

  return (
    <div className="portal min-h-full bg-niebla font-lectura text-tinta">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <img src="/icono.svg" alt="" className="h-8 w-8" />
          <span className="font-rotulo text-xl font-semibold leading-none">XR Logística Lab</span>
        </div>
        <a href="#panel" className="rounded-full px-3 py-1.5 text-sm text-tenue underline-offset-4 hover:text-tinta hover:underline">
          Soy docente
        </a>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="pb-8 pt-12 sm:pt-16">
          <h1 className="max-w-3xl font-rotulo text-[clamp(2.75rem,8vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.01em]">
            Elegí a qué simulador entrar
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-tenue">
            Se abren en el navegador del visor Meta Quest, de la compu o del celular. No hay que instalar nada.
          </p>

          <fieldset className="mt-8">
            <legend className="mb-2.5 text-sm font-bold text-tinta">¿Con qué vas a entrar?</legend>
            <div className="flex flex-wrap gap-2">
              {FILTROS.map((f) => {
                const activo = con === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setCon(f.id)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[0.95rem] transition-colors ${
                      activo ? 'border-tinta bg-tinta text-plano' : 'border-tinta/20 bg-elevada text-tinta hover:border-tinta/50'
                    }`}
                  >
                    {f.id !== 'todos' && <IconoDispositivo tipo={f.id} className="h-[1.15rem] w-[1.15rem]" />}
                    {f.texto}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </section>

        <div className="grid gap-14">
          {grupos.map((g) => (
            <section key={g.id} aria-labelledby={`grupo-${g.id}`}>
              <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b-2 border-tinta pb-2">
                <h2 id={`grupo-${g.id}`} className="font-rotulo text-3xl font-bold leading-none">
                  {g.titulo}
                </h2>
                <p className="text-[0.98rem] text-tenue">{g.explicacion}</p>
              </div>
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {g.simuladores.map((s) => (
                  <li key={s.id} className="flex">
                    <TarjetaSimulador simulador={s} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-tinta/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-tenue sm:px-6">
          <span>UTEC · Laboratorio de realidad mixta</span>
          <a href="#visor" className="underline underline-offset-4 hover:text-tinta">
            Ver los modelos 3D pieza por pieza
          </a>
        </div>
      </footer>
    </div>
  )
}
