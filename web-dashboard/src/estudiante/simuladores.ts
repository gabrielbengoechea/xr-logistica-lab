/**
 * Simuladores que ve el estudiante en la portada. Todos son aplicaciones WebXR publicadas en GitHub Pages:
 * se abren en el navegador del Meta Quest, de la compu o del celular, sin instalar nada.
 */

export type Dispositivo = 'quest' | 'compu' | 'celular'

/** Área temática: decide el color de la puerta del contenedor en la tarjeta. */
export type Area = 'puerto' | 'deposito' | 'taller' | 'geografia'

export interface Simulador {
  id: string
  nombre: string
  descripcion: string
  url: string
  area: Area
  dispositivos: Dispositivo[]
  /** Imagen del modelo principal, renderizada con fondo transparente (public/simuladores). */
  imagen: string
}

export interface GrupoSimuladores {
  id: string
  titulo: string
  explicacion: string
  simuladores: Simulador[]
}

const PILOTOS = 'https://gabrielbengoechea.github.io/quest-xr-pilotos'

export const NOMBRE_AREA: Record<Area, string> = {
  puerto: 'Puerto',
  deposito: 'Depósito',
  taller: 'Taller',
  geografia: 'Geografía',
}

export const NOMBRE_DISPOSITIVO: Record<Dispositivo, string> = {
  quest: 'Visor Quest',
  compu: 'Compu',
  celular: 'Celular',
}

export const GRUPOS: GrupoSimuladores[] = [
  {
    id: 'recorrer',
    titulo: 'Recorrer un lugar',
    explicacion: 'Caminás por una terminal o un depósito y tocás cada cosa para saber qué es.',
    simuladores: [
      {
        id: 'logistica-3d',
        nombre: 'Terminal de Montevideo',
        descripcion: 'La terminal de contenedores en su lugar real, con buques, grúas pórtico y el patio funcionando.',
        url: 'https://gabrielbengoechea.github.io/logistica3d/',
        area: 'puerto',
        dispositivos: ['quest', 'compu'],
        imagen: '/simuladores/logistica-3d.webp',
      },
      {
        id: 'centro-logistico',
        nombre: 'Centro logístico',
        descripcion: 'Una nave de distribución sobre la Ruta 5, con estanterías, andenes y autoelevadores. Cada pallet tiene su ficha de inventario.',
        url: 'https://gabrielbengoechea.github.io/logi/',
        area: 'deposito',
        dispositivos: ['quest', 'compu'],
        imagen: '/simuladores/centro-logistico.webp',
      },
      {
        id: 'estiba',
        nombre: 'Estiba',
        descripcion: 'Una terminal con muelle, buque, grúas y tren. En el patio de práctica apilás contenedores como se traban de verdad.',
        url: 'https://gabrielbengoechea.github.io/Estiba-VR/',
        area: 'puerto',
        dispositivos: ['quest', 'compu', 'celular'],
        imagen: '/simuladores/estiba.webp',
      },
    ],
  },
  {
    id: 'practicar',
    titulo: 'Practicar una tarea',
    explicacion: 'Manejás una máquina paso a paso, con controles parecidos a los reales.',
    simuladores: [
      {
        id: 'autoelevador',
        nombre: 'Autoelevador',
        descripcion: 'Manejá un autoelevador en un depósito: slalom, pallets, estanterías a 1,50 y 3 m y despacho al muelle.',
        url: `${PILOTOS}/autoelevador/`,
        area: 'deposito',
        dispositivos: ['quest', 'compu', 'celular'],
        imagen: '/simuladores/autoelevador.webp',
      },
      {
        id: 'robot',
        nombre: 'Brazo robótico',
        descripcion: 'Mové cada articulación de un brazo industrial de 6 ejes a escala real y mirá cómo toma y deja una pieza.',
        url: `${PILOTOS}/robot-6-ejes/`,
        area: 'taller',
        dispositivos: ['quest', 'compu', 'celular'],
        imagen: '/simuladores/robot.webp',
      },
    ],
  },
  {
    id: 'mesa',
    titulo: 'Explorar sobre la mesa',
    explicacion: 'El modelo aparece sobre tu mesa: lo girás, lo desarmás y lo mirás de cerca.',
    simuladores: [
      {
        id: 'atlas',
        nombre: 'Atlas portuario',
        descripcion: 'Un globo con 30 puertos, 8 pasos estratégicos y 12 rutas marítimas, con vistas 360° de cada puerto.',
        url: `${PILOTOS}/atlas.html`,
        area: 'geografia',
        dispositivos: ['quest', 'compu', 'celular'],
        imagen: '/simuladores/atlas.webp',
      },
      {
        id: 'motor-turbofan',
        nombre: 'Motor de avión',
        descripcion: 'Desarmá un motor turbofán en 5 niveles y conocé para qué sirve cada pieza.',
        url: `${PILOTOS}/motor-jet/`,
        area: 'taller',
        dispositivos: ['quest', 'compu'],
        imagen: '/simuladores/motor-turbofan.webp',
      },
      {
        id: 'ra-mesa',
        nombre: 'Realidad aumentada',
        descripcion: 'Con el celular, apoyá el brazo robótico o el globo sobre tu mesa, como en la app Medición.',
        url: `${PILOTOS}/ar-mesa/`,
        area: 'geografia',
        dispositivos: ['quest', 'celular'],
        imagen: '/simuladores/ra-mesa.webp',
      },
    ],
  },
]
