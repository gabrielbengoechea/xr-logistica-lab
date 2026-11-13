// Sonidos de la interfaz, sintetizados con WebAudio (sin archivos). El contexto se crea con el primer gesto
// del usuario, como exigen los navegadores. Todo falla en silencio si no hay audio.
const TONOS = {
  ok: [[1760, 0, 0.07], [2350, 0.08, 0.10]],
  error: [[220, 0, 0.16], [180, 0.17, 0.20]],
  clic: [[1200, 0, 0.03]],
  aviso: [[880, 0, 0.09], [880, 0.16, 0.09]],
  alerta: [[660, 0, 0.14], [520, 0.16, 0.14], [660, 0.32, 0.14]],
  logro: [[1047, 0, 0.09], [1319, 0.10, 0.09], [1568, 0.20, 0.16]],
  esclusa: [[110, 0, 0.9]],
};

export class Sonido {
  constructor() {
    this.ctx = null;
    this.volumen = 0.25;
    /** Último sonido pedido: lo leen las pruebas. */
    this.ultimo = '';
    const activar = () => {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { this.ctx = new AC(); } catch { this.ctx = null; } }
    };
    window.addEventListener('pointerdown', activar, { passive: true });
    window.addEventListener('keydown', activar, { passive: true });
    this.activar = activar;
  }

  /** @param {keyof typeof TONOS} nombre */
  tocar(nombre) {
    this.ultimo = nombre;
    const tonos = TONOS[nombre];
    if (!this.ctx || !tonos) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const t0 = this.ctx.currentTime;
    for (const [frecuencia, inicio, duracion] of tonos) {
      const osc = this.ctx.createOscillator();
      const gan = this.ctx.createGain();
      osc.type = nombre === 'error' || nombre === 'esclusa' ? 'sawtooth' : 'sine';
      osc.frequency.value = frecuencia;
      gan.gain.setValueAtTime(0, t0 + inicio);
      gan.gain.linearRampToValueAtTime(this.volumen, t0 + inicio + 0.008);
      gan.gain.exponentialRampToValueAtTime(0.0008, t0 + inicio + duracion);
      osc.connect(gan).connect(this.ctx.destination);
      osc.start(t0 + inicio);
      osc.stop(t0 + inicio + duracion + 0.02);
    }
  }
}
