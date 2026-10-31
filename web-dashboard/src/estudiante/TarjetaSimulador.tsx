import { IconoDispositivo } from './IconoDispositivo'
import { NOMBRE_AREA, NOMBRE_DISPOSITIVO, type Simulador } from './simuladores'

/**
 * Tarjeta de un simulador: arriba, la puerta de un contenedor pintada con el color del área y el modelo
 * apoyado adelante; abajo, qué es, dónde funciona y el botón para entrar. Toda la tarjeta es el enlace.
 */
export function TarjetaSimulador({ simulador }: { simulador: Simulador }) {
  const { id, nombre, descripcion, url, area, dispositivos, imagen } = simulador
  return (
    <a
      href={url}
      aria-labelledby={`sim-${id}`}
      aria-describedby={`sim-${id}-desc`}
      className="tarjeta-simulador group flex flex-col overflow-hidden rounded-[0.35rem] bg-elevada shadow-[0_1px_0_rgb(var(--tinta)/0.06),0_10px_24px_-14px_rgb(var(--tinta)/0.35)] ring-1 ring-tinta/10 transition-shadow focus-visible:outline-offset-4"
    >
      <div className={`puerta-contenedor area-${area} relative aspect-[16/10]`}>
        <span className="absolute left-4 top-3 font-rotulo text-lg font-semibold tracking-wide text-white/90">
          {NOMBRE_AREA[area]}
        </span>
        <img
          src={`${import.meta.env.BASE_URL}${imagen}`}
          alt=""
          loading="lazy"
          className="absolute bottom-[7%] left-[5%] h-[76%] w-[68%] object-contain drop-shadow-[0_12px_10px_rgb(0_0_0/0.35)] transition-transform duration-300 ease-out group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4">
        <h3 id={`sim-${id}`} className="font-rotulo text-[1.75rem] font-bold leading-none text-tinta">{nombre}</h3>
        <p id={`sim-${id}-desc`} className="font-lectura text-[0.98rem] leading-relaxed text-tenue">{descripcion}</p>
        <div className="mt-auto flex flex-col items-start gap-4 pt-1">
          <ul className="flex flex-wrap gap-x-3 gap-y-1 font-lectura text-sm text-tenue" aria-label="Funciona en">
            {dispositivos.map((d) => (
              <li key={d} className="flex items-center gap-1.5">
                <IconoDispositivo tipo={d} className="h-[1.1rem] w-[1.1rem]" />
                {NOMBRE_DISPOSITIVO[d]}
              </li>
            ))}
          </ul>
          <span className={`boton-entrar area-${area} rounded-full px-5 py-2 font-rotulo text-lg font-semibold leading-none text-white`}>
            Entrar
          </span>
        </div>
      </div>
    </a>
  )
}
