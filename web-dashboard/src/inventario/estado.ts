import type { ComponentStatus } from '../api/types'
import type { TonoInsignia } from '../components/Insignia'

/** Estado del componente: texto, tono y forma del marcador (la forma también lo distingue, no solo el color). */
export const ESTADO_COMPONENTE: Record<ComponentStatus, { texto: string; tono: TonoInsignia; forma: 'circulo' | 'cuadrado' | 'triangulo' }> = {
  available: { texto: 'Disponible', tono: 'bien', forma: 'circulo' },
  in_use: { texto: 'En uso', tono: 'acento', forma: 'cuadrado' },
  maintenance: { texto: 'En mantenimiento', tono: 'alerta', forma: 'triangulo' },
}
