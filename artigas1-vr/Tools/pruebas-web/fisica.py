"""Pruebas de física del recorrido web de Artigas-1 en un navegador sin interfaz (Playwright + Chrome).

Corren sobre la estación real: paredes, racks, escotillas, inercia, barandas, 300 lanzamientos al azar,
los objetos flotantes (deriva, choques, agarre y empuje) y el entorno orbital.

    cd web-dashboard/public && python3 -m http.server 8765 &
    pip install playwright && python3 artigas1-vr/Tools/pruebas-web/fisica.py

CHROME cambia el ejecutable (por defecto /usr/bin/google-chrome); URL, la dirección del recorrido.
"""
import os
import asyncio, json
from playwright.async_api import async_playwright
JS = r"""
() => {
  const A = window.artigas1, T = A.THREE, L = A.loco, col = A.estacion.colisiones;
  A.renderer.setAnimationLoop(null);                 // las pruebas manejan el tiempo
  const cero = new T.Vector3(), R = [];
  const ok = (nombre, pasa, dato) => R.push({ nombre, pasa: !!pasa, dato });
  const cabeza = () => A.camera.getWorldPosition(new T.Vector3());
  const paso = (dt, manos = [], empuje = cero, freno = false, puertas = false) => {
    L.actualizar(dt, manos, empuje, freno);
    if (puertas) { const c = cabeza(); for (const e of A.estacion.escotillas) e.actualizar(dt, c); }
  };
  const cerrarPuertas = () => { for (const e of A.estacion.escotillas) { e.avance = 0; e.malla.position.copy(e.cerrada); e.colision.activo = true; } };
  const lanzar = (pos, vel, seg, dt = 1 / 72, puertas = false) => {
    L.teletransportar(new T.Vector3(...pos)); L.velocidad.set(...vel);
    let max = { x: -9, y: -9, z: -99 }, min = { x: 9, y: 9, z: 99 };
    for (let t = 0; t < seg; t += dt) {
      paso(dt, [], cero, false, puertas);
      const c = cabeza();
      for (const k of 'xyz') { max[k] = Math.max(max[k], c[k]); min[k] = Math.min(min[k], c[k]); }
    }
    return { max, min, fin: cabeza(), v: L.velocidad.clone() };
  };
  const r = L.p.radioCabeza;

  // 1. Pared lateral de Colonia (x = 1,2), a distintas velocidades y con cuadros largos
  cerrarPuertas();
  for (const [v, dt] of [[0.3, 1 / 72], [1.5, 1 / 72], [3, 1 / 72], [3, 1 / 20], [12, 1 / 72]]) {
    const s = lanzar([0, 0.5, -6.0], [v, 0, 0], 4, dt);
    ok(`pared a ${v} m/s (dt ${dt.toFixed(3)})`, s.max.x <= 1.2 - r + 0.01, +s.max.x.toFixed(3));
  }
  // 2. Techo y piso
  let s = lanzar([0, 0, -6.0], [0, 2.5, 0], 3); ok('techo', s.max.y <= 1.2 - r + 0.01, +s.max.y.toFixed(3));
  s = lanzar([0, 0, -6.0], [0, -2.5, 0], 3); ok('piso (cabeza y torso)', s.min.y >= -1.2 + r + L.p.alturaTorso - 0.01, +s.min.y.toFixed(3));
  // 3. Mamparo de Rivera lejos de la escotilla (z = +0,45): no se pasa al Nodo
  s = lanzar([0.9, 0.2, -1.0], [0, 0, 2.5], 3); ok('mamparo', s.max.z <= 0.45 - r + 0.01, +s.max.z.toFixed(3));
  // 4. Rack con bolsa: la cabeza no entra en un hueco ocupado; busca una bolsa de estribor
  const bolsa = A.estacion.cargas.find((c) => /RIV-E/.test(c.nombre));
  const pb = new T.Vector3().setFromMatrixPosition(bolsa.matriz);
  s = lanzar([0, pb.y, pb.z], [2, 0, 0], 3); ok('contenedor en el rack', s.max.x <= 1.2 - r + 0.02, +s.max.x.toFixed(3));
  // 5. Escotilla cerrada (puertas sin actualizar): desde Rivera hacia Colonia por el eje
  cerrarPuertas();
  s = lanzar([0, 0, -3.5], [0, 0, -2], 4); ok('escotilla cerrada bloquea', s.min.z > -4.95, +s.min.z.toFixed(3));
  // 6. Escotilla automática: se abre al acercarse y se pasa a Colonia
  cerrarPuertas();
  s = lanzar([0, 0, -3.0], [0, 0, -0.8], 6, 1 / 72, true); ok('escotilla se abre y se pasa', s.min.z < -5.6, +s.min.z.toFixed(3));
  // 7. Puerto de acople 2 (cerrado siempre), desde el Nodo hacia +X
  s = lanzar([0, 0, 2.11], [2, 0, 0], 3, 1 / 72, true); ok('acople 2 cerrado', s.max.x <= 1.43 - r + 0.02, +s.max.x.toFixed(3));
  // 8. Inercia: empuje medio segundo y después nada
  L.teletransportar(new T.Vector3(0, 0, -6.5)); 
  const emp = new T.Vector3(0, 0, -1);
  for (let t = 0; t < 0.5; t += 1 / 72) paso(1 / 72, [], emp);
  const v0 = L.velocidad.length(), z0 = A.rig.position.z;
  for (let t = 0; t < 1; t += 1 / 72) paso(1 / 72);
  ok('inercia: conserva la velocidad sin empuje', L.velocidad.length() > v0 * 0.94 && A.rig.position.z < z0 - 0.4, { v0: +v0.toFixed(3), v1: +L.velocidad.length().toFixed(3) });
  // 9. Freno
  for (let t = 0; t < 2; t += 1 / 72) paso(1 / 72, [], cero, true);
  ok('freno detiene', L.velocidad.length() < 0.01, +L.velocidad.length().toFixed(4));
  // 10. Rebote amortiguado y tangencial conservada (pared x = 1,2; entra a 1 m/s con 1 m/s tangencial)
  s = lanzar([0.6, 0.3, -6.3], [1, 0, -0.5], 0.6);
  ok('rebote amortiguado', s.v.x < 0 && s.v.x > -0.35, +s.v.x.toFixed(3));
  ok('conserva la velocidad tangencial', Math.abs(s.v.z) > 0.42, +s.v.z.toFixed(3));
  // 11. Choque lento: no rebota
  s = lanzar([0.9, 0.3, -6.3], [0.15, 0, 0], 2); ok('choque lento sin rebote', Math.abs(s.v.x) < 0.01, +s.v.x.toFixed(4));
  // 12. Baranda: tomar, tirar y soltar
  const seg = A.estacion.barandas.segmentos.find((b) => /^C_BarandaC/.test(b.nombre));
  const medio = seg.a.clone().lerp(seg.b, 0.5);
  L.teletransportar(medio.clone().add(new T.Vector3(0, 0, 0)).setX(medio.x * 0.5).setY(medio.y * 0.5));
  const mano = { posicion: medio.clone(), cerrada: false, agarre: null };
  paso(1 / 72, [mano]);
  ok('la mano detecta la baranda', mano.cerca === 'baranda', mano.cerca);
  mano.cerrada = true; paso(1 / 72, [mano]);
  ok('la baranda se puede tomar', mano.agarre && mano.agarre.tipo === 'baranda', mano.agarre && mano.agarre.tipo);
  const eje = seg.b.clone().sub(seg.a).normalize();
  const antes = A.rig.position.clone();
  for (let i = 0; i < 18; i++) {           // la mano tira 1 cm por cuadro a lo largo de la baranda (0,72 m/s)
    // la mano es hija del cuerpo: su posición en el mundo acompaña al rig, más lo que se mueve el control
    mano.posicion.copy(mano.agarre.ancla).addScaledVector(eje, -0.01);
    paso(1 / 72, [mano]);
  }
  const corrido = A.rig.position.clone().sub(antes).dot(eje);
  ok('agarrado, el cuerpo sigue a la mano', Math.abs(corrido - 0.18) < 0.02, +corrido.toFixed(3));
  mano.cerrada = false; paso(1 / 72, [mano]);
  ok('al soltar sale con la velocidad del impulso', Math.abs(L.velocidad.dot(eje) - 0.72) < 0.08, +L.velocidad.dot(eje).toFixed(3));
  // 13. Apoyo en una pared (sin baranda cerca)
  L.teletransportar(new T.Vector3(0.7, 0.4, -7.6));
  const mano2 = { posicion: new T.Vector3(1.15, 0.4, -7.6), cerrada: true, agarre: null };
  paso(1 / 72, [mano2]);
  ok('la mano se apoya en una pared', mano2.agarre && mano2.agarre.tipo === 'apoyo', mano2.agarre && mano2.agarre.tipo);
  // 14. Las barandas no están en la capa de colisión del cuerpo
  const pt = new T.Vector3();
  const d = col.puntoMasCercano(medio, 0.5, pt);
  ok('las barandas no bloquean (capa aparte)', d > 0.05, +d.toFixed(3));
  // 15. Fuzz: 300 lanzamientos al azar desde cada módulo; nunca se sale del volumen de la estación
  let sem = 7; const az = () => { sem = (sem * 1664525 + 1013904223) >>> 0; return sem / 4294967296; };
  const inicios = [[0.2, 0.1, 6.3], [0.3, 0.1, 2.4], [0.05, -1.95, 2.11], [0.1, 0.1, -1.5], [-0.3, 0.2, -6.35], [0.05, 0.1, -10.2]];
  const adentro = (c) => (Math.abs(c.x) <= 1.72 && Math.abs(c.y) <= 1.72 && c.z > -12.0 && c.z < 7.0) ||
                         (c.y < -1.0 && c.y > -2.85 && Math.hypot(c.x, c.z - 2.11) < 1.45);
  let fugas = 0, peorPen = 0, lanz = 0; const centro = new T.Vector3();
  for (const ini of inicios) for (let i = 0; i < 50; i++) {
    const dir = new T.Vector3(az() * 2 - 1, az() * 2 - 1, az() * 2 - 1).normalize().multiplyScalar(0.3 + az() * 2.7);
    L.teletransportar(new T.Vector3(...ini)); L.velocidad.copy(dir); lanz++;
    const dt = az() < 0.3 ? 1 / 30 : 1 / 72;
    let fuera = false;
    for (let t = 0; t < 5; t += dt) { paso(dt, [], cero, false, true); if (!adentro(cabeza())) fuera = true; }
    if (fuera) fugas++;
    centro.copy(cabeza()); const antes2 = centro.clone();
    for (const sis of [col, ...A.estacion.escotillas.map((e) => e.colision)]) if (sis.activo) sis.resolverEsfera(centro, r);
    peorPen = Math.max(peorPen, centro.distanceTo(antes2));
  }
  ok(`fuzz: ${lanz} lanzamientos sin salir de la estación`, fugas === 0, fugas);
  ok('sin penetraciones persistentes', peorPen < 0.002, +peorPen.toFixed(5));
  // 17. Objetos sueltos: un minuto de deriva en toda la estación
  const F = A.flotantes, P = F.p;
  const lejos = P.distanciaActiva; P.distanciaActiva = 1e3;       // para la prueba se calculan todos
  cerrarPuertas();
  const sistemas = () => [col, ...A.estacion.escotillas.map((e) => e.colision)].filter((x) => x.activo);
  const inicio = F.objetos.map((f) => f.posicion.clone());
  const giro0 = F.objetos.map((f) => f.malla.quaternion.clone());
  let vMaxF = 0, fueraF = 0;
  const tF = performance.now();
  for (let i = 0; i < 60 * 72; i++) {
    F.actualizar(1 / 72, cero, [], cero, []);
    if (i % 72 === 0) for (const f of F.objetos) { vMaxF = Math.max(vMaxF, f.velocidad.length()); if (!adentro(f.posicion)) fueraF++; }
  }
  const msF = (performance.now() - tF) / (60 * 72);
  const corrido2 = F.objetos.map((f, i) => f.posicion.distanceTo(inicio[i]));
  ok(`flotantes: los ${F.objetos.length} siguen dentro de la estación`, fueraF === 0, fueraF);
  ok('flotantes: deriva lenta (menos de 6 cm/s)', vMaxF < 0.06, +vMaxF.toFixed(4));
  ok('flotantes: se mueven y giran', Math.min(...corrido2) > 0.002 && F.objetos.every((f, i) => f.malla.quaternion.angleTo(giro0[i]) > 0.02), +Math.min(...corrido2).toFixed(4));
  ok('flotantes: no se alejan de su zona', Math.max(...corrido2) < 1.2, +Math.max(...corrido2).toFixed(3));
  let peorF = 0; const cF = new T.Vector3();
  for (const f of F.objetos) { cF.copy(f.posicion); for (const sis of sistemas()) sis.resolverEsfera(cF, f.radio); peorF = Math.max(peorF, cF.distanceTo(f.posicion)); }
  ok('flotantes: ninguno queda metido en una pared', peorF < 0.002, +peorF.toFixed(5));
  const enPasillo = F.objetos.filter((f) => Math.abs(f.posicion.y) < 1.3 && Math.hypot(f.posicion.x, f.posicion.y) < 0.3).length;
  ok('flotantes: el eje de paso queda libre', enPasillo === 0, enPasillo);
  // 18. Lanzar un objeto contra una pared de Colonia
  const fl = F.objetos.find((f) => /C_Flot_Paquete/.test(f.malla.name));
  fl.posicion.set(0.3, 0.72, -7.95); fl.velocidad.set(2.4, 0.0, 0.1); fl.libre = true;   // tramo de pared sin equipos
  let xMaxF = -9; for (let i = 0; i < 3 * 72; i++) { F.actualizar(1 / 72, cero, [], cero, []); xMaxF = Math.max(xMaxF, fl.posicion.x); }
  ok('flotantes: un objeto lanzado rebota en la pared', xMaxF <= 1.2 - fl.radio + 0.01 && xMaxF > 0.9, +xMaxF.toFixed(3));
  // 19. Tomar con la mano, llevar y soltar
  fl.posicion.set(0.3, 0.3, -6.5); fl.velocidad.set(0, 0, 0);
  const mF = { posicion: fl.posicion.clone().add(new T.Vector3(0, 0, fl.radio + 0.05)), cerrada: false, agarre: null };
  F.gestionarManos(1 / 72, [mF], A.estacion.barandas); mF.cerrada = true; F.gestionarManos(1 / 72, [mF], A.estacion.barandas);
  ok('flotantes: la mano toma el objeto', mF.sostiene === fl, !!mF.sostiene);
  paso(1 / 72, [mF]);
  ok('flotantes: con un objeto en la mano no se agarra de la estación', !mF.agarre, !!mF.agarre);
  for (let i = 0; i < 15; i++) { mF.posicion.y += 0.01; F.gestionarManos(1 / 72, [mF], A.estacion.barandas); F.actualizar(1 / 72, cero, [], cero, [mF]); }
  mF.cerrada = false; F.gestionarManos(1 / 72, [mF], A.estacion.barandas);
  ok('flotantes: al soltar sale con la velocidad de la mano', Math.abs(fl.velocidad.y - 0.72) < 0.1, +fl.velocidad.y.toFixed(3));
  // 20. El cuerpo empuja los objetos
  fl.posicion.set(0.0, 0.3, -6.0); fl.velocidad.set(0, 0, 0);
  L.teletransportar(new T.Vector3(0, 0.3, -5.2)); L.velocidad.set(0, 0, -1);
  const esf = [{ centro: new T.Vector3(), radio: r }];
  for (let i = 0; i < 72; i++) { paso(1 / 72); esf[0].centro.copy(cabeza()); F.actualizar(1 / 72, cabeza(), esf, L.velocidad, []); }
  ok('flotantes: el astronauta los empuja al pasar', fl.velocidad.z < -0.3 && fl.posicion.distanceTo(cabeza()) >= r + fl.radio - 1e-4, +fl.velocidad.z.toFixed(3));
  P.distanciaActiva = lejos;
  R.push({ nombre: `costo de los ${F.objetos.length} flotantes por cuadro, todos activos (ms, en esta PC sin GPU)`, pasa: true, dato: +msF.toFixed(4) });
  // 21. Entorno orbital
  const O = A.orbital, u = O.tierra.material.uniforms;
  ok('Tierra: una sola malla y cuatro texturas cargadas', O.tierra.isMesh && [u.uBaseDia, u.uBaseNoche, u.uDetDia, u.uDetNoche].every((x) => x.value && x.value.image && x.value.image.width >= 1024), O.tierra.geometry.index.count / 3);
  const d0 = O.deriva(); for (let i = 0; i < 72 * 60; i++) O.actualizar(1 / 72);
  ok('Tierra: deriva lenta y acotada', O.deriva() - d0 > 0.25 && O.deriva() - d0 < 0.35, +(O.deriva() - d0).toFixed(3));
  for (let i = 0; i < 4000; i++) O.actualizar(1);
  ok('Tierra: la deriva se detiene a los 6°', Math.abs(O.deriva() - 6) < 1e-6, +O.deriva().toFixed(3));
  // 16. Costo de la física
  L.teletransportar(new T.Vector3(0.9, 0.3, -1.5)); L.velocidad.set(0.5, 0.3, 0.2);
  const t0 = performance.now(); for (let i = 0; i < 2000; i++) paso(1 / 72); 
  R.push({ nombre: 'costo de la física por cuadro (ms, en esta PC sin GPU)', pasa: true, dato: +((performance.now() - t0) / 2000).toFixed(4) });
  return R;
}
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"), args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width":640,"height":360})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(os.environ.get("URL", "http://localhost:8765/artigas1/"))
        await pg.wait_for_function("!!window.artigas1", timeout=120000)
        R = await pg.evaluate(JS)
        mal = 0
        for r in R:
            mal += not r["pasa"]; print(("OK   " if r["pasa"] else "FALLA"), r["nombre"], "→", json.dumps(r["dato"]))
        print(f"{len(R)-mal} de {len(R)}"); print(errs[:5])
        await b.close()
        raise SystemExit(1 if mal or errs else 0)
asyncio.run(main())
