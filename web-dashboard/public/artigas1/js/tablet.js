// Tablet logística. Se toma con una mano y se usa con la otra: tocando la pantalla con el índice o apuntando
// con el rayo. Pantallas: inventario, órdenes de trabajo (las actividades), módulos y ajustes.
import { COLORES, PanelVR, rectRedondo, renglones } from './paneles.js';
import { ESTADO, ETIQUETA_ESTADO, formatoTiempo } from './actividades.js';
import { LUGARES } from './navegacion.js';

const W = 960;
const H = 640;
const POR_PAGINA = 7;

export class TabletLogistica {
  /**
   * @param {object} o
   * @param {THREE.Mesh} o.pantalla   Pantalla de la tablet (js/herramientas.js).
   * @param {import('./inventario.js').Inventario} o.inventario
   * @param {import('./actividades.js').GestorActividades} o.gestor
   * @param {import('./navegacion.js').Navegacion} o.navegacion
   * @param {object} o.ajustes        Ajustes de locomoción (los cambia la pantalla de ajustes).
   * @param {{iniciar: Function, pausar: Function, reanudar: Function, abandonar: Function, guiar: Function, abrirMapa: Function,
   *          ajuste: (clave: string, valor: any) => void, calibrarManos: () => number, reunir: () => void,
   *          siguienteTunel: () => string}} o.acciones
   */
  constructor({ pantalla, inventario, gestor, navegacion, ajustes, acciones }) {
    this.inventario = inventario;
    this.gestor = gestor;
    this.navegacion = navegacion;
    this.ajustes = ajustes;
    this.acciones = acciones;
    this.pagina = 'inicio';
    this.hoja = 0;
    this.ultimoCodigo = '';
    this._reloj = 0;
    this.panel = new PanelVR({ ancho: 0.240, alto: 0.160, px: W, malla: pantalla, nombre: 'Pantalla_Tablet', dibujar: (ctx, p) => this._dibujar(ctx, p) });
  }

  ir(pagina) {
    this.pagina = pagina;
    this.hoja = 0;
    this.panel.sucio = true;
  }

  /** La pistola avisó una lectura: el inventario la resalta. */
  lectura(codigo) {
    this.ultimoCodigo = codigo;
    this.panel.sucio = true;
  }

  actualizar(dt) {
    this._reloj += dt;
    if (this._reloj > 0.5) { this._reloj = 0; this.panel.sucio = true; }
  }

  _cabecera(ctx, panel, titulo) {
    ctx.fillStyle = COLORES.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORES.azul;
    ctx.fillRect(0, 0, W, 76);
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(titulo, this.pagina === 'inicio' ? 24 : 168, 51);
    if (this.pagina !== 'inicio') panel.boton('volver', 12, 10, 140, 56, '◀ MENÚ', () => this.ir('inicio'));
    const a = this.gestor.activa;
    if (a) {
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORES.amarillo;
      ctx.fillText(`${a.estado === ESTADO.PAUSADA ? 'PAUSA' : formatoTiempo(a.tiempo)} · ${a.hechos}/${a.pasos.length}`, W - 20, 49);
      ctx.textAlign = 'left';
    }
  }

  _dibujar(ctx, panel) {
    if (this.pagina === 'inventario') return this._inventario(ctx, panel);
    if (this.pagina === 'ordenes') return this._ordenes(ctx, panel);
    if (this.pagina === 'modulos') return this._modulos(ctx, panel);
    if (this.pagina === 'ajustes') return this._ajustes(ctx, panel);
    this._cabecera(ctx, panel, 'ARTIGAS-1 · TABLET LOGÍSTICA');
    const opciones = [['inventario', 'INVENTARIO', 'Bultos, contenedores y ubicaciones'], ['ordenes', 'ÓRDENES DE TRABAJO', 'Actividades: iniciar, pausar, resultados'],
      ['modulos', 'MÓDULOS', 'Qué hay en cada uno y cómo llegar'], ['ajustes', 'AJUSTES', 'Movimiento, giro y manos']];
    opciones.forEach(([id, titulo, sub], i) => {
      const x = 24 + (i % 2) * 462;
      const y = 100 + Math.floor(i / 2) * 176;
      panel.boton(`ir:${id}`, x, y, 450, 110, titulo, () => this.ir(id));
      ctx.fillStyle = COLORES.gris;
      ctx.font = '22px sans-serif';
      ctx.fillText(sub, x + 8, y + 142);
    });
    const a = this.gestor.activa;
    ctx.fillStyle = COLORES.panel;
    rectRedondo(ctx, 24, 462, W - 48, 158, 14);
    ctx.fill();
    ctx.fillStyle = COLORES.blanco;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(a ? a.def.titulo : 'Sin actividad en curso', 44, 502);
    ctx.font = '23px sans-serif';
    ctx.fillStyle = a ? COLORES.amarillo : COLORES.gris;
    const texto = a ? (a.pasoActual ? `Ahora: ${a.pasoActual.texto}` : '') : 'Abrí ÓRDENES DE TRABAJO para empezar una. El mapa se abre con el gatillo izquierdo.';
    renglones(ctx, texto, W - 96).slice(0, 2).forEach((r, i) => ctx.fillText(r, 44, 540 + i * 30));
    if (a && a.ultimoAviso) { ctx.fillStyle = COLORES.celeste; ctx.fillText(a.ultimoAviso.slice(0, 70), 44, 606); }
    return undefined;
  }

  _inventario(ctx, panel) {
    this._cabecera(ctx, panel, 'INVENTARIO');
    const filas = this.inventario.listado();
    const hojas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
    this.hoja = Math.min(this.hoja, hojas - 1);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = COLORES.celeste;
    ctx.fillText('CÓDIGO', 28, 112);
    ctx.fillText('DESCRIPCIÓN', 220, 112);
    ctx.fillText('UBICACIÓN', 640, 112);
    ctx.fillText('LEÍDO', 860, 112);
    filas.slice(this.hoja * POR_PAGINA, (this.hoja + 1) * POR_PAGINA).forEach((f, i) => {
      const y = 126 + i * 58;
      ctx.fillStyle = f.codigo === this.ultimoCodigo ? '#24406e' : i % 2 ? COLORES.panel : '#141e2c';
      ctx.fillRect(16, y, W - 32, 54);
      ctx.fillStyle = COLORES.blanco;
      ctx.font = 'bold 24px monospace';
      ctx.fillText(f.codigo, 28, y + 35);
      ctx.font = '22px sans-serif';
      ctx.fillText(f.descripcion.slice(0, 30), 220, y + 35);
      ctx.font = '22px monospace';
      ctx.fillStyle = f.ubicacion === 'EN TRÁNSITO' ? COLORES.amarillo : COLORES.blanco;
      ctx.fillText(f.ubicacion, 640, y + 35);
      ctx.fillStyle = f.escaneado ? COLORES.verde : COLORES.apagado;
      ctx.fillText(f.escaneado ? '✔' : '—', 880, y + 35);
    });
    const leidos = filas.filter((f) => f.escaneado).length;
    ctx.fillStyle = COLORES.gris;
    ctx.font = '22px sans-serif';
    ctx.fillText(`${filas.length} ítems · ${leidos} leídos · hoja ${this.hoja + 1} de ${hojas}`, 28, 598);
    panel.boton('antes', 560, 556, 180, 66, '◀ ANTERIOR', () => { this.hoja--; this.panel.sucio = true; }, { activo: this.hoja > 0 });
    panel.boton('despues', 756, 556, 180, 66, 'SIGUIENTE ▶', () => { this.hoja++; this.panel.sucio = true; }, { activo: this.hoja < hojas - 1 });
  }

  _ordenes(ctx, panel) {
    this._cabecera(ctx, panel, 'ÓRDENES DE TRABAJO');
    const lista = this.gestor.lista();
    lista.forEach((a, i) => {
      const y = 92 + i * 106;
      ctx.fillStyle = COLORES.panel;
      rectRedondo(ctx, 16, y, W - 32, 98, 12);
      ctx.fill();
      ctx.fillStyle = COLORES.blanco;
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(a.def.titulo, 32, y + 36);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = COLORES.gris;
      ctx.fillText(a.def.concepto, 32, y + 62);
      ctx.fillStyle = a.estado === ESTADO.COMPLETADA ? COLORES.verde : a.estado === ESTADO.FALLIDA ? COLORES.rojo : a.estado === ESTADO.BLOQUEADA ? COLORES.gris : COLORES.amarillo;
      let detalle = ETIQUETA_ESTADO[a.estado];
      if (a.estado === ESTADO.ACTIVA || a.estado === ESTADO.PAUSADA) detalle += ` · ${formatoTiempo(a.tiempo)} · paso ${a.hechos + 1} de ${a.pasos.length} · ${a.errores} errores`;
      else if (a.resultado) detalle += a.resultado.completada ? ` · ${a.resultado.puntaje} puntos en ${formatoTiempo(a.resultado.segundos)} · ${a.resultado.errores} errores` : ` · ${a.resultado.motivo}`;
      else if (a.estado === ESTADO.BLOQUEADA) detalle += ` · ${this.gestor.impedimento(a.id)}`;
      ctx.fillText(detalle.slice(0, 62), 32, y + 88);
      if (a.estado === ESTADO.ACTIVA) {
        panel.boton(`pausa:${a.id}`, 640, y + 20, 144, 58, 'PAUSAR', () => this.acciones.pausar());
        panel.boton(`dejar:${a.id}`, 796, y + 20, 144, 58, 'DEJAR', () => this.acciones.abandonar());
      } else if (a.estado === ESTADO.PAUSADA) {
        panel.boton(`sigue:${a.id}`, 640, y + 20, 144, 58, 'SEGUIR', () => this.acciones.reanudar(), { estilo: 'aviso' });
        panel.boton(`dejar:${a.id}`, 796, y + 20, 144, 58, 'DEJAR', () => this.acciones.abandonar());
      } else {
        panel.boton(`inicio:${a.id}`, 740, y + 20, 200, 58, a.resultado ? 'REPETIR' : 'INICIAR', () => this.acciones.iniciar(a.id), { activo: !this.gestor.impedimento(a.id), estilo: 'aviso' });
      }
    });
  }

  _modulos(ctx, panel) {
    this._cabecera(ctx, panel, 'MÓDULOS');
    const lugares = LUGARES.filter((l) => l.zona === 'interior' && l.id !== 'esclusa');
    lugares.forEach((l, i) => {
      const y = 92 + i * 80;
      ctx.fillStyle = this.navegacion.actual === l.id ? '#24406e' : COLORES.panel;
      rectRedondo(ctx, 16, y, W - 32, 72, 12);
      ctx.fill();
      ctx.fillStyle = COLORES.blanco;
      ctx.font = 'bold 25px sans-serif';
      ctx.fillText(l.nombre, 32, y + 31);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = COLORES.gris;
      ctx.fillText(`${l.rol} · ${this.navegacion.actual === l.id ? 'estás acá' : this.navegacion.visitados.has(l.id) ? 'visitado' : 'sin visitar'}`.slice(0, 60), 32, y + 58);
      panel.boton(`guiar:${l.id}`, 760, y + 9, 180, 54, this.navegacion.destino === l.id ? 'GUIANDO' : 'GUIARME', () => this.acciones.guiar(l.id), { activo: this.navegacion.actual !== l.id });
    });
    panel.boton('mapa', 16, 574, 300, 56, 'ABRIR EL MAPA', () => this.acciones.abrirMapa());
  }

  _ajustes(ctx, panel) {
    this._cabecera(ctx, panel, 'AJUSTES');
    const a = this.ajustes;
    const fila = (i, titulo, valor) => {
      const y = 86 + i * 76;
      ctx.fillStyle = COLORES.blanco;
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(titulo, 28, y + 26);
      ctx.fillStyle = COLORES.celeste;
      ctx.font = '22px sans-serif';
      ctx.fillText(valor, 28, y + 54);
      return y;
    };
    const TUNEL = { apagado: 'Apagado', suave: 'Suave', medio: 'Medio (recomendado)', fuerte: 'Fuerte' };
    let y = fila(0, 'Giro con el stick derecho', a.giro === 'suave' ? 'Suave (continuo · marea más)' : 'Por pasos con parpadeo (recomendado)');
    panel.boton('giro', 640, y, 300, 60, 'CAMBIAR', () => this.acciones.ajuste('giro', a.giro === 'suave' ? 'pasos' : 'suave'));
    y = fila(1, 'Túnel al moverse', TUNEL[a.tunel] || a.tunel);
    panel.boton('tunel', 640, y, 300, 60, 'CAMBIAR', () => this.acciones.ajuste('tunel', this.acciones.siguienteTunel()));
    y = fila(2, 'Sensibilidad del giro suave', `${Math.round(a.sensibilidad * 100)} %`);
    panel.boton('sens-', 640, y, 144, 60, '−', () => this.acciones.ajuste('sensibilidad', a.sensibilidad - 0.25), { activo: a.giro === 'suave' && a.sensibilidad > 0.5 });
    panel.boton('sens+', 796, y, 144, 60, '+', () => this.acciones.ajuste('sensibilidad', a.sensibilidad + 0.25), { activo: a.giro === 'suave' && a.sensibilidad < 2 });
    y = fila(3, 'Velocidad del propulsor', `${Math.round(a.velocidad * 100)} %`);
    panel.boton('vel-', 640, y, 144, 60, '−', () => this.acciones.ajuste('velocidad', a.velocidad - 0.25), { activo: a.velocidad > 0.5 });
    panel.boton('vel+', 796, y, 144, 60, '+', () => this.acciones.ajuste('velocidad', a.velocidad + 0.25), { activo: a.velocidad < 1.5 });
    y = fila(4, 'Mirar arriba y abajo con el stick', a.giroVertical ? 'Activado' : 'Desactivado (recomendado: mirá con la cabeza)');
    panel.boton('vertical', 640, y, 300, 60, 'CAMBIAR', () => this.acciones.ajuste('giroVertical', !a.giroVertical));
    y = fila(5, 'Frenado asistido al soltar el stick', a.frenoAsistido ? 'Activado (menos mareo)' : 'Desactivado (inercia real)');
    panel.boton('freno', 640, y, 300, 60, 'CAMBIAR', () => this.acciones.ajuste('frenoAsistido', !a.frenoAsistido));
    y = fila(6, 'Manos', `Posición ${a.calibracionManos + 1} de 8`);
    panel.boton('manos', 640, y, 144, 60, 'GIRAR', () => { a.calibracionManos = this.acciones.calibrarManos(); this.panel.sucio = true; });
    panel.boton('reunir', 796, y, 144, 60, 'REUNIR', () => this.acciones.reunir());
  }
}
