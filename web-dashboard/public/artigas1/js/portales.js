// Visibilidad por módulos («portales»): no se dibuja lo que está detrás de una escotilla cerrada.
//
// La cámara de un módulo ve la estación entera a lo largo del eje: el recorte por cámara (frustum) no saca nada,
// y el taller de Tacuarembó dibujaba los lotes de los seis módulos. Pero las escotillas corredizas se cierran
// solas cuando el astronauta se aleja (js/estacion.js) y son opacas: con la escotilla cerrada, el módulo de al
// lado no se ve. Entonces se dibujan solo el módulo donde está la cabeza y los que se ven a través de
// escotillas abiertas (o abriéndose), en cadena.
//
// Lo de afuera (la Tierra, las estrellas y el sol) solo se ve por las ventanas de la Cúpula: adentro de los
// otros módulos no se dibuja. La Tierra se calcula por píxel y se dibuja antes que la estación, así que, aunque
// las paredes la tapen, su costo por píxel se pagaba igual en todos los módulos.
//
// Afuera (caminata espacial) el casco exterior tapa el interior salvo las ventanas de la Cúpula: se dibujan la
// Cúpula y el Nodo (la esclusa da al Nodo). Si la cabeza está en un lugar que no es de ningún módulo, se
// dibuja todo: es la opción segura.
import { moduloEn } from './navegacion.js';

/** Letra del lote (prefijo de los nombres del kit) de cada módulo. El carguero va con Colonia. */
export const LETRA_MODULO = { tacuarembo: 'T', nodo: 'N', cupula: 'F', rivera: 'R', colonia: 'C', carguero: 'C', esclusa: 'N' };
/** Escotillas que unen dos módulos (nombre de la puerta → letras de los dos lados). */
const UNIONES = {
  R_Escotilla_HaciaColonia: ['R', 'C'],
  R_Escotilla_HaciaNodo: ['R', 'N'],
  N_Escotilla_HaciaTacuarembo: ['N', 'T'],
  N_Escotilla_HaciaCupula: ['N', 'F'],
};
const TODAS = ['T', 'N', 'F', 'R', 'C'];

export class VisibilidadModulos {
  /** @param {{grupo: import('three').Group, escotillas: {malla: import('three').Mesh, avance: number}[]}} estacion */
  constructor(estacion) {
    /** @type {Map<string, import('three').Object3D[]>} letra → objetos que se prenden y apagan con su módulo */
    this.porModulo = new Map(TODAS.map((l) => [l, []]));
    for (const o of estacion.grupo.children) {
      const m = /^Lote_([A-Z])_/.exec(o.name);
      if (m && this.porModulo.has(m[1])) this.porModulo.get(m[1]).push(o);
    }
    this.uniones = estacion.escotillas.filter((e) => UNIONES[e.malla.name]).map((e) => ({ escotilla: e, lados: UNIONES[e.malla.name] }));
    /** Letras visibles en el último cuadro. */
    this.visibles = new Set(TODAS);
    this.activo = true;
    /** @type {import('three').Object3D[]} lo que solo se ve por las ventanas de la Cúpula o desde afuera */
    this.deAfuera = [];
  }

  /** Suma algo que solo se ve por las ventanas (la Tierra y el cielo). */
  agregarDeAfuera(objeto) {
    this.deAfuera.push(objeto);
  }

  /** Suma un objeto que se apaga junto con su módulo (un terminal, por ejemplo), según dónde está. */
  agregar(objeto, posicion) {
    const l = LETRA_MODULO[moduloEn(posicion)];
    if (l) this.porModulo.get(l).push(objeto);
  }

  /** Letras que se ven desde `cabeza`. */
  calcular(cabeza, afuera) {
    if (!this.activo) return new Set(TODAS);
    if (afuera) return new Set(['F', 'N']);
    const inicio = LETRA_MODULO[moduloEn(cabeza)];
    if (!inicio) return new Set(TODAS);
    const vistas = new Set([inicio]);
    let cambio = true;
    while (cambio) {                                      // en cadena: dos escotillas abiertas seguidas
      cambio = false;
      for (const u of this.uniones) {
        if (u.escotilla.avance <= 0) continue;
        const [a, b] = u.lados;
        if (vistas.has(a) && !vistas.has(b)) { vistas.add(b); cambio = true; }
        if (vistas.has(b) && !vistas.has(a)) { vistas.add(a); cambio = true; }
      }
    }
    return vistas;
  }

  /** Cada cuadro, después de mover las escotillas. */
  actualizar(cabeza, afuera) {
    this.visibles = this.calcular(cabeza, afuera);
    for (const [letra, objetos] of this.porModulo) {
      const v = this.visibles.has(letra);
      for (const o of objetos) o.visible = v;
    }
    const cielo = afuera || this.visibles.has('F');
    for (const o of this.deAfuera) o.visible = cielo;
  }
}
