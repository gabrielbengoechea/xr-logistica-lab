"""Pruebas de visión estéreo e iluminación de la caminata espacial de Artigas-1 (Playwright + Chrome).

Reproducen lo que hace el visor: en WebXR three.js dibuja cada ojo con su propia cámara, el ojo izquierdo con la
capa 1 habilitada y el derecho con la capa 2. Estas pruebas dibujan la caminata espacial con dos cámaras así
(separadas 64 mm, con un campo visual parecido al del Quest 2) y comparan las dos imágenes. La grabación del
Quest usa la imagen del ojo izquierdo, así que lo que muestra el ojo izquierdo acá es lo que sale en el video.

    cd web-dashboard/public && python3 -m http.server 8765 &
    python3 artigas1-vr/Tools/pruebas-web/vision.py

GUARDAR=carpeta guarda las imágenes de cada ojo (PNG). Lo que no prueban: el compositor del Quest (reproyección,
foveación) ni la grabación en sí; para eso hay que grabar en el visor.
"""
import asyncio
import base64
import json
import os

from playwright.async_api import async_playwright

JS = r"""
async () => {
  const A = window.artigas1, T = A.THREE, L = A.loco, G = A.gestor, EV = A.eva;
  A.renderer.setAnimationLoop(null);
  A.sonido.tocar = () => {};
  const R = [];
  const ok = (nombre, pasa, dato = '') => R.push({ nombre, pasa: !!pasa, dato });
  const fotos = {};
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const pasos = (n = 1, dt = 1 / 72) => { for (let i = 0; i < n; i++) A.avanzar(dt); };
  const seg = (s) => pasos(Math.round(s * 72));
  A.renderer.xr.isPresenting = true;
  A.rig.quaternion.identity(); A.camera.position.set(0, 0, 0); A.camera.rotation.set(0, 0, 0);

  // ---- dos ojos como los arma three.js en WebXR
  const W = 200, H = 220;
  const ojo = (capa, lado) => {
    const c = new T.PerspectiveCamera();
    c.layers.enable(capa);
    c.matrixAutoUpdate = false;
    // Mismo campo visual en los dos ojos (47° a cada lado), para que lo lejano caiga en el mismo píxel en las
    // dos imágenes y la comparación mida solo lo que de verdad difiere. El Quest usa campos asimétricos, que
    // recortan distinto cada ojo pero no cambian qué se dibuja.
    const n = 0.03, f = 2600, t = Math.tan(47 * Math.PI / 180) * n;
    c.projectionMatrix.makePerspective(-t, t, t * H / W, -t * H / W, n, f);
    c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
    c.lado = lado;
    return c;
  };
  const ojoIzq = ojo(1, -1), ojoDer = ojo(2, 1);
  const rt = new T.WebGLRenderTarget(W, H, { colorSpace: T.SRGBColorSpace, samples: 4 });   // MSAA como en el visor
  const px = new Uint8Array(W * H * 4);
  const lienzo = document.createElement('canvas'); lienzo.width = W; lienzo.height = H;
  const dibujarOjo = (c) => {
    A.camera.updateWorldMatrix(true, true);
    c.matrixWorld.copy(A.camera.matrixWorld).multiply(new T.Matrix4().makeTranslation(c.lado * 0.032, 0, 0));
    c.matrixWorldInverse.copy(c.matrixWorld).invert();
    A.renderer.xr.isPresenting = false;
    A.renderer.setRenderTarget(rt); A.renderer.render(A.scene, c); A.renderer.setRenderTarget(null);
    A.renderer.xr.isPresenting = true;
    A.renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    const lum = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) lum[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
    return { lum, rgba: px.slice() };
  };
  const png = (img) => {
    const ctx = lienzo.getContext('2d'), d = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) d.data.set(img.rgba.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    ctx.putImageData(d, 0, 0);
    return lienzo.toDataURL('image/png');
  };
  /** Compara los dos ojos en la zona central (sin la periferia del casco). */
  const compararOjos = (a, b) => {
    let distintos = 0, total = 0, sumaA = 0, sumaB = 0;
    for (let y = Math.round(H * 0.2); y < H * 0.8; y++) for (let x = Math.round(W * 0.2); x < W * 0.8; x++) {
      const i = y * W + x;
      // la disparidad corre lo cercano (a 0,6 m, unos 10 px): se compara contra el mínimo en ±10 px horizontales
      let mejor = 255;
      for (let dx = -10; dx <= 10; dx++) { const j = i + dx; if (j >= 0 && j < W * H) mejor = Math.min(mejor, Math.abs(a.lum[i] - b.lum[j])); }
      if (mejor > 45) distintos++;
      sumaA += a.lum[i]; sumaB += b.lum[i]; total++;
    }
    return { distintos: distintos / total, brilloIzq: sumaA / total, brilloDer: sumaB / total };
  };
  const unSoloOjo = () => {
    const lista = [];
    A.scene.traverseVisible((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
      if (ojoIzq.layers.test(o.layers) !== ojoDer.layers.test(o.layers)) lista.push(`${o.name || o.type} (capas ${o.layers.mask})`);
    });
    return lista;
  };

  // ---- adentro primero (referencia)
  L.teletransportar(V(0.1, 0.1, -1.0)); L.velocidad.set(0, 0, 0); pasos(5);
  let iz = dibujarOjo(ojoIzq), de = dibujarOjo(ojoDer), c = compararOjos(iz, de);
  ok('adentro: los dos ojos ven lo mismo (salvo la disparidad)', c.distintos < 0.08, c);
  fotos.adentro_izq = png(iz); fotos.adentro_der = png(de);

  // ---- caminata espacial
  G.obtener('mantenimiento').estado = 'COMPLETADA'; G.obtener('eva').estado = 'DISPONIBLE'; G.iniciar('eva'); A.panelInforme.malla.visible = false;
  L.teletransportar(V(0.45, 0.0, 2.3)); pasos(2);
  EV.salir(A.camera.getWorldPosition(new T.Vector3())); seg(3.6);
  ok('caminata: afuera, con el traje puesto', EV.afuera && A.exterior.traje.visible && EV.casco.visible);
  ok('caminata: ningún objeto se dibuja en un solo ojo', unSoloOjo().length === 0, unSoloOjo());
  ok('caminata: el traje de la vista en tercera persona no lo dibuja ningún ojo ni la cámara de la compu', !ojoIzq.layers.test(A.exterior.traje.layers) && !ojoDer.layers.test(A.exterior.traje.layers) && !A.camera.layers.test(A.exterior.traje.layers), A.exterior.traje.layers.mask);
  const vistas = {
    escotilla: { pos: [2.95, 0.05, 2.2], yaw: Math.PI / 2 },                    // mirando la esclusa desde afuera
    a_lo_largo: { pos: [3.3, 1.4, 4.6], yaw: 0.45 },                           // a lo largo de la estación
    paneles: { pos: [-1.5, 4.6, -1.5], yaw: -0.4, pitch: -0.5 },              // arriba, con los paneles solares
  };
  const resumen = {};
  for (const [nombre, v] of Object.entries(vistas)) {
    A.rig.quaternion.setFromAxisAngle(V(0, 1, 0), v.yaw);
    A.camera.rotation.set(v.pitch || 0, 0, 0);
    L.teletransportar(V(...v.pos)); L.velocidad.set(0, 0, 0); pasos(3);
    iz = dibujarOjo(ojoIzq); de = dibujarOjo(ojoDer); c = compararOjos(iz, de);
    resumen[nombre] = { distintos: +c.distintos.toFixed(3), izq: +c.brilloIzq.toFixed(1), der: +c.brilloDer.toFixed(1) };
    fotos[`eva_${nombre}_izq`] = png(iz); fotos[`eva_${nombre}_der`] = png(de);
  }
  ok('caminata: el ojo izquierdo ve lo mismo que el derecho en las tres vistas (lo que graba el Quest)', Object.values(resumen).every((r) => r.distintos < 0.08), resumen);
  ok('caminata: el mismo brillo en los dos ojos (diferencia menor al 4 %)', Object.values(resumen).every((r) => Math.abs(r.izq - r.der) <= 0.04 * Math.max(r.izq, r.der) + 1), resumen);

  // ---- estabilidad de la luz en el tiempo: misma pose, 4 segundos (paneles, antenas y balizas en movimiento)
  A.rig.quaternion.setFromAxisAngle(V(0, 1, 0), 0.45); A.camera.rotation.set(0, 0, 0);
  L.teletransportar(V(3.3, 1.4, 4.6)); L.velocidad.set(0, 0, 0); pasos(3);
  // Lo que se mueve de verdad (paneles, antenas, el cable) corre sus bordes: un píxel cambia una vez y queda.
  // Un parpadeo o un destello es un píxel que sube y vuelve a bajar (o al revés): se cuentan esas idas y vueltas
  // de más de 60/255 en menos de medio segundo.
  const ultimoSalto = new Int8Array(W * H), edad = new Uint8Array(W * H).fill(255);
  let previa = dibujarOjo(ojoIzq), idaYVuelta = 0, peor = 0;
  for (let k = 0; k < 40; k++) {
    seg(0.1); L.teletransportar(V(3.3, 1.4, 4.6)); L.velocidad.set(0, 0, 0);
    const actual = dibujarOjo(ojoIzq);
    let enEste = 0;
    for (let i = 0; i < W * H; i++) {
      const d = actual.lum[i] - previa.lum[i];
      if (edad[i] < 255) edad[i]++;
      if (Math.abs(d) > 60) {
        const signo = d > 0 ? 1 : -1;
        if (ultimoSalto[i] === -signo && edad[i] <= 5) { idaYVuelta++; enEste++; }
        ultimoSalto[i] = signo; edad[i] = 0;
      }
    }
    if (enEste > peor) { peor = enEste; fotos.salto_antes = png(previa); fotos.salto_despues = png(actual); }
    previa = actual;
  }
  // A 200 px de ancho, piezas de menos de un píxel (el foco de la antena, el canto de un panel) pueden prenderse y
  // apagarse sueltas al moverse: eso no es un parpadeo. Se exige que no haya zonas (más de 5 píxeles a la vez).
  ok('luz: sin parpadeos ni destellos en 4 s (ninguna zona se enciende y apaga)', peor <= 5 && idaYVuelta <= 40, { idaYVuelta, peorCuadro: peor });

  // ---- mover la cabeza: el brillo de una misma parte del casco no cambia de golpe (especular controlado).
  // Se mira justo el punto del casco del Nodo donde rebota el sol (el peor caso para el brillo especular).
  const sol = A.exterior.material.uniforms.uSol.value.clone().normalize();
  const radial = V(sol.x, sol.y, 0).normalize();
  const pCasco = radial.clone().multiplyScalar(1.76).setZ(3.6);
  const reflejo = sol.clone().reflect(radial).negate();                      // dirección en que rebota la luz
  if (reflejo.dot(radial) < 0.25) reflejo.addScaledVector(radial, 0.6).normalize();
  const ojoBase = pCasco.clone().addScaledVector(reflejo, 0.9);
  const mirar = new T.Quaternion().setFromUnitVectors(V(0, 0, -1), pCasco.clone().sub(ojoBase).normalize());
  const lado = V(1, 0, 0).applyQuaternion(mirar);
  const muestras = [];
  for (let k = 0; k <= 10; k++) {
    A.rig.quaternion.copy(mirar); A.camera.rotation.set(0, 0, 0);
    A.camera.position.set(-0.03 + k * 0.006, 0, 0);                       // 6 cm de cabeza, de un lado al otro
    for (let r = 0; r < 2; r++) { L.teletransportar(ojoBase.clone().addScaledVector(lado, -0.03 + k * 0.006)); L.velocidad.set(0, 0, 0); pasos(1); }
    const im = dibujarOjo(ojoIzq);
    const pv = pCasco.clone().applyMatrix4(ojoIzq.matrixWorldInverse).applyMatrix4(ojoIzq.projectionMatrix);
    const cx = Math.round((pv.x * 0.5 + 0.5) * W), cy = Math.round((pv.y * 0.5 + 0.5) * H);
    let s = 0, c2 = 0;
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) if (x >= 0 && x < W && y >= 0 && y < H) { s += im.lum[y * W + x]; c2++; }
    muestras.push(s / Math.max(1, c2));
    if (k === 5) fotos.reflejo = png(im);
  }
  const rango = Math.max(...muestras) - Math.min(...muestras);
  ok('luz: mirando el reflejo del sol, 6 cm de movimiento de cabeza cambian el brillo del casco menos de 15/255', rango <= 15, { rango: +rango.toFixed(1), brillo: muestras.map((x) => +x.toFixed(0)) });
  ok('luz: el reflejo del sol en el casco no es una mancha blanca (brillo menor a 120/255)', Math.max(...muestras) < 120, +Math.max(...muestras).toFixed(0));
  A.camera.position.set(0, 0, 0); A.camera.rotation.set(0, 0, 0);

  // ---- el casco y el túnel quedan centrados en cada ojo
  const centro = (im) => { let s = 0, k = 0; for (let y = H * 0.4; y < H * 0.6; y++) for (let x = W * 0.4; x < W * 0.6; x++) { s += im.lum[Math.round(y) * W + Math.round(x)]; k++; } return s / k; };
  const borde = (im, lado) => { let s = 0, k = 0; for (let y = H * 0.3; y < H * 0.7; y++) for (let x = 0; x < 6; x++) { const xx = lado < 0 ? x : W - 1 - x; s += im.lum[Math.round(y) * W + xx]; k++; } return s / k; };
  A.confort.nivelTunel = 'fuerte'; A.confort.fuerza = 1; A.confort.actualizar(0, 2, true);
  iz = dibujarOjo(ojoIzq); de = dibujarOjo(ojoDer);
  ok('túnel: centrado en cada ojo (bordes oscuros de los dos lados, centro visible)', centro(iz) > 15 && centro(de) > 15 && borde(iz, -1) < 3 && borde(iz, 1) < 3 && borde(de, -1) < 3 && borde(de, 1) < 3, [centro(iz), borde(iz, -1), borde(iz, 1), borde(de, -1), borde(de, 1)].map((x) => +x.toFixed(1)));
  fotos.tunel_izq = png(iz); fotos.tunel_der = png(de);
  A.confort.fuerza = 0; A.confort.actualizar(1, 0, false);

  // ---- de vuelta adentro
  L.teletransportar(V(2.75, 0.0, 2.3)); A.rig.quaternion.identity(); pasos(2);
  EV.entrar(A.camera.getWorldPosition(new T.Vector3())); seg(3.6);
  ok('regreso: adentro el casco se apaga y los ojos siguen iguales', !EV.afuera && !EV.casco.visible && unSoloOjo().length === 0, unSoloOjo());
  return { R, fotos };
}
"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME", "/usr/bin/google-chrome"),
                                    args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = await b.new_page(viewport={"width": 400, "height": 300})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(os.environ.get("URL", "http://localhost:8765/artigas1/"))
        await pg.wait_for_function("!!window.artigas1", timeout=120000)
        res = await pg.evaluate(JS)
        mal = 0
        for r in res["R"]:
            mal += not r["pasa"]
            print(("OK   " if r["pasa"] else "FALLA"), r["nombre"], "→", json.dumps(r["dato"], ensure_ascii=False))
        print(f"\n{len(res['R']) - mal} de {len(res['R'])}")
        print(errs[:5])
        carpeta = os.environ.get("GUARDAR")
        if carpeta:
            os.makedirs(carpeta, exist_ok=True)
            for nombre, url in res["fotos"].items():
                with open(os.path.join(carpeta, nombre + ".png"), "wb") as f:
                    f.write(base64.b64decode(url.split(",", 1)[1]))
        await b.close()
        raise SystemExit(1 if mal or errs else 0)


asyncio.run(main())
