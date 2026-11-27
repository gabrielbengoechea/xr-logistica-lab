// Medidor de fps del recorrido, para probar en el Quest sin herramientas aparte.
//
//   - Siempre: cada 10 s escribe en la consola «[Artigas1] fps …» (promedio, el peor segundo y el cuadro más
//     lento). Se lee con el depurador remoto de Chrome (chrome://inspect) con el visor conectado por USB.
//   - Con `?fps` en la dirección (…/artigas1/?fps): un contador chico abajo a la izquierda de la vista, en los
//     dos ojos, que se actualiza cada segundo. Verde desde 70 fps, ámbar desde 55, rojo por debajo.
//
// El objetivo del Quest 2 es 72 fps. OVR Metrics Tool sigue siendo la medida de referencia: este contador mide
// el bucle de la página, no lo que hace el compositor del visor.
import * as THREE from 'three';

export class MedidorFps {
  /** @param {THREE.Camera} camara @param {boolean} visible */
  constructor(camara, visible = false) {
    this.cuadros = 0;
    this.tiempo = 0;
    this.peorCuadro = 0;
    this.fps = 0;
    this.historia = [];                                 // fps de cada segundo de los últimos 10
    this._reloj10 = 0;
    this.panel = null;
    if (!visible) return;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    this._ctx = canvas.getContext('2d');
    this._tex = new THREE.CanvasTexture(canvas);
    this._tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.02), new THREE.MeshBasicMaterial({ map: this._tex, transparent: true, depthTest: false, depthWrite: false }));
    m.name = 'Contador_FPS';
    m.renderOrder = 996;                                // debajo del casco, el túnel y el parpadeo
    m.position.set(-0.11, -0.10, -0.4);                 // abajo a la izquierda, fuera del centro de la vista
    m.frustumCulled = false;
    camara.add(m);
    this.panel = m;
    this._dibujar();
  }

  /** @param {number} dt  Tiempo real del cuadro (sin recortar). */
  cuadro(dt) {
    this.cuadros++;
    this.tiempo += dt;
    this.peorCuadro = Math.max(this.peorCuadro, dt);
    if (this.tiempo < 1) return;
    this.fps = this.cuadros / this.tiempo;
    this.historia.push(this.fps);
    if (this.historia.length > 10) this.historia.shift();
    this._reloj10 += this.tiempo;
    if (this._reloj10 >= 10) {
      this._reloj10 = 0;
      const prom = this.historia.reduce((a, b) => a + b, 0) / this.historia.length;
      console.info(`[Artigas1] fps ${prom.toFixed(1)} · peor segundo ${Math.min(...this.historia).toFixed(1)} · cuadro más lento ${(this.peorCuadro * 1000).toFixed(1)} ms`);
      this.peorCuadro = 0;
    }
    this.cuadros = 0;
    this.tiempo = 0;
    this._dibujar();
  }

  _dibujar() {
    if (!this.panel) return;
    const c = this._ctx;
    c.clearRect(0, 0, 256, 64);
    c.fillStyle = 'rgba(0, 0, 0, 0.6)';
    c.fillRect(0, 0, 256, 64);
    c.fillStyle = this.fps >= 70 ? '#3ecf6e' : this.fps >= 55 ? '#fcd116' : '#ff6b5e';
    c.font = 'bold 40px monospace';
    c.fillText(`${Math.round(this.fps)} fps`, 14, 46);
    this._tex.needsUpdate = true;
  }
}
