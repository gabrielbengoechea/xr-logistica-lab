"""Pruebas de juego del simulador web de Artigas-1 en un navegador sin interfaz (Playwright + Chrome).

Juegan de verdad: simulan los dos controles del visor (posición, grip, gatillo, sticks y botones) y corren el
mismo bucle que el juego (`window.artigas1.avanzar`). Cubren manos, agarre y puntos de agarre, escáner, tablet,
contenedores, locomoción con los dos sticks, mapa y guía, las cinco actividades de punta a punta, el exterior y
la caminata espacial con su cable.

    cd web-dashboard/public && python3 -m http.server 8765 &
    pip install playwright && python3 artigas1-vr/Tools/pruebas-web/juego.py

Lo que NO prueban: un visor real. Los controles son objetos simulados; la comodidad, el rendimiento y la
orientación de las manos respecto del control físico hay que verlos en el Quest.

CHROME cambia el ejecutable (por defecto /usr/bin/google-chrome); URL, la dirección del simulador.
"""
import asyncio
import json
import os

from playwright.async_api import async_playwright

JS = r"""
() => {
  const A = window.artigas1, T = A.THREE, L = A.loco, F = A.flotantes, G = A.gestor, I = A.inventario;
  A.renderer.setAnimationLoop(null);                  // las pruebas manejan el tiempo
  A.sonido.tocar = () => {};
  const R = [];
  const ok = (nombre, pasa, dato = '') => R.push({ nombre, pasa: !!pasa, dato });
  const fase = (nombre) => R.push({ fase: nombre });
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const DT = 1 / 72;
  const pasos = (n = 1, dt = DT) => { for (let i = 0; i < n; i++) A.avanzar(dt); };
  const seg = (s) => pasos(Math.round(s * 72));
  const cabeza = () => A.camera.getWorldPosition(new T.Vector3());

  // ---- visor simulado: dos controles con su gamepad
  A.renderer.xr.isPresenting = true;
  A.rig.quaternion.identity(); A.camera.rotation.set(0, 0, 0); A.camera.position.set(0, 0, 0);
  let pulsos = 0;
  const control = (i, lado) => {
    const g = A.renderer.xr.getControllerGrip(i), a = A.renderer.xr.getController(i);
    g.matrixAutoUpdate = a.matrixAutoUpdate = true;
    const gp = { buttons: Array.from({ length: 6 }, () => ({ value: 0, pressed: false })), axes: [0, 0, 0, 0], hapticActuators: [{ pulse: () => { pulsos++; return Promise.resolve(); } }] };
    g.dispatchEvent({ type: 'connected', data: { handedness: lado, gamepad: gp } });
    const h = { g, a, gp, mano: A.manos._porIndice[i], lado };
    h.boton = (n, v) => { gp.buttons[n].value = v; gp.buttons[n].pressed = v > 0.5; };
    h.grip = (v) => h.boton(1, v);
    h.gatillo = (v) => h.boton(0, v);
    h.stick = (x, y) => { gp.axes[2] = x; gp.axes[3] = y; };
    // `en` lleva la mano de un salto (es una prueba): se borra la velocidad que ese salto le daría a la mano
    h.en = (p) => { A.rig.updateWorldMatrix(true, false); g.position.copy(A.rig.worldToLocal(p.clone())); a.position.copy(g.position); const e = F._manos.get(h.mano); if (e) { e.previa.copy(p); e.velocidad.set(0, 0, 0); } };
    h.mover = (delta, cuadros) => { for (let i = 0; i < cuadros; i++) { g.position.addScaledVector(delta, 1 / cuadros); a.position.copy(g.position); pasos(1); } };
    h.apuntar = (objetivo) => {                      // rayo del control (para los paneles)
      A.rig.updateWorldMatrix(true, false);
      const o = a.getWorldPosition(new T.Vector3());
      const d = objetivo.clone().sub(o).normalize().applyQuaternion(A.rig.getWorldQuaternion(new T.Quaternion()).invert());
      a.quaternion.setFromUnitVectors(V(0, 0, -1), d);
    };
    h.clic = () => { h.gatillo(1); pasos(2); h.gatillo(0); pasos(2); };
    return h;
  };
  const izq = control(0, 'left'), der = control(1, 'right');
  const ubicar = (p) => { L.teletransportar(p.clone()); L.velocidad.set(0, 0, 0); izq.en(p.clone().add(V(-0.22, -0.25, -0.3))); der.en(p.clone().add(V(0.22, -0.25, -0.3))); };
  const soltar = (h) => { h.grip(0); h.gatillo(0); pasos(2); };
  const tomar = (h, f) => {
    soltar(h);
    h.en(f.posicion); pasos(2);
    h.grip(1); pasos(2);
    return h.mano.sostiene === f;
  };
  const centroBoton = (panel, id) => {
    const b = panel.botones.find((x) => x.id === id);
    if (!b) return null;
    const c = panel.lienzo.canvas;
    panel.malla.updateWorldMatrix(true, false);
    return V(((b.x + b.w / 2) / c.width - 0.5) * panel.ancho, (0.5 - (b.y + b.h / 2) / c.height) * panel.alto, 0).applyMatrix4(panel.malla.matrixWorld);
  };
  /** Aprieta un botón de un panel con el rayo del control y su gatillo. */
  const apretar = (h, panel, id) => {
    pasos(1);
    const c = centroBoton(panel, id);
    if (!c) return false;
    h.apuntar(c); pasos(2);
    const sobre = panel.sobre === id;
    h.clic();
    return sobre;
  };
  /** Gira y corre el control para que la herramienta que lleva apunte a `objetivo` desde `distancia`. */
  const apuntarHerramienta = (h, objetivo, distancia, desde = null) => {
    const f = h.mano.sostiene, o = new T.Vector3(), d = new T.Vector3();
    for (let i = 0; i < 4; i++) {
      pasos(1);
      f.malla.updateWorldMatrix(true, false);
      o.copy(f.agarre.punta).applyMatrix4(f.malla.matrixWorld);
      d.copy(f.agarre.direccion).transformDirection(f.malla.matrixWorld);
      const origen = desde ? desde.clone() : objetivo.clone().addScaledVector(d, -distancia);
      const quiero = objetivo.clone().sub(origen).normalize();
      const q = new T.Quaternion().setFromUnitVectors(d, quiero);
      h.g.quaternion.premultiply(q);                  // el rig no está girado: mundo = local
      pasos(1);
      f.malla.updateWorldMatrix(true, false);
      o.copy(f.agarre.punta).applyMatrix4(f.malla.matrixWorld);
      h.g.position.add(A.rig.worldToLocal(origen.clone()).sub(A.rig.worldToLocal(o.clone())));
    }
    pasos(1);
  };
  const frenteDe = (b, afuera = 0) => { const m = b.inversa.clone().invert(); return V(b.centroLocal.x, b.centroLocal.y, b.centroLocal.z + b.mitad.z + afuera).applyMatrix4(m); };
  const leerBulto = (h, b) => {
    const frente = frenteDe(b), lejos = frenteDe(b, 0.55);
    L.teletransportar(frenteDe(b, 0.75)); L.velocidad.set(0, 0, 0);
    apuntarHerramienta(h, frente, 0.5, lejos);
    const n = A.escaneres.reduce((s, e) => s + e.lecturas, 0);
    h.clic();
    const e = A.escaneres.find((x) => x.flotante === h.mano.sostiene);
    return A.escaneres.reduce((s, x) => s + x.lecturas, 0) === n + 1 ? e.ultima : null;
  };

  // =========================================================================================== FASE 1
  fase('FASE 1 · Manos, agarre, escáner y contenedores');
  ubicar(V(0.1, 0.1, -0.2)); pasos(3);
  const M = A.manos;
  ok('manos: dos manos con los controles conectados', M.lista.length === 2 && M.mano('left') && M.mano('right'), M.lista.map((m) => m.lado).join(','));
  ok('manos: 18 piezas por mano (palma, pulgar y cuatro dedos de tres falanges), cápsulas y no cajas', M.malla.geometry.type === 'CapsuleGeometry' && M.malla.count === 3 * 21 + 9, M.malla.geometry.type);
  ok('manos: las dos manos se dibujan en una llamada', M.malla.isInstancedMesh);
  const relajada = der.mano.pose.dedos.map((d) => d[0]);
  der.grip(1); seg(0.4);
  const senala = der.mano.pose.dedos.map((d) => +d[0].toFixed(2));
  ok('manos: con el grip, el índice queda extendido y los otros dedos se cierran (señalar)', senala[0] < 0.2 && senala[1] > 1.2 && senala[3] > 1.2, senala);
  der.gatillo(1); seg(0.4);
  const puno = der.mano.pose.dedos.map((d) => +d[0].toFixed(2));
  ok('manos: grip y gatillo cierran el puño', puno.every((x) => x > 1.2), puno);
  der.grip(0); der.gatillo(0.5); seg(0.4);
  ok('manos: el índice acompaña al gatillo con la mano libre', der.mano.pose.dedos[0][1] > relajada[0] + 0.2, +der.mano.pose.dedos[0][1].toFixed(2));
  der.gatillo(0); seg(0.4);
  ok('manos: al soltar vuelven a la pose relajada', Math.abs(der.mano.pose.dedos[1][0] - 0.28) < 0.03, +der.mano.pose.dedos[1][0].toFixed(2));
  const pi = new T.Vector3(), pd = new T.Vector3(), mm = new T.Matrix4();
  M.malla.getMatrixAt(0, mm); pi.setFromMatrixPosition(mm); M.malla.getMatrixAt(21, mm); pd.setFromMatrixPosition(mm);
  ok('manos: cada palma está en su control', pi.distanceTo(izq.mano.posicion) < 0.06 && pd.distanceTo(der.mano.posicion) < 0.06, +pd.distanceTo(der.mano.posicion).toFixed(3));

  // ---- brazos y cuerpo en primera persona
  ubicar(V(0.1, 0.1, -0.2)); pasos(2);
  const md = der.mano, mi = izq.mano;
  ok('cuerpo: cada mano sale de un brazo que llega al hombro (brazo 30 cm, antebrazo 27 cm)', Math.abs(md.codo.distanceTo(md.hombro) - 0.30) < 0.002 && Math.abs(md.codo.distanceTo(md.muneca) - 0.27) < 0.002 && Math.abs(mi.codo.distanceTo(mi.hombro) - 0.30) < 0.002, [+md.codo.distanceTo(md.hombro).toFixed(3), +md.codo.distanceTo(md.muneca).toFixed(3)]);
  ok('cuerpo: los hombros quedan a los lados y debajo de los ojos', md.hombro.x > cabeza().x + 0.15 && mi.hombro.x < cabeza().x - 0.15 && md.hombro.y < cabeza().y - 0.15, [+(md.hombro.x - cabeza().x).toFixed(2), +(md.hombro.y - cabeza().y).toFixed(2)]);
  ok('cuerpo: el codo dobla hacia abajo y afuera', md.codo.y < (md.hombro.y + md.muneca.y) / 2 && md.codo.x > (md.hombro.x + md.muneca.x) / 2 - 0.02, md.codo.toArray().map((x) => +x.toFixed(2)));
  der.en(cabeza().add(V(0.3, 0.2, -1.1))); pasos(2);
  const sobreLaRecta = md.codo.clone().sub(md.hombro).normalize().dot(md.muneca.clone().sub(md.hombro).normalize());
  ok('cuerpo: con la mano más lejos que el brazo, el brazo se estira y no se despega', sobreLaRecta > 0.9999 && md.hombro.distanceTo(md.muneca) > 0.6, +sobreLaRecta.toFixed(5));
  M.malla.getMatrixAt(63, mm); const torso = new T.Vector3().setFromMatrixPosition(mm);
  M.malla.getMatrixAt(63 + 5, mm); const pierna = new T.Vector3().setFromMatrixPosition(mm);
  ok('cuerpo: torso y piernas debajo de la cabeza', torso.y < cabeza().y - 0.3 && Math.hypot(torso.x - cabeza().x, torso.z - cabeza().z) < 0.1 && pierna.y < torso.y - 0.4, [+(torso.y - cabeza().y).toFixed(2), +(pierna.y - cabeza().y).toFixed(2)]);
  const c1 = new T.Color(), c2 = new T.Color(); M.malla.getColorAt(21 + 18, c1); M.malla.getColorAt(21 + 5, c2);
  ok('manos: guante del traje (blanco, yemas de goma, puño celeste), no piel', c1.getHexString() === '74acdf' && c2.getHexString() === '6c7178' && M._material.color.getHexString() === 'ffffff', [c1.getHexString(), c2.getHexString()]);
  ubicar(V(0.1, 0.1, -0.2)); pasos(2);

  // ---- escáner: tomar, acomodo en la mano, pasar de mano
  const esc = A.escaneres[0], fe = esc.flotante;
  ubicar(fe.posicion.clone().add(V(-0.3, 0.1, 0.35)));
  izq.en(fe.posicion.clone().add(V(-0.5, 0, 0)));
  der.en(fe.posicion.clone().add(V(0.02, 0.0, 0.07))); pasos(2);
  ok('agarre: la mano cerca marca el objeto que puede tomar', der.mano.objetoCercano === fe);
  ok('escáner: se toma con el grip derecho', tomar(der, fe), fe.tipo);
  seg(0.5);
  const local = (mano, f) => { mano.objeto.updateWorldMatrix(true, false); f.malla.updateWorldMatrix(true, false); return new T.Matrix4().copy(mano.objeto.matrixWorld).invert().multiply(f.malla.matrixWorld); };
  const difAgarre = (mano, f, g) => {
    const p1 = new T.Vector3(), q1 = new T.Quaternion(), s1 = new T.Vector3(), p2 = new T.Vector3(), q2 = new T.Quaternion();
    local(mano, f).decompose(p1, q1, s1); g.decompose(p2, q2, s1);
    return [p1.distanceTo(p2), q1.angleTo(q2)];
  };
  let dif = difAgarre(der.mano, fe, fe.agarre.matriz);
  ok('escáner: se acomoda en la mano por su punto de agarre (posición y giro)', dif[0] < 0.002 && dif[1] < 0.01, dif.map((x) => +x.toFixed(4)));
  ok('escáner: la mano adopta la pose de pistola', der.mano.pose.dedos[1][0] > 0.9 && der.mano.pose.dedos[0][0] < 0.6, der.mano.pose.dedos.map((d) => +d[0].toFixed(2)));
  ok('agarre: vibra al tomar', pulsos > 0, pulsos);
  izq.en(fe.posicion); pasos(2); izq.grip(1); pasos(2);
  ok('agarre: pasa de una mano a la otra', izq.mano.sostiene === fe && der.mano.sostiene === null);
  der.grip(0); seg(0.5);
  dif = difAgarre(izq.mano, fe, fe.agarre.matrizIzquierda);
  ok('escáner: en la mano izquierda usa el agarre espejado', dif[0] < 0.002 && dif[1] < 0.01, dif.map((x) => +x.toFixed(4)));
  der.en(fe.posicion); pasos(2); der.grip(1); pasos(2); izq.grip(0); seg(0.5);

  // ---- lecturas
  const bRiv = I.bultos.find((b) => b.legible && /^RIV-E2/.test(b.ubicacion));
  izq.en(V(-0.5, -0.4, 0.3));
  let l = leerBulto(der, bRiv);
  ok('escáner: lee la etiqueta de un bulto del rack', l && l.ok && l.codigo === bRiv.codigo && l.ubicacion === bRiv.ubicacion, l && `${l.codigo} · ${l.ubicacion}`);
  ok('escáner: la lectura queda en el inventario', bRiv.escaneado === true && I.listado().find((f) => f.codigo === bRiv.codigo).escaneado);
  ok('escáner: muestra el aviso de confirmación', A.aviso.tono === 'ok' && A.aviso.texto.includes(bRiv.codigo), A.aviso.texto);
  ok('escáner: el índice aprieta el gatillo', (() => { der.gatillo(1); seg(0.3); const x = der.mano.pose.dedos[0][0]; der.gatillo(0); seg(0.2); return x > 0.65; })());
  // de costado: se ve la bolsa pero no la etiqueta
  const mB = bRiv.inversa.clone().invert();
  const costado = V(bRiv.centroLocal.x, bRiv.centroLocal.y + bRiv.mitad.y, bRiv.centroLocal.z).applyMatrix4(mB);
  const desdeCostado = V(bRiv.centroLocal.x, bRiv.centroLocal.y + bRiv.mitad.y + 0.3, bRiv.centroLocal.z).applyMatrix4(mB);
  apuntarHerramienta(der, costado, 0.3, desdeCostado);
  let n0 = esc.lecturas; der.clic();
  ok('escáner: de costado no ve la etiqueta', esc.lecturas === n0 + 1 && !esc.ultima.ok && (esc.ultima.motivo === 'sin_etiqueta' || esc.ultima.motivo === 'sin_lectura'), esc.ultima.motivo);
  // al vacío
  ubicar(V(0, 0, -2.0)); der.g.quaternion.identity(); pasos(1);
  apuntarHerramienta(der, V(0, 0, 0.4), 1.0, V(0, 0, -1.4));
  n0 = esc.lecturas; der.clic();
  ok('escáner: sin nada a 1,6 m informa «sin lectura» (mensaje de error)', esc.lecturas === n0 + 1 && esc.ultima.motivo === 'sin_lectura' && A.aviso.tono === 'error', esc.ultima.motivo);
  const ilegible = I.bultos.find((b) => !b.legible);
  l = leerBulto(der, ilegible);
  ok('escáner: una bolsa dañada da «etiqueta ilegible»', l && !l.ok && l.motivo === 'ilegible', l && l.motivo);
  // el haz se ve mientras se aprieta
  der.gatillo(0.4); pasos(2);
  ok('escáner: el haz se enciende con el gatillo y se apaga al soltarlo', esc.haz.visible && (() => { der.gatillo(0); seg(0.3); return !esc.haz.visible; })());

  // ---- acercar la mano no espanta el objeto; un manotazo sí lo empuja
  const suelto = I.contenedores[1];
  suelto.velocidad.set(0, 0, 0); suelto.libre = false;
  ubicar(suelto.posicion.clone().add(V(0, 0.1, 0.6))); izq.en(suelto.posicion.clone().add(V(0, 0, 0.45))); pasos(3);
  const pSuelto = suelto.posicion.clone();
  izq.mover(V(0, 0, -0.40), 96);                                         // 0,3 m/s hasta tocarlo
  ok('agarre: acercar la mano despacio no corre el objeto', suelto.posicion.distanceTo(pSuelto) < 0.01 && izq.mano.objetoCercano === suelto, +suelto.posicion.distanceTo(pSuelto).toFixed(4));
  izq.grip(1); pasos(2);
  ok('agarre: se toma aunque la mano no esté justo en el centro (tolerancia de 12 cm desde la superficie)', izq.mano.sostiene === suelto);
  izq.grip(0); pasos(2); suelto.velocidad.set(0, 0, 0);
  izq.en(suelto.posicion.clone().add(V(0, 0, 0.5))); pasos(3);
  izq.mover(V(0, 0, -0.5), 18);                                          // 2 m/s
  ok('agarre: un manotazo sí lo empuja', suelto.velocidad.z < -1.0, +suelto.velocidad.z.toFixed(2));
  suelto.velocidad.set(0, 0, 0); izq.en(V(-0.5, -0.4, 0.3));

  // ---- soltar con inercia
  ubicar(V(0, 0.1, -2.0)); der.en(V(0.2, 0.1, -2.3)); pasos(2);
  for (let i = 0; i < 12; i++) { der.g.position.z -= 0.012; pasos(1); }
  der.grip(0); pasos(1);
  ok('agarre: al soltar, el objeto conserva la velocidad de la mano', Math.abs(fe.velocidad.z + 0.864) < 0.15 && !fe.mano, +fe.velocidad.z.toFixed(3));
  seg(1.0);
  ok('agarre: el objeto suelto sigue por inercia y no atraviesa la estación', fe.posicion.z < -2.7 && Math.abs(fe.posicion.x) < 1.45, fe.posicion.toArray().map((x) => +x.toFixed(2)));

  // ---- contenedores
  const cont = I.contenedores[0], destino = I.huecos.find((h) => h.codigo === cont.datos.destino);
  ok('contenedores: cada uno tiene código y hueco de destino libre', I.contenedores.length >= 3 && I.contenedores.every((c) => c.datos.codigo && I.huecos.some((h) => h.codigo === c.datos.destino && !h.ocupado)), I.contenedores.map((c) => `${c.datos.codigo}→${c.datos.destino}`));
  ubicar(cont.posicion.clone().add(V(0, 0.1, 0.5)));
  izq.en(cont.posicion.clone().add(V(0, 0, cont.radio * 0.5))); pasos(2);
  ok('contenedores: se toman con el grip (izquierdo)', (() => { izq.grip(1); pasos(2); return izq.mano.sostiene === cont; })());
  const antesQ = cont.malla.quaternion.clone();
  izq.g.quaternion.setFromAxisAngle(V(0, 1, 0), 0.9); pasos(2);
  ok('contenedores: giran con la mano', cont.malla.quaternion.angleTo(antesQ) > 0.6, +cont.malla.quaternion.angleTo(antesQ).toFixed(2));
  // lugar equivocado primero
  const otro = I.huecos.find((h) => !h.ocupado && h.codigo !== destino.codigo && !I.contenedores.some((c) => c.datos.destino === h.codigo));
  ubicar(V(0, otro.posicion.y, otro.posicion.z));
  izq.en(otro.posicion.clone()); pasos(3);
  const desfase = cont.posicion.clone().sub(izq.mano.posicion);
  izq.en(otro.posicion.clone().sub(desfase)); pasos(3);
  izq.grip(0); pasos(2);
  ok('contenedores: en un hueco que no es el suyo queda puesto pero avisa el error', cont.fijo && cont.datos.hueco === otro && A.aviso.tono === 'error', A.aviso.texto);
  // se retira y va al correcto
  izq.en(cont.posicion); pasos(2); izq.grip(1); pasos(2);
  ok('contenedores: al retirarlo el hueco queda libre', izq.mano.sostiene === cont && !otro.ocupado && !cont.datos.hueco);
  ubicar(V(0, destino.posicion.y, destino.posicion.z));
  izq.en(destino.posicion.clone()); pasos(3);
  izq.en(destino.posicion.clone().sub(cont.posicion.clone().sub(izq.mano.posicion)).add(V(0.1, 0.05, 0.05))); pasos(3);
  izq.grip(0); pasos(2);
  ok('contenedores: soltado cerca de su hueco queda asegurado en él, con la correa', cont.fijo && cont.datos.hueco === destino && destino.ocupado && cont.posicion.distanceTo(destino.posicion) < 1e-6 && cont.datos.correa.visible, A.aviso.texto);
  seg(2);
  ok('contenedores: asegurado, no deriva', cont.posicion.distanceTo(destino.posicion) < 1e-6);
  ok('contenedores: la tablet lo lista en su ubicación', I.listado().find((f) => f.codigo === cont.datos.codigo).ubicacion === destino.codigo);

  // ---- herramientas con punto de agarre
  const porTipo = (t) => F.objetos.find((f) => f.tipo === t && !f.mano);
  const tipos = ['linterna', 'destornillador', 'llave', 'inspector', 'medidor', 'radio', 'tarjeta', 'tablet'];
  const faltan = [], mal = [];
  for (const t of tipos) {
    const f = porTipo(t);
    if (!f) { faltan.push(t); continue; }
    ubicar(f.posicion.clone().add(V(f.posicion.x > 0 ? -0.4 : 0.4, 0.1, 0.2)));
    if (!tomar(der, f)) { mal.push(`${t}: no se toma`); continue; }
    seg(0.5);
    const d2 = difAgarre(der.mano, f, f.agarre.matriz);
    if (d2[0] > 0.002 || d2[1] > 0.01) mal.push(`${t}: no se acomoda`);
    const esperada = f.agarre.pose;
    if (!esperada) mal.push(`${t}: sin pose`);
    soltar(der); pasos(2);
  }
  ok('herramientas: existen linterna, destornillador, llave, inspector, medidor, radio, tarjeta y tablet', faltan.length === 0, faltan);
  ok('herramientas: todas se toman y se acomodan por su punto de agarre', mal.length === 0, mal);
  const lin = porTipo('linterna');
  ubicar(lin.posicion.clone().add(V(-0.3, 0.1, 0.2))); tomar(der, lin); seg(0.3);
  der.gatillo(1); pasos(2); const hazSi = lin.datos.haz.visible; der.gatillo(0); pasos(2);
  ok('linterna: el gatillo enciende el haz', hazSi && !lin.datos.haz.visible);
  soltar(der);
  A.acciones.reunirHerramientas(); pasos(2);
  ok('herramientas: «reunir» las devuelve a su lugar', F.objetos.filter((f) => f.datos && f.datos.herramienta).every((f) => f.fijo && f.posicion.distanceTo(f.casa) < 1e-6));

  // ---- tablet
  const tab = A.tablets[0], ft = F.objetos.find((f) => f.datos && f.datos.tablet === tab);
  ubicar(ft.posicion.clone().add(V(0.3, 0.1, 0.3)));
  ok('tablet: se toma con la izquierda', tomar(izq, ft));
  izq.g.quaternion.setFromAxisAngle(V(1, 0, 0), 1.0); seg(0.5);        // control sostenido de forma natural: el mango hacia arriba y adelante
  const frenteTablet = () => { tab.panel.malla.updateWorldMatrix(true, false); return V(0, 0, 1).transformDirection(tab.panel.malla.matrixWorld); };
  ok('tablet: sostenida de forma natural, la pantalla mira al usuario', frenteTablet().z > 0.4 && frenteTablet().y > 0.3, frenteTablet().toArray().map((x) => +x.toFixed(2)));
  der.en(tab.panel.malla.getWorldPosition(new T.Vector3()).addScaledVector(frenteTablet(), 0.3).add(V(0.12, 0, 0))); pasos(2);
  ok('tablet: abre en el menú con sus secciones', tab.pagina === 'inicio' && tab.panel.botones.length >= 4, tab.panel.botones.map((b) => b.id));
  const paginas = tab.panel.botones.filter((b) => b.id.startsWith('ir:')).map((b) => b.id.slice(3));
  const abiertas = [];
  for (const p of paginas) {
    if (apretar(der, tab.panel, `ir:${p}`) && tab.pagina === p) abiertas.push(p);
    apretar(der, tab.panel, 'volver');
  }
  ok('tablet: cada sección se abre apuntando con la otra mano y el gatillo', abiertas.length === paginas.length && paginas.length >= 4, abiertas);
  ok('tablet: el gatillo sobre un botón no abre el mapa', !A.mapa.abierto);
  apretar(der, tab.panel, 'ir:inventario');
  ok('tablet: el inventario muestra bultos y contenedores', tab.pagina === 'inventario' && I.listado().length > 100, I.listado().length);
  apretar(der, tab.panel, 'volver'); apretar(der, tab.panel, 'ir:ajustes');
  const giroAntes = A.ajustes.giro; apretar(der, tab.panel, 'giro');
  ok('tablet: los ajustes cambian (giro suave / por pasos)', A.ajustes.giro !== giroAntes, A.ajustes.giro);
  apretar(der, tab.panel, 'giro');
  const tunelAntes = A.ajustes.tunel; apretar(der, tab.panel, 'tunel');
  ok('tablet: el túnel se elige en los ajustes (apagado, suave, medio, fuerte)', A.ajustes.tunel !== tunelAntes, `${tunelAntes} → ${A.ajustes.tunel}`);
  for (let i = 0; i < 3; i++) apretar(der, tab.panel, 'tunel');
  // con el dedo
  apretar(der, tab.panel, 'volver'); pasos(2);
  const cb = centroBoton(tab.panel, 'ir:modulos') || centroBoton(tab.panel, `ir:${paginas[0]}`);
  const nrm = V(0, 0, 1).transformDirection(tab.panel.malla.matrixWorld);
  const idDedo = tab.panel.botones.find((b) => centroBoton(tab.panel, b.id).distanceTo(cb) < 1e-6).id;
  der.a.quaternion.setFromUnitVectors(V(0, 0, -1), nrm.clone());       // el rayo no apunta a la tablet
  for (let i = 0; i < 30; i++) {                                         // acerca la punta del índice al botón
    const falta = cb.clone().addScaledVector(nrm, 0.02 - i * 0.001).sub(der.mano.punta);
    der.g.position.add(falta.applyQuaternion(A.rig.quaternion.clone().invert())); pasos(1);
    if (tab.pagina !== 'inicio') break;
  }
  ok('tablet: los botones también se aprietan tocándolos con el índice', tab.pagina === idDedo.slice(3), tab.pagina);
  soltar(izq); izq.g.quaternion.identity(); A.acciones.reunirHerramientas(); pasos(2);

  // =========================================================================================== FASE 2
  fase('FASE 2 · Locomoción con los dos sticks, mapa y guía');
  ok('confort: de fábrica, giro por pasos con parpadeo, sin inclinar con el stick y con túnel medio', JSON.stringify([A.ajustes.giro, A.ajustes.giroVertical, A.ajustes.tunel]) === JSON.stringify(['pasos', false, 'medio']), [A.ajustes.giro, A.ajustes.giroVertical, A.ajustes.tunel]);
  A.ajustes.giro = 'suave'; A.ajustes.sensibilidad = 1; A.ajustes.velocidad = 1; A.ajustes.giroVertical = true; A.ajustes.frenoAsistido = false;
  ubicar(V(0, 0, -2.0)); der.g.quaternion.identity(); der.a.quaternion.identity(); pasos(2);
  izq.stick(0, -1); pasos(1);
  const v1 = L.velocidad.length(); seg(0.5);
  const v2 = L.velocidad.clone();
  ok('stick izquierdo: acelera de a poco hacia donde se mira (sin saltos de velocidad)', v1 < 0.05 && v2.z < -0.3 && Math.abs(v2.x) < 0.02 && Math.abs(v2.y) < 0.02, [+v1.toFixed(3), +v2.z.toFixed(3)]);
  seg(3);
  ok('stick izquierdo: la velocidad tiene tope', L.velocidad.length() <= L.p.velocidadEmpuje + 0.02, +L.velocidad.length().toFixed(3));
  izq.stick(0, 0); const vInercia = L.velocidad.length(); seg(0.5);
  ok('0G: al soltar el stick el cuerpo sigue por inercia', L.velocidad.length() > vInercia * 0.9, +L.velocidad.length().toFixed(3));
  der.boton(4, 1); seg(2.5); der.boton(4, 0);
  ok('botón A: freno (se detiene en unos 2 s, sin frenazo)', L.velocidad.length() < 0.02, +L.velocidad.length().toFixed(4));
  ubicar(V(0, 0, -2.0)); izq.stick(1, 0); seg(0.6); izq.stick(0, 0);
  ok('stick izquierdo: de costado', L.velocidad.x > 0.3 && Math.abs(L.velocidad.z) < 0.02, +L.velocidad.x.toFixed(3));
  ubicar(V(0, 0, -2.0)); izq.stick(0.7, -0.7); seg(0.6); izq.stick(0, 0);
  ok('stick izquierdo: en diagonal', L.velocidad.x > 0.2 && L.velocidad.z < -0.2, [+L.velocidad.x.toFixed(2), +L.velocidad.z.toFixed(2)]);
  ubicar(V(0, 0, -2.0)); izq.boton(5, 1); seg(0.6); izq.boton(5, 0);
  const sube = L.velocidad.y; ubicar(V(0, 0, -2.0)); izq.boton(4, 1); seg(0.6); izq.boton(4, 0);
  ok('botones Y / X: subir y bajar', sube > 0.3 && L.velocidad.y < -0.3, [+sube.toFixed(2), +L.velocidad.y.toFixed(2)]);
  // mirar hacia arriba y avanzar: sube
  ubicar(V(0, 0, -2.0)); A.camera.rotation.set(0.7, 0, 0); pasos(1); izq.stick(0, -1); seg(0.6); izq.stick(0, 0);
  ok('stick izquierdo: sigue la mirada también en vertical (mirando arriba, sube)', L.velocidad.y > 0.2 && L.velocidad.z < -0.2, [+L.velocidad.y.toFixed(2), +L.velocidad.z.toFixed(2)]);
  A.camera.rotation.set(0, 0, 0);
  // giro: alrededor de la cabeza, que no se mueve
  ubicar(V(0, 0, -2.0)); A.camera.position.set(0.15, 0.1, -0.1); pasos(1);
  const c0 = cabeza(), dir0 = A.camera.getWorldDirection(new T.Vector3());
  der.stick(1, 0); pasos(1); const g1 = A.camera.getWorldDirection(new T.Vector3()).angleTo(dir0); seg(1); der.stick(0, 0); seg(0.6);
  const dir1 = A.camera.getWorldDirection(new T.Vector3());
  ok('stick derecho: gira a la derecha, con arranque suave', g1 < 0.01 && dir1.x > 0.8, [+g1.toFixed(4), +dir1.x.toFixed(2)]);
  ok('stick derecho: la cabeza no se mueve al girar (se respeta el seguimiento)', cabeza().distanceTo(c0) < 0.002, +cabeza().distanceTo(c0).toFixed(5));
  const dirA = A.camera.getWorldDirection(new T.Vector3());
  der.stick(0, -1); seg(0.8); der.stick(0, 0); seg(0.6);
  ok('stick derecho: mira hacia arriba', A.camera.getWorldDirection(new T.Vector3()).y > dirA.y + 0.4 && cabeza().distanceTo(c0) < 0.003, +A.camera.getWorldDirection(new T.Vector3()).y.toFixed(2));
  der.boton(5, 1); pasos(2); der.boton(5, 0); pasos(2);
  ok('botón B: endereza el cuerpo', Math.abs(V(0, 1, 0).applyQuaternion(A.rig.quaternion).y - 1) < 1e-4 && cabeza().distanceTo(c0) < 0.003);
  // ---- confort (como Mission: ISS): giro por pasos con parpadeo a negro y túnel al moverse
  const C = A.confort, velo = C._velo.material, tunel = C._tunel.material.uniforms.uFuerza;
  A.ajustes.giro = 'pasos'; seg(0.3); const dB = A.camera.getWorldDirection(new T.Vector3()); const c0b = cabeza();
  der.stick(1, 0); pasos(1);
  const nada = A.camera.getWorldDirection(new T.Vector3()).angleTo(dB), opa1 = velo.opacity;
  const historia = [];
  for (let i = 0; i < 30; i++) { pasos(1); historia.push([+velo.opacity.toFixed(2), +A.camera.getWorldDirection(new T.Vector3()).angleTo(dB).toFixed(3)]); }
  const paso1 = A.camera.getWorldDirection(new T.Vector3()).angleTo(dB);
  seg(0.5); const paso2 = A.camera.getWorldDirection(new T.Vector3()).angleTo(dB); der.stick(0, 0); pasos(3);
  ok('giro por pasos: 30° por empujón, uno solo hasta soltar el stick', Math.abs(paso1 - Math.PI / 6) < 0.01 && Math.abs(paso2 - Math.PI / 6) < 0.01, [+(paso1 * 57.3).toFixed(1), +(paso2 * 57.3).toFixed(1)]);
  ok('confort: al empujar el stick la vista empieza a fundirse a negro y todavía no gira', nada < 1e-6 && opa1 > 0 && opa1 < 1, [nada, +opa1.toFixed(2)]);
  const vistoGirando = historia.filter(([o, ang]) => ang > 1e-4 && ang < Math.PI / 6 - 1e-3);
  ok('confort: el giro se hace entero con la pantalla en negro (nunca se ve rotar)', C.opacidadAlGirar === 1 && vistoGirando.length === 0 && historia.filter(([o, ang]) => ang > 0.01).every(([o], i, arr) => i > 0 || o === 1), C.opacidadAlGirar);
  const tParpadeo = (C.p.cierre + C.p.negro + C.p.apertura) * 1000;
  ok('confort: el parpadeo dura menos de un quinto de segundo y la vista vuelve sola', tParpadeo <= 200 && velo.opacity === 0 && !C._velo.visible, `${tParpadeo.toFixed(0)} ms`);
  ok('confort: el parpadeo no mueve la cabeza', cabeza().distanceTo(c0b) < 0.002, +cabeza().distanceTo(c0b).toFixed(4));
  const girosAntes = C.giros; der.stick(1, 0); pasos(1); der.stick(0, 0); pasos(1); der.stick(1, 0); pasos(1); der.stick(0, 0); seg(0.5);
  ok('confort: empujones muy seguidos no encadenan giros durante el parpadeo', C.giros === girosAntes + 1, C.giros - girosAntes);
  A.ajustes.giroVertical = false; const dV = A.camera.getWorldDirection(new T.Vector3()); der.stick(0, -1); seg(0.6); der.stick(0, 0); seg(0.3);
  ok('confort: de fábrica el stick no inclina la vista arriba o abajo (se mira con la cabeza)', A.camera.getWorldDirection(new T.Vector3()).angleTo(dV) < 1e-6);
  A.ajustes.giroVertical = true; der.stick(0, -1); seg(0.6); der.stick(0, 0); seg(0.3);
  const incl = A.camera.getWorldDirection(new T.Vector3()).angleTo(dV);
  ok('confort: si se activa, también va por saltos de 20° con parpadeo', Math.abs(incl - Math.PI / 9) < 0.01, +(incl * 57.3).toFixed(1));
  der.boton(5, 1); pasos(2); der.boton(5, 0); pasos(2);
  A.ajustes.tunel = 'medio'; ubicar(V(0, 0, -2.0)); seg(0.5);
  ok('túnel: quieto no hay túnel', tunel.value === 0 && !C._tunel.visible);
  izq.stick(0, -1); seg(1.5);
  const fMov = tunel.value;
  ok('túnel: moviéndose se cierra la periferia', C._tunel.visible && fMov > 0.6 && fMov <= 0.8 + 1e-6, +fMov.toFixed(2));
  izq.stick(0, 0); der.boton(4, 1); seg(2.5); der.boton(4, 0); seg(2.5);
  ok('túnel: al frenar se vuelve a abrir', tunel.value === 0 && !C._tunel.visible, +tunel.value.toFixed(3));
  A.ajustes.tunel = 'apagado'; ubicar(V(0, 0, -2.0)); izq.stick(0, -1); seg(1.5); izq.stick(0, 0);
  ok('túnel: se puede apagar desde los ajustes', tunel.value === 0 && !C._tunel.visible);
  der.boton(4, 1); seg(2.5); der.boton(4, 0);
  A.ajustes.tunel = 'medio'; A.ajustes.giro = 'suave'; A.ajustes.giroVertical = true;
  A.ajustes.sensibilidad = 2; const dC = A.camera.getWorldDirection(new T.Vector3()); der.stick(1, 0); seg(0.5); der.stick(0, 0); const rapido = A.camera.getWorldDirection(new T.Vector3()).angleTo(dC); seg(0.6);
  A.ajustes.sensibilidad = 0.5; const dD = A.camera.getWorldDirection(new T.Vector3()); der.stick(1, 0); seg(0.5); der.stick(0, 0); const lento = A.camera.getWorldDirection(new T.Vector3()).angleTo(dD); seg(0.6);
  ok('sensibilidad de giro ajustable', rapido > lento * 2.5, [+rapido.toFixed(2), +lento.toFixed(2)]);
  A.ajustes.sensibilidad = 1; A.rig.quaternion.identity(); A.camera.position.set(0, 0, 0);
  A.ajustes.velocidad = 0.5; ubicar(V(0, 0, -1.0)); izq.stick(0, -1); seg(4); const vLenta = L.velocidad.length(); izq.stick(0, 0);
  A.ajustes.velocidad = 1.5; ubicar(V(0, 0, -1.0)); izq.stick(0, -1); seg(4); const vRapida = L.velocidad.length(); izq.stick(0, 0);
  ok('velocidad máxima ajustable', vRapida > vLenta * 2, [+vLenta.toFixed(2), +vRapida.toFixed(2)]);
  A.ajustes.velocidad = 1;
  // las paredes siguen siendo sólidas con el stick
  ubicar(V(0, 0.5, -6.0)); izq.stick(1, 0); seg(5); izq.stick(0, 0);
  ok('con el stick tampoco se atraviesan las paredes', cabeza().x <= 1.2 - L.p.radioCabeza + 0.01, +cabeza().x.toFixed(3));
  // impulso desde una baranda
  const bar = A.estacion.barandas.segmentos.find((s) => s.a.z < -0.5 && s.b.z > -4.5 || s.b.z < -0.5 && s.a.z > -4.5);
  const pb = bar.a.clone().lerp(bar.b, 0.5);
  ubicar(pb.clone().add(V(pb.x > 0 ? -0.35 : 0.35, pb.y > 0 ? -0.3 : 0.3, 0)));
  der.en(pb); pasos(2); der.grip(1); pasos(2);
  ok('barandas: la mano derecha se agarra con el grip', der.mano.agarre && der.mano.agarre.tipo === 'baranda', der.mano.agarre && der.mano.agarre.tipo);
  const cA = cabeza(); for (let i = 0; i < 10; i++) { der.g.position.z += 0.01; pasos(1); }
  const corrido = cabeza().sub(cA);
  der.grip(0); pasos(2);
  ok('barandas: tirar de la mano mueve el cuerpo al revés y al soltar queda el impulso', corrido.z < -0.05 && L.velocidad.z < -0.3, [+corrido.z.toFixed(3), +L.velocidad.z.toFixed(3)]);

  // ---- mapa
  ubicar(V(0.1, 0.1, -2.0)); A.navegacion.cancelar(); pasos(2);
  izq.gatillo(0.4); pasos(3);
  ok('mapa: una presión leve del gatillo izquierdo no lo abre', !A.mapa.abierto);
  izq.gatillo(1); pasos(2); izq.gatillo(0); seg(0.4);
  const pm = A.mapa.panel.malla, dMapa = pm.position.distanceTo(cabeza());
  ok('mapa: el gatillo del índice izquierdo lo abre', A.mapa.abierto && pm.visible);
  ok('mapa: aparece delante, entre 50 cm y 1 m, mirando al usuario', dMapa > 0.45 && dMapa < 1.0 && pm.position.clone().sub(cabeza()).normalize().dot(A.camera.getWorldDirection(new T.Vector3())) > 0.95 && V(0, 0, 1).transformDirection(pm.matrixWorld).dot(cabeza().sub(pm.position).normalize()) > 0.95, +dMapa.toFixed(2));
  ok('mapa: no queda metido en una pared', A.estacion.colisiones.puntoMasCercano(pm.position.clone(), 0.2, new T.Vector3()) === Infinity);
  const p0 = pm.position.clone(); izq.stick(0.3, 0); seg(0.3); izq.stick(0, 0); der.boton(4, 1); seg(0.5); der.boton(4, 0);
  ok('mapa: queda quieto en el espacio (no va pegado a la cabeza)', pm.position.distanceTo(p0) < 1e-9 && cabeza().distanceTo(V(0.1, 0.1, -2.0)) > 0.02);
  ok('mapa: marca el módulo actual', A.navegacion.actual === 'rivera' && A.mapa._estadoDe('rivera') === 'actual', A.navegacion.actual);
  const lugares = A.mapa.panel.botones.filter((b) => b.id.startsWith('lugar:')).map((b) => b.id.slice(6));
  ok('mapa: tiene los seis módulos, la esclusa y los tres puntos del exterior', ['carguero', 'colonia', 'rivera', 'nodo', 'tacuarembo', 'cupula', 'esclusa', 'junta_solar', 'antena', 'conector_radiador'].every((x) => lugares.includes(x)), lugares);
  der.en(cabeza().add(V(0.25, -0.2, -0.2))); pasos(1);
  const elegidos = [];
  for (const id of ['colonia', 'cupula', 'antena', 'tacuarembo']) { apretar(der, A.mapa.panel, `lugar:${id}`); if (A.mapa.seleccion === id) elegidos.push(id); }
  ok('mapa: los módulos se seleccionan con el rayo de la mano derecha', elegidos.length === 4, elegidos);
  ok('mapa: el gatillo derecho sobre el mapa no lo cierra', A.mapa.abierto);
  apretar(der, A.mapa.panel, 'lugar:colonia');
  ok('mapa: «guiarme» arma la ruta física', apretar(der, A.mapa.panel, 'guiar') && A.navegacion.destino === 'colonia' && A.navegacion.distancia > 2, +A.navegacion.distancia.toFixed(2));
  izq.gatillo(1); pasos(2); izq.gatillo(0); seg(0.4);
  ok('mapa: el gatillo izquierdo lo cierra', !A.mapa.abierto && !pm.visible);
  // seguir la guía volando con el stick
  let llego = ''; const alLlegar = A.navegacion.alLlegar; A.navegacion.alLlegar = (id) => { llego = id; alLlegar(id); };
  const dist0 = A.navegacion.distancia;
  ubicar(V(0, 0, -2.5)); A.rig.quaternion.identity(); let t = 0;
  for (; t < 30 && !llego; t += 0.25) {
    const meta = V(...[-0.2, 0.15, -5.6]).sub(cabeza());
    const d = meta.length(); meta.normalize();
    izq.stick(meta.x, meta.z); izq.boton(5, meta.y > 0.2 ? 1 : 0); izq.boton(4, meta.y < -0.2 ? 1 : 0);
    der.boton(4, d < 0.8 ? 1 : 0);
    seg(0.25);
  }
  izq.stick(0, 0); izq.boton(4, 0); izq.boton(5, 0); der.boton(4, 0);
  ok('guía: se llega a Colonia por el pasillo, pasando la escotilla, y avisa la llegada', llego === 'colonia' && A.navegacion.actual === 'colonia', `${llego} en ${t.toFixed(1)} s (${dist0.toFixed(1)} m)`);
  ok('mapa: registra los módulos visitados', A.navegacion.visitados.has('rivera') && A.navegacion.visitados.has('colonia'), [...A.navegacion.visitados]);
  A.navegacion.alLlegar = alLlegar;
  // traslado con fundido
  izq.gatillo(1); pasos(2); izq.gatillo(0); seg(0.4);
  der.en(cabeza().add(V(0.25, -0.2, -0.2))); pasos(1);
  apretar(der, A.mapa.panel, 'lugar:tacuarembo'); apretar(der, A.mapa.panel, 'ir');
  ok('traslado: hay un fundido antes de mover', A.transicion.activa && A.navegacion.actual === 'colonia');
  seg(2.5);
  ok('traslado: deja en el módulo elegido y cierra el mapa', A.navegacion.actual === 'tacuarembo' && !A.transicion.activa && !A.mapa.abierto, A.navegacion.actual);
  A.rig.quaternion.identity();

  // =========================================================================================== FASE 3
  fase('FASE 3 · Actividades: acceso, inicio, juego completo y resultados');
  const E = (id) => G.obtener(id).estado;
  const terminal = (id, n = 0) => A.terminales.filter((t) => t.nombre === `Terminal_${id}`)[n];
  const frenteA = (panel, d) => { panel.malla.updateWorldMatrix(true, false); return panel.malla.getWorldPosition(new T.Vector3()).addScaledVector(V(0, 0, 1).transformDirection(panel.malla.matrixWorld), d); };
  const cerrarInforme = () => { if (!A.panelInforme.malla.visible) return false; der.en(cabeza().add(V(0.2, -0.2, -0.15))); return apretar(der, A.panelInforme, 'cerrar') && !A.panelInforme.malla.visible; };
  const leerContenedor = (h, c) => {
    const haciaElEje = V(-c.posicion.x, -c.posicion.y, 0); if (haciaElEje.lengthSq() < 0.01) haciaElEje.set(0, 0, 1); haciaElEje.normalize();
    L.teletransportar(c.posicion.clone().addScaledVector(haciaElEje, 0.8)); L.velocidad.set(0, 0, 0);
    apuntarHerramienta(h, c.posicion.clone(), 0.5, c.posicion.clone().addScaledVector(haciaElEje, c.radio + 0.35));
    h.clic();
    return A.escaneres.find((x) => x.flotante === h.mano.sostiene).ultima;
  };
  const colocar = (h, c, hueco) => {
    c.velocidad.set(0, 0, 0);
    // el cuerpo se para del lado del pasillo y se deja asentar antes de estirar la mano
    const alEje = V(-c.posicion.x, -c.posicion.y, 0); if (alEje.lengthSq() < 0.01) alEje.set(0, 0, 1); alEje.normalize();
    L.teletransportar(c.posicion.clone().addScaledVector(alEje, 0.55)); L.velocidad.set(0, 0, 0); pasos(3); L.velocidad.set(0, 0, 0);
    h.en(c.posicion.clone().addScaledVector(alEje, c.radio * 0.5)); pasos(2); h.grip(1); pasos(2);
    if (h.mano.sostiene !== c) return `no se pudo tomar (cerca: ${h.mano.objetoCercano && h.mano.objetoCercano.malla.name}; sostiene: ${h.mano.sostiene && h.mano.sostiene.malla.name}; agarre: ${h.mano.agarre && h.mano.agarre.tipo}; baranda a ${A.estacion.barandas.masCercana(h.mano.posicion, 0.5, new T.Vector3()).toFixed(2)}; visible ${c.malla.visible}; mano a ${h.mano.posicion.distanceTo(c.posicion).toFixed(2)}; dueño: ${c.mano && c.mano.lado}; cerrada ${h.mano.cerrada})`;
    L.teletransportar(V(0, hueco.posicion.y, hueco.posicion.z)); L.velocidad.set(0, 0, 0); pasos(3); L.velocidad.set(0, 0, 0);
    h.en(hueco.posicion.clone()); pasos(3);
    h.en(hueco.posicion.clone().sub(c.posicion.clone().sub(h.mano.posicion))); pasos(3);
    h.grip(0); pasos(2);
    return c.datos.hueco === hueco ? '' : 'no quedó en el hueco';
  };
  ok('gestor: cinco actividades registradas; la caminata espacial arranca bloqueada y el resto disponible', G.lista().length === 5 && E('eva') === 'BLOQUEADA' && ['recepcion', 'almacenamiento', 'inventario', 'mantenimiento'].every((x) => E(x) === 'DISPONIBLE'), G.lista().map((a) => `${a.id}:${a.estado}`));
  ok('acceso: hay un terminal físico por actividad (seis paneles)', A.terminales.length === 6 && ['recepcion', 'almacenamiento', 'inventario', 'mantenimiento', 'eva'].every((x) => terminal(x)), A.terminales.map((t) => t.nombre));

  // ---- RECEPCIÓN: se inicia desde el terminal de Colonia
  let term = terminal('recepcion');
  ubicar(frenteA(term, 0.9)); der.en(frenteA(term, 0.5).add(V(0.1, -0.1, 0)));
  ok('recepción: el botón INICIAR del terminal responde al rayo y al gatillo', apretar(der, term, 'iniciar') && G.activa && G.activa.id === 'recepcion' && E('recepcion') === 'ACTIVA');
  ok('recepción: al iniciar aparecen las instrucciones', A.panelInforme.malla.visible && A.panelInforme.botones.some((b) => b.id === 'cerrar'));
  ok('recepción: las instrucciones se cierran con su botón', cerrarInforme());
  let act = G.obtener('recepcion');
  ok('recepción: seis pasos (cinco bultos del manifiesto y una discrepancia)', act.pasos.length === 6 && act.pasos.slice(0, 5).every((p) => I.porCodigo.has(p.id)), act.pasos.map((p) => p.id));
  // pausa y reanudación desde el terminal
  ubicar(frenteA(term, 0.9)); der.en(frenteA(term, 0.5).add(V(0.1, -0.1, 0)));
  apretar(der, term, 'pausar'); const tPausa = act.tiempo; seg(1);
  ok('recepción: PAUSAR detiene el reloj', E('recepcion') === 'PAUSADA' && act.tiempo === tPausa);
  apretar(der, term, 'seguir'); seg(0.5);
  ok('recepción: SEGUIR la reanuda', E('recepcion') === 'ACTIVA' && act.tiempo > tPausa);
  A.acciones.reunirHerramientas(); pasos(2);
  ubicar(fe.posicion.clone().add(V(-0.3, 0.1, 0.35))); ok('recepción: se toma la pistola lectora', tomar(der, fe)); seg(0.4);
  izq.en(V(-0.4, -0.5, -9));
  const ajeno = I.bultos.find((b) => b.legible && b.ubicacion.startsWith('RIV'));
  leerBulto(der, ajeno);
  ok('recepción: escanear un bulto que no está en el manifiesto cuenta un error', act.errores === 1 && A.aviso.tono === 'error', A.aviso.texto);
  for (const p of act.pasos.slice(0, 5)) leerBulto(der, I.porCodigo.get(p.id));
  ok('recepción: los cinco bultos del manifiesto quedan recibidos al escanearlos', act.hechos === 5 && E('recepcion') === 'ACTIVA', act.hechos);
  leerBulto(der, I.porCodigo.get(act.pasos[0].id));
  ok('recepción: repetir un bulto no suma pasos ni errores', act.hechos === 5 && act.errores === 1);
  leerBulto(der, I.bultos.find((b) => !b.legible));
  ok('recepción: la discrepancia la completa', E('recepcion') === 'COMPLETADA' && !G.activa && act.resultado?.completada, act.resultado);
  ok('recepción: se muestra el resumen con puntaje, tiempo y errores', A.panelInforme.malla.visible && act.resultado?.puntaje === 90 && act.resultado.errores === 1 && act.resultado.pasos === 6, act.resultado?.puntaje);
  cerrarInforme();

  // ---- ALMACENAMIENTO: se inicia desde la tablet
  soltar(der); A.acciones.reunirHerramientas(); pasos(2);
  ubicar(ft.posicion.clone().add(V(0.3, 0.1, 0.3))); tomar(izq, ft); izq.g.quaternion.setFromAxisAngle(V(1, 0, 0), 1.0); seg(0.5);
  der.en(tab.panel.malla.getWorldPosition(new T.Vector3()).addScaledVector(frenteTablet(), 0.3).add(V(0.12, 0, 0))); pasos(2);
  if (tab.pagina !== 'inicio') apretar(der, tab.panel, 'volver');
  apretar(der, tab.panel, 'ir:ordenes');
  ok('almacenamiento: se inicia desde las órdenes de trabajo de la tablet', apretar(der, tab.panel, 'inicio:almacenamiento') && E('almacenamiento') === 'ACTIVA');
  ok('gestor: con una actividad en curso no se puede iniciar otra', G.impedimento('inventario') !== '' && !G.iniciar('inventario'), G.impedimento('inventario'));
  cerrarInforme(); soltar(izq); izq.g.quaternion.identity(); A.acciones.reunirHerramientas(); pasos(2);
  act = G.obtener('almacenamiento');
  ok('almacenamiento: tres contenedores para guardar', act.pasos.length === 3, act.pasos.map((p) => p.texto));
  ubicar(fe.posicion.clone().add(V(-0.3, 0.1, 0.35))); tomar(der, fe); seg(0.4);
  const fallas = [];
  act.pasos.forEach((p, i) => {
    const c = I.contenedores.find((x) => x.datos.codigo === p.id), h = I.huecos.find((x) => x.codigo === c.datos.destino);
    const lec = leerContenedor(der, c);
    if (!lec || !lec.ok || lec.codigo !== p.id || lec.destino !== h.codigo) fallas.push(`${p.id}: lectura ${lec && lec.motivo}`);
    if (i === 0) {
      const otroHueco = I.huecos.find((x) => !x.ocupado && x.codigo !== h.codigo && !I.contenedores.some((k) => k.datos.destino === x.codigo));
      const r1 = colocar(izq, c, otroHueco);
      if (r1 || act.errores !== 1) fallas.push(`${p.id}: lugar equivocado ${r1} errores ${act.errores}`);
    }
    const r2 = colocar(izq, c, h);
    if (r2) fallas.push(`${p.id}: ${r2}`);
  });
  ok('almacenamiento: la pistola dice el hueco de cada contenedor y soltarlo ahí lo asegura (con un error a propósito)', fallas.length === 0 && act.errores === 1, fallas);
  ok('almacenamiento: completada, con su resumen', E('almacenamiento') === 'COMPLETADA' && act.resultado?.pasos === 3 && A.panelInforme.malla.visible, act.resultado);
  cerrarInforme();

  // ---- INVENTARIO: se inicia desde el mapa
  ubicar(V(0.1, 0.1, -2.0)); izq.en(V(-0.2, -0.3, -2.2)); pasos(2);
  izq.gatillo(1); pasos(2); izq.gatillo(0); seg(0.4);
  ok('mapa: la mano que lleva una herramienta no apunta a los paneles (su gatillo es de la herramienta)', (() => { der.en(cabeza().add(V(0.25, -0.2, -0.2))); const antes = esc.lecturas; apretar(der, A.mapa.panel, 'lugar:colonia'); return A.mapa.seleccion !== 'colonia' && esc.lecturas === antes + 1; })());
  izq.en(cabeza().add(V(-0.25, -0.2, -0.2))); apretar(izq, A.mapa.panel, 'lugar:rivera');
  ok('inventario: se inicia desde el mapa con la mano izquierda (actividad del módulo seleccionado)', apretar(izq, A.mapa.panel, 'act:inventario') && E('inventario') === 'ACTIVA' && !A.mapa.abierto);
  ok('mapa: el gatillo izquierdo sobre un botón no cierra ni reabre el mapa', !A.mapa.abierto);
  soltar(der); izq.en(cabeza().add(V(-0.2, -0.2, -0.15))); apretar(izq, A.panelInforme, 'cerrar'); izq.en(V(-0.4, -0.5, -9));
  ubicar(fe.posicion.clone().add(V(-0.3, 0.1, 0.35))); tomar(der, fe); seg(0.4); izq.en(V(-0.4, -0.5, -9));
  act = G.obtener('inventario');
  const estante = act.datos.estante;
  ok('inventario: el conteo es de una estantería de Rivera', /^RIV-E\d$/.test(estante) && act.pasos.length >= 4, `${estante}: ${act.pasos.length} bultos`);
  leerBulto(der, I.bultos.find((b) => b.legible && b.ubicacion.startsWith('RIV-B')));
  ok('inventario: un bulto de otra estantería cuenta como error', act.errores === 1, A.aviso.texto);
  for (const p of act.pasos.slice()) leerBulto(der, I.porCodigo.get(p.id));
  ok('inventario: escaneados todos, queda completada', E('inventario') === 'COMPLETADA' && act.resultado?.pasos === act.resultado?.total, act.resultado);
  cerrarInforme(); soltar(der); A.acciones.reunirHerramientas(); pasos(2);

  // ---- MANTENIMIENTO: terminal del taller
  term = terminal('mantenimiento');
  ubicar(frenteA(term, 0.9)); der.en(frenteA(term, 0.5).add(V(0.1, -0.1, 0)));
  ok('mantenimiento: se inicia desde el terminal del taller', apretar(der, term, 'iniciar') && E('mantenimiento') === 'ACTIVA');
  cerrarInforme();
  act = G.obtener('mantenimiento');
  const adentro = (t) => F.objetos.find((f) => f.tipo === t && !f.mano && Math.abs(f.posicion.x) < 1.5);
  ok('mantenimiento: cuatro puntos marcados, cada uno con su herramienta', act.pasos.length === 4 && A.inspecciones.puntos.filter((p) => p.activo).length === 4 && A.inspecciones.marcas.count === 4, A.inspecciones.puntos.filter((p) => p.activo).map((p) => `${p.id}:${p.herramienta}`));
  const trabajar = (h, punto, s) => {
    const f = h.mano.sostiene, aDistancia = ['linterna', 'inspector', 'escaner'].includes(f.tipo);
    const haciaElEje = V(-punto.posicion.x, -punto.posicion.y, 0).normalize();
    L.teletransportar(punto.posicion.clone().addScaledVector(haciaElEje, 0.8)); L.velocidad.set(0, 0, 0);
    apuntarHerramienta(h, punto.posicion.clone(), 0.5, punto.posicion.clone().addScaledVector(haciaElEje, aDistancia ? 0.5 : 0.06));
    h.gatillo(1); seg(s); h.gatillo(0); pasos(2);
  };
  const pFiltro = A.inspecciones.punto('filtro_co2');
  ubicar(adentro('medidor').posicion.clone().add(V(-0.4, 0.1, 0.2))); tomar(der, adentro('medidor')); seg(0.4);
  trabajar(der, pFiltro, 1.0);
  ok('mantenimiento: con la herramienta equivocada no avanza y cuenta un error', !pFiltro.hecho && act.errores === 1 && pFiltro.avance === 0, A.aviso.texto);
  soltar(der); A.acciones.reunirHerramientas(); pasos(2);
  const cortado = A.inspecciones.punto('soporte_vital');
  ubicar(adentro('inspector').posicion.clone().add(V(-0.4, 0.1, 0.2))); tomar(der, adentro('inspector')); seg(0.4);
  trabajar(der, cortado, 0.7);
  const avanceParcial = cortado.avance;
  ok('mantenimiento: soltar el gatillo antes de tiempo no completa el punto', !cortado.hecho && avanceParcial > 0.2 && avanceParcial < 0.8, +avanceParcial.toFixed(2));
  soltar(der); A.acciones.reunirHerramientas(); pasos(2);
  const hechosM = [];
  for (const p of A.inspecciones.puntos.filter((x) => x.activo)) {
    const h = adentro(p.herramienta);
    ubicar(h.posicion.clone().add(V(h.posicion.x > 0 ? -0.4 : 0.4, 0.1, 0.2)));
    if (!tomar(der, h)) { hechosM.push(`${p.id}: no se toma ${p.herramienta}`); continue; }
    seg(0.4); trabajar(der, p, p.segundos + 1.2);
    if (!act.pasos.find((x) => x.id === p.id).hecho) hechosM.push(`${p.id}: sin completar (${p.avance.toFixed(2)})`);
    soltar(der); A.acciones.reunirHerramientas(); pasos(2);
  }
  ok('mantenimiento: los cuatro puntos se completan con linterna, inspector, medidor y llave', hechosM.length === 0, hechosM);
  ok('mantenimiento: completada; se apagan las marcas', E('mantenimiento') === 'COMPLETADA' && (() => { pasos(2); return A.inspecciones.marcas.count === 0; })(), act.resultado);
  ok('gestor: al completar el mantenimiento se desbloquea la caminata espacial', E('eva') === 'DISPONIBLE');
  cerrarInforme();
  // abandono y falla por tiempo
  G.iniciar('inventario'); G.abandonar();
  ok('gestor: DEJAR una actividad la devuelve a disponible sin resultado nuevo', !G.activa && E('inventario') === 'DISPONIBLE');
  cerrarInforme();

  // =========================================================================================== FASE 4
  fase('FASE 4 · Exterior de la estación');
  const X = A.exterior;
  ok('exterior: no se dibuja desde los módulos cerrados', !X.grupo.visible);
  ubicar(V(0.05, -1.95, 2.11)); pasos(3);
  ok('exterior: se ve desde la Cúpula', A.navegacion.actual === 'cupula' && X.grupo.visible);
  let tri = 0; X.grupo.traverse((o) => { if (o.isMesh && o.geometry) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); });
  let mallas = 0; X.grupo.traverse((o) => { if (o.isMesh) mallas++; });
  ok('exterior: modelo completo en pocas mallas', mallas <= 12 && tri > 5000, `${mallas} mallas, ${Math.round(tri)} triángulos`);
  const caja = new T.Box3().setFromObject(A.estacion.grupo), cajaX = new T.Box3().setFromObject(X.grupo);
  ok('exterior: envuelve al interior (los cascos cubren los seis módulos)', cajaX.min.z <= caja.min.z + 0.3 && cajaX.max.z >= caja.max.z - 0.3 && cajaX.max.x > 2 && cajaX.max.y > 2, [cajaX.min, cajaX.max].map((v) => v.toArray().map((x) => +x.toFixed(1))));
  ok('paneles solares: dos alas sobre su mástil', X.paneles.alas.length >= 2, X.paneles.alas.length);
  const err0 = X.paneles.error; for (let i = 0; i < 72 * 30; i++) X.actualizar(1 / 72);
  ok('paneles solares: giran despacio hasta quedar de frente al sol (2,2°/s)', err0 > 40 && X.paneles.error < 3, [+err0.toFixed(1), +X.paneles.error.toFixed(2)]);
  const anguloAntes = X.paneles.angulo; for (let i = 0; i < 72 * 20; i++) X.actualizar(1 / 72);
  ok('paneles solares: después siguen al sol con un movimiento mínimo', Math.abs(X.paneles.angulo - anguloAntes) > 1e-4 && Math.abs(X.paneles.angulo - anguloAntes) < 0.08, +(X.paneles.angulo - anguloAntes).toFixed(4));
  const an = X.antenas.antenas; const ac0 = an.map((a) => a.acimut); let seMueve = false, sePara = false;
  for (let i = 0; i < 72 * 120; i++) { X.actualizar(1 / 72); if (X.antenas.enMovimiento) seMueve = true; else if (seMueve) sePara = true; }
  ok('antenas: hay al menos dos, giran hacia un objetivo nuevo y se detienen al alcanzarlo', an.length >= 2 && seMueve && sePara && an.some((a, i) => Math.abs(a.acimut - ac0[i]) > 0.3), an.map((a) => +a.acimut.toFixed(2)));
  ok('exterior: pasamanos para la caminata', X.pasamanos.length >= 20, X.pasamanos.length);
  const lado = V(2.4, 0, 2.0), abajo = V(0, -2.4, 2.0); X.colisiones.activo = true;
  const tocaLado = X.colisiones.puntoMasCercano(lado, 0.9, new T.Vector3()) !== Infinity, tocaAbajo = X.colisiones.puntoMasCercano(V(0, -1.76, 2.0), 0.25, new T.Vector3()) !== Infinity;
  X.colisiones.activo = false; void abajo;
  ok('exterior: el casco del Nodo es cerrado del lado de la esclusa y abierto abajo, donde sale la Cúpula', tocaLado && !tocaAbajo, [tocaLado, tocaAbajo]);

  // =========================================================================================== FASE 5
  fase('FASE 5 · Caminata espacial');
  const EV = A.eva, ES = { salida: V(2.55, 0, 2.11), interior: V(0.85, 0, 2.11) };
  const tIn = terminal('eva', 0), tOut = terminal('eva', 1);
  ubicar(V(0, 0, 1.2)); der.en(V(0.3, -0.1, 1.4));
  apretar(der, tIn, 'iniciar');
  ok('caminata: la actividad se inicia en el terminal de la esclusa', E('eva') === 'ACTIVA');
  cerrarInforme();
  ubicar(V(-0.6, 0, 0.9)); der.en(V(-0.3, -0.1, 1.0));
  apretar(der, tIn, 'extra');
  ok('esclusa: lejos de la escotilla no deja salir y dice por qué', !EV.afuera && !A.transicion.activa && A.aviso.tono === 'error', A.aviso.texto);
  ubicar(V(0.45, 0.0, 2.3)); der.en(V(0.6, -0.1, 2.5));
  const qAntes = A.rig.quaternion.clone();
  apretar(der, tIn, 'extra');
  ok('esclusa: cerca, el botón SALIR AL EXTERIOR inicia la transición', A.transicion.activa && !EV.afuera);
  seg(0.3); ok('esclusa: durante la transición no se puede mover', (() => { izq.stick(0, -1); seg(0.3); izq.stick(0, 0); return L.velocidad.length() < 0.01; })());
  seg(3);
  ok('caminata: aparece afuera, frente a la escotilla, con la misma orientación', EV.afuera && cabeza().distanceTo(ES.salida) < 0.05 && A.rig.quaternion.angleTo(qAntes) < 1e-6, cabeza().toArray().map((x) => +x.toFixed(2)));
  ok('caminata: traje puesto (guantes presurizados, casco con indicadores, cable a la vista)', M.grosor === 1.28 && EV.casco.visible && EV.hud.malla.visible && EV.cable.linea.visible && X.grupo.visible && X.colisiones.activo);
  ok('caminata: el paso «salir» queda hecho y el mapa dice «exterior»', G.obtener('eva').pasos[0]?.hecho && A.navegacion.actual === 'exterior');
  // el casco exterior es sólido
  izq.stick(-1, 0); seg(5); izq.stick(0, 0); der.boton(4, 1); seg(2); der.boton(4, 0);
  ok('caminata: empujando hacia la escotilla, el casco frena (no se entra sin el procedimiento)', cabeza().x >= 1.70 + L.p.radioCabeza, +cabeza().x.toFixed(3));
  ubicar(V(0.3, 3.3, -2.0)); izq.boton(4, 1); seg(5); izq.boton(4, 0); der.boton(4, 1); seg(2); der.boton(4, 0);
  ok('caminata: desde afuera no se atraviesa el casco (Rivera, radio 2,10 m)', Math.hypot(cabeza().x, cabeza().y) >= 2.10 + L.p.radioCabeza - 0.02, +Math.hypot(cabeza().x, cabeza().y).toFixed(3));
  // pasamanos exterior
  const cerca = X.pasamanos.map((s2) => ({ s: s2, m: s2.a.clone().lerp(s2.b, 0.5) })).sort((a, b) => a.m.distanceTo(ES.salida) - b.m.distanceTo(ES.salida))[0];
  const afueraDe = cerca.m.clone().add(V(cerca.m.x, cerca.m.y, 0).normalize().multiplyScalar(0.55));
  ubicar(afueraDe); der.en(cerca.m); pasos(2); der.grip(1); pasos(2);
  ok('caminata: la mano se agarra de un pasamanos exterior', der.mano.agarre && der.mano.agarre.tipo === 'baranda', cerca.m.toArray().map((x) => +x.toFixed(2)));
  const cE = cabeza(); for (let i = 0; i < 10; i++) { der.g.position.z += 0.01; pasos(1); }
  ok('caminata: anclado al pasamanos, tirar mueve el cuerpo', cabeza().z - cE.z < -0.05, +(cabeza().z - cE.z).toFixed(3));
  seg(1); ok('caminata: agarrado se queda quieto', L.velocidad.length() < 0.01);
  der.grip(0); pasos(2);
  // cable de seguridad
  ubicar(ES.salida.clone()); pulsos = 0;
  izq.stick(1, 0); let dMax = 0, aviso115 = false;
  for (let i = 0; i < 40 * 4; i++) { seg(0.25); dMax = Math.max(dMax, EV.cable.distancia); if (EV.cable.avisando) aviso115 = true; }
  const vTenso = L.velocidad.length();
  izq.stick(0, 0);
  ok('cable: empujando contra el cable tenso el cuerpo queda quieto, sin sacudidas', vTenso < 0.02, +vTenso.toFixed(4));
  ok('cable: avisa al pasar los 11,5 m (sonido y vibración)', aviso115 && pulsos > 0, pulsos);
  ok('cable: no deja alejarse más de 14 m aunque se siga empujando', dMax <= 14.0 + 0.01 && dMax > 13.9, +dMax.toFixed(3));
  seg(3);
  const haciaAncla = EV.cable.ancla.clone().sub(cabeza()).normalize();
  ok('cable: al dejar de empujar, trae al astronauta de vuelta despacio (hasta 0,25 m/s)', L.velocidad.dot(haciaAncla) > 0.15 && L.velocidad.length() <= 0.26 && EV.cable.distancia < 13.8, [+L.velocidad.dot(haciaAncla).toFixed(3), +EV.cable.distancia.toFixed(2)]);
  // guía por afuera
  A.acciones.guiar('antena'); seg(0.5);
  ok('guía: afuera marca el camino por los pasamanos hasta la antena', A.navegacion.destino === 'antena' && A.navegacion.ruta.length >= 3 && A.navegacion.flechas.count > 3, `${A.navegacion.ruta.length} tramos, ${A.navegacion.distancia.toFixed(1)} m`);
  A.navegacion.cancelar();
  // tareas: herramientas del soporte de la esclusa
  const afueraH = (t) => F.objetos.find((f) => f.tipo === t && !f.mano && f.posicion.x > 1.5);
  const insp = afueraH('inspector'), llaveX = afueraH('llave');
  ok('caminata: el inspector y la llave esperan en el soporte exterior de la esclusa', insp && llaveX && insp.posicion.distanceTo(ES.salida) < 1.2 && llaveX.posicion.distanceTo(ES.salida) < 1.2);
  ubicar(ES.salida.clone());
  ok('caminata: se toman con los guantes puestos', tomar(der, insp) && tomar(izq, llaveX)); seg(0.5);
  const trabajarAfuera = (h, id, s) => {
    const p = A.inspecciones.punto(id), radial = V(p.posicion.x, p.posicion.y, 0).normalize();
    L.teletransportar(p.posicion.clone().addScaledVector(radial, 0.9)); L.velocidad.set(0, 0, 0);
    const f = h.mano.sostiene, lejos = f.tipo === 'inspector';
    apuntarHerramienta(h, p.posicion.clone(), 0.5, p.posicion.clone().addScaledVector(radial, lejos ? 0.5 : 0.06));
    h.gatillo(1); seg(s); h.gatillo(0); pasos(2);
    return p.hecho;
  };
  const tareas = [trabajarAfuera(der, 'junta_solar', 3.2), trabajarAfuera(der, 'antena', 3.2), trabajarAfuera(izq, 'conector_radiador', 3.7)];
  ok('caminata: las tres tareas (junta solar, antena, conector del radiador) se completan con las herramientas', tareas.every(Boolean) && G.obtener('eva').hechos === 4, tareas);
  ok('caminata: el cable acompaña hasta los tres puntos de trabajo', ['junta_solar', 'antena', 'conector_radiador'].every((id) => A.inspecciones.punto(id).posicion.distanceTo(EV.cable.ancla) < 13), ['junta_solar', 'antena', 'conector_radiador'].map((id) => +A.inspecciones.punto(id).posicion.distanceTo(EV.cable.ancla).toFixed(1)));
  // regreso
  der.en(cabeza().add(V(0.2, -0.2, -0.2)));
  apretar(der, tOut, 'extra'); soltar(der); der.en(cabeza().add(V(0.2, -0.2, -0.2)));
  apretar(der, tOut, 'extra');
  ok('esclusa: lejos de la escotilla no deja entrar', EV.afuera && !A.transicion.activa, A.aviso.texto);
  ubicar(ES.salida.clone().add(V(0.2, 0, 0.2))); der.en(cabeza().add(V(0.2, -0.2, -0.2)));
  apretar(der, tOut, 'extra'); seg(3.5);
  ok('caminata: el terminal exterior devuelve al Nodo por la esclusa', !EV.afuera && cabeza().distanceTo(ES.interior) < 0.05 && A.navegacion.actual === 'nodo', cabeza().toArray().map((x) => +x.toFixed(2)));
  ok('caminata: adentro se saca el traje presurizado y se apaga el exterior', M.grosor === 1.12 && !EV.casco.visible && !EV.cable.linea.visible && !X.colisiones.activo);
  act = G.obtener('eva');
  ok('caminata: actividad completada, con su resumen', E('eva') === 'COMPLETADA' && act.resultado?.pasos === 5 && A.panelInforme.malla.visible, act.resultado);
  cerrarInforme(); soltar(izq); A.acciones.reunirHerramientas(); pasos(2);
  // reserva agotada: falla y vuelve sola
  G.iniciar('eva'); cerrarInforme();
  ubicar(V(0.45, 0.0, 2.3)); der.en(V(0.6, -0.1, 2.5)); apretar(der, tIn, 'extra'); seg(3.5);
  const afueraOtraVez = EV.afuera;
  ubicar(V(6, 3, 2)); G.tick(721); seg(3.5);
  ok('caminata: si se acaba la reserva de 12 minutos, la actividad falla y el cable trae de vuelta', afueraOtraVez && E('eva') === 'FALLIDA' && !EV.afuera && cabeza().distanceTo(ES.interior) < 0.05 && act.resultado && !act.resultado.completada, act.resultado?.motivo);
  ok('gestor: una actividad fallida se puede repetir', G.impedimento('eva') === '');
  cerrarInforme();

  // =========================================================================================== FASE 6
  fase('FASE 6 · Costo por cuadro (lógica del juego, sin dibujar, en esta PC)');
  ubicar(V(0.1, 0.1, -2.0)); pasos(5);
  let t0 = performance.now(); pasos(600); const msDentro = (performance.now() - t0) / 600;
  ok('lógica de un cuadro adentro: menos de 2 ms', msDentro < 2, +msDentro.toFixed(3));
  A.renderer.xr.isPresenting = false; A.camera.rotation.set(0, 0, 0);
  const llamadas = {};
  for (const [id, pos] of [['rivera', [0.1, 0.1, 0.0]], ['tacuarembo', [0.15, 0.05, 5.6]], ['nodo', [0.2, 0.1, 2.4]], ['colonia', [-0.2, 0.15, -5.6]]]) {
    A.renderer.xr.isPresenting = true; ubicar(V(...pos)); pasos(3); A.renderer.xr.isPresenting = false;
    A.renderer.render(A.scene, A.camera); llamadas[id] = A.renderer.info.render.calls;
  }
  A.renderer.xr.isPresenting = true;
  ok('llamadas de dibujo adentro: menos de 100 en todos los módulos', Object.values(llamadas).every((n) => n < 100), llamadas);
  return { R };
}
"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"),
                                    args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 640, "height": 360})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(os.environ.get("URL", "http://localhost:8765/artigas1/"))
        await pg.wait_for_function("!!window.artigas1", timeout=120000)
        try:
            res = await pg.evaluate(JS)
        except Exception as e:  # noqa: BLE001
            print("ERROR EN LAS PRUEBAS:", str(e)[:3000])
            await b.close()
            raise SystemExit(2)
        # quien ya había jugado la versión anterior (giro suave guardado en el navegador) pasa al modo de confort
        pg2 = await b.new_page(viewport={"width": 320, "height": 180})
        await pg2.add_init_script("window.localStorage.setItem('artigas1.ajustes', JSON.stringify({ giro: 'suave', giroVertical: true, velocidad: 1.25, calibracionManos: 3 }))")
        await pg2.goto(os.environ.get("URL", "http://localhost:8765/artigas1/"))
        await pg2.wait_for_function("!!window.artigas1", timeout=120000)
        aj = await pg2.evaluate("(() => { const a = window.artigas1.ajustes; return [a.giro, a.giroVertical, a.tunel, a.velocidad, a.calibracionManos, a.version]; })()")
        res["R"].append({"fase": "Ajustes guardados de la versión anterior"})
        res["R"].append({"nombre": "confort: el giro suave guardado pasa a pasos con parpadeo y se conservan velocidad y manos", "pasa": aj == ["pasos", False, "medio", 1.25, 3, 2], "dato": aj})
        await pg2.close()
        mal = total = 0
        for r in res["R"]:
            if "fase" in r:
                print("\n" + r["fase"])
                continue
            total += 1
            mal += not r["pasa"]
            print(("OK   " if r["pasa"] else "FALLA"), r["nombre"], "→", json.dumps(r["dato"], ensure_ascii=False))
        print(f"\n{total - mal} de {total}")
        print(errs[:5])
        await b.close()
        raise SystemExit(1 if mal or errs else 0)


asyncio.run(main())
