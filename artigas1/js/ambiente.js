// Ambiente sonoro (Sprint 03, B09). Sintetizado con WebAudio, sin archivos, como los tonos de js/sonido.js.
//
// Adentro, una estación nunca está en silencio: ventiladores y bombas suenan todo el tiempo. Cada módulo tiene
// su firma: más o menos aire (ruido filtrado) y un zumbido de equipos a su frecuencia. Así el oído también dice
// dónde estás. Afuera, en la caminata espacial, el ambiente se apaga y queda solo la respiración en el casco.
//
// Sin voces: las líneas de Control Montevideo necesitan grabación con acento rioplatense (pendiente).
// Volumen: el mismo ajuste de la tablet (Sonido.factor), más bajo que los avisos para no taparlos.

/**
 * Firma de cada lugar. aire: nivel del ruido de ventilación (0 a 1); corte: Hz del filtro (más grave = más
 * apagado); zumbido: Hz del equipo; nivelZumbido: 0 a 1.
 */
export const PERFILES = Object.freeze({
  carguero: { aire: 0.45, corte: 500, zumbido: 48, nivelZumbido: 0.35 },     // bodega: grave y cerrada
  colonia: { aire: 0.65, corte: 900, zumbido: 120, nivelZumbido: 0.25 },     // recepción: portal y consolas
  rivera: { aire: 0.6, corte: 750, zumbido: 100, nivelZumbido: 0.2 },        // depósito
  nodo: { aire: 0.75, corte: 1100, zumbido: 60, nivelZumbido: 0.3 },         // central: más ventilación
  cupula: { aire: 0.25, corte: 600, zumbido: 0, nivelZumbido: 0 },           // observación: casi en calma
  tacuarembo: { aire: 0.7, corte: 1000, zumbido: 180, nivelZumbido: 0.4 },   // taller: soporte vital y equipos
  esclusa: { aire: 0.35, corte: 650, zumbido: 75, nivelZumbido: 0.2 },
});
const POR_DEFECTO = PERFILES.rivera;
/** Proporción del volumen de los avisos que usa el ambiente. */
export const NIVEL_AMBIENTE = 0.35;
/** Respiración en el casco: ciclo de 4 s (inspirar y exhalar). */
export const CICLO_RESPIRACION = 4;

/** Lo que tiene que sonar en este momento (lógica pura, para las pruebas). */
export function objetivoAmbiente(lugar, afuera) {
  if (afuera) return { aire: 0, corte: 600, zumbido: 0, nivelZumbido: 0, respiracion: 1 };
  const p = PERFILES[lugar] || POR_DEFECTO;
  return { ...p, respiracion: 0 };
}

export class Ambiente {
  /** @param {import('./sonido.js').Sonido} sonido  Da el contexto de audio y el volumen. */
  constructor(sonido) {
    this.sonido = sonido;
    this.nodos = null;
    this.objetivo = objetivoAmbiente('', false);
  }

  /** Crea el grafo de audio (una vez, cuando ya hay contexto: lo crea el primer gesto del usuario). */
  _armar() {
    const ctx = this.sonido.ctx;
    if (!ctx || this.nodos) return !!this.nodos;
    try {
      // 2 s de ruido rosado aproximado (filtro de Paul Kellet, versión corta), en bucle
      const largo = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, largo, ctx.sampleRate);
      const d = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < largo; i++) {
        const blanco = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + blanco * 0.0990460;
        b1 = 0.96300 * b1 + blanco * 0.2965164;
        b2 = 0.57000 * b2 + blanco * 1.0526913;
        d[i] = (b0 + b1 + b2 + blanco * 0.1848) * 0.12;
      }
      const maestro = ctx.createGain();
      maestro.gain.value = 0;
      maestro.connect(ctx.destination);
      // ventilación
      const ruido = ctx.createBufferSource();
      ruido.buffer = buffer; ruido.loop = true;
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass'; filtro.frequency.value = 800;
      const aire = ctx.createGain(); aire.gain.value = 0;
      ruido.connect(filtro).connect(aire).connect(maestro);
      // zumbido de equipos
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = 60;
      const zumbido = ctx.createGain(); zumbido.gain.value = 0;
      osc.connect(zumbido).connect(maestro);
      // respiración: el mismo ruido, en banda, con el volumen llevado por un oscilador lento
      const ruidoR = ctx.createBufferSource();
      ruidoR.buffer = buffer; ruidoR.loop = true;
      const banda = ctx.createBiquadFilter();
      banda.type = 'bandpass'; banda.frequency.value = 700; banda.Q.value = 0.8;
      const respiracion = ctx.createGain(); respiracion.gain.value = 0;
      const pulso = ctx.createGain(); pulso.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 1 / CICLO_RESPIRACION;
      const profundidad = ctx.createGain(); profundidad.gain.value = 0.5;
      lfo.connect(profundidad).connect(pulso.gain);
      ruidoR.connect(banda).connect(pulso).connect(respiracion).connect(maestro);
      ruido.start(); osc.start(); ruidoR.start(); lfo.start();
      this.nodos = { maestro, filtro, aire, osc, zumbido, respiracion, pulso };
      return true;
    } catch {
      this.nodos = null;
      return false;
    }
  }

  /**
   * Cada cuadro (es barato: solo cambia valores cuando cambia el lugar o el volumen).
   * @param {string} lugar  Id del módulo actual (js/navegacion.js).
   * @param {boolean} afuera
   */
  actualizar(lugar, afuera) {
    if (!this._armar()) return;
    const ctx = this.sonido.ctx;
    const o = objetivoAmbiente(lugar, afuera);
    const volumen = this.sonido.volumen * Math.max(0, Math.min(1, this.sonido.factor)) * NIVEL_AMBIENTE;
    const clave = `${lugar}|${afuera}|${volumen}`;
    if (clave === this._clave) return;
    this._clave = clave;
    this.objetivo = o;
    const t = ctx.currentTime, n = this.nodos, suave = 0.6;      // ~0,6 s de transición al cambiar de módulo
    n.maestro.gain.setTargetAtTime(volumen, t, 0.2);
    n.aire.gain.setTargetAtTime(o.aire, t, suave);
    n.filtro.frequency.setTargetAtTime(o.corte, t, suave);
    n.zumbido.gain.setTargetAtTime(o.nivelZumbido * 0.5, t, suave);
    if (o.zumbido > 0) n.osc.frequency.setTargetAtTime(o.zumbido, t, suave);
    n.respiracion.gain.setTargetAtTime(o.respiracion * 0.9, t, suave);
    n.pulso.gain.setTargetAtTime(o.respiracion * 0.5, t, suave);
  }
}
