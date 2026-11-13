"""Guante de astronauta para las manos del recorrido web de Artigas-1 (bpy 5.2 o posterior).

Genera una sola malla por mano, cerrada y suave, a partir del mismo esqueleto que usa el recorrido web
(`web-dashboard/public/artigas1/js/manos.js`, función `cinematicaMano`): palma, pulgar y cuatro dedos de tres
falanges. Las piezas se arman con el modificador Skin (dedos y pulgar), una palma redondeada, la eminencia del
pulgar, refuerzos en los nudillos y el puño del guante; después un remesh por vóxeles las funde en una superficie
continua (sin cortes entre los dedos y la palma) y un decimado la deja liviana para el Quest 2.

Salida (en web-dashboard/public/artigas1):
  guante.bin   posiciones y normales (float32), huesos y pesos (4 por vértice, uint8), zona y costura (uint8)
               e índices (uint16)
  guante.json  cantidades, desplazamientos dentro del .bin, nombres de los huesos, pose de modelado y centros de
               los huesos en reposo (el recorrido los compara con los suyos al cargar)

La mano se modela en el marco «modelo» de la mano derecha del recorrido: dedos hacia -Z, palma hacia -Y, pulgar
del lado -X. No se usan las conversiones de ejes de Blender: las coordenadas van tal cual al .bin. La izquierda
es el espejo y la arma el recorrido.

    python3 artigas1-vr/Blender/guante.py            (con el módulo bpy de pip)
"""
from __future__ import annotations

import json
import math
import os
import struct

import bpy  # noqa: I001  (bpy primero: registra bmesh)
import bmesh
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.normpath(os.path.join(AQUI, "..", "..", "web-dashboard", "public", "artigas1"))

# --- mismo esqueleto que js/manos.js (mano derecha, marco «modelo», metros) ---------------------------------
DEDOS = [
    {"base": (-0.030, 0.000, -0.046), "largos": (0.042, 0.026, 0.021), "radio": 0.0086, "abanico": 0.10},
    {"base": (-0.010, 0.001, -0.051), "largos": (0.046, 0.030, 0.022), "radio": 0.0089, "abanico": 0.02},
    {"base": (0.010, 0.000, -0.048), "largos": (0.042, 0.028, 0.021), "radio": 0.0083, "abanico": -0.06},
    {"base": (0.028, -0.001, -0.041), "largos": (0.033, 0.021, 0.018), "radio": 0.0073, "abanico": -0.15},
]
PULGAR = {"base": (-0.033, -0.006, 0.014), "largos": (0.040, 0.032, 0.026), "radio": 0.0100}
# Pose en la que se modela el guante: dedos apenas curvados y algo abiertos, para que deforme bien hacia el puño
# y hacia la mano abierta. El recorrido usa exactamente esta pose como reposo de los huesos.
POSE_MOLDE = {
    "dedos": [[0.10, 0.14, 0.08], [0.10, 0.15, 0.08], [0.12, 0.16, 0.09], [0.14, 0.17, 0.10]],
    "abanico": 1.1,
    "pulgar": [0.25, 0.10, 0.10, 0.08],
}
GROSOR = 1.12            # guante de cabina (el recorrido infla la malla para el guante presurizado)
HUESOS = ["palma"] + [f"{d}_{j + 1}" for d in ("indice", "medio", "anular", "menique") for j in range(3)] + [f"pulgar_{j + 1}" for j in range(3)]
VOXEL = 0.0014           # m: resolución del remesh
CARAS = 4200             # caras objetivo después del decimado

# zonas del guante (el recorrido les da color y rugosidad)
TELA, GOMA, YEMA, REFUERZO, PUNO = 0, 1, 2, 3, 4


def traslacion(x, y, z):
    m = np.eye(4)
    m[:3, 3] = (x, y, z)
    return m


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0, 0], [0, c, -s, 0], [0, s, c, 0], [0, 0, 0, 1]], dtype=float)


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s, 0], [0, 1, 0, 0], [-s, 0, c, 0], [0, 0, 0, 1]], dtype=float)


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], dtype=float)


def esqueleto(pose):
    """Cadenas de articulaciones y marcos de cada hueso (igual que cinematicaMano, sin escalas).

    Devuelve (cadenas, marcos): cadenas[k] = lista de puntos desde la base hasta la punta de cada dedo (0-3) y del
    pulgar (4); marcos[h] = matriz 4x4 del hueso h en reposo, con origen en el centro de su falange (el palma en
    el origen).
    """
    cadenas, marcos = [], [np.eye(4)]
    for d, defi in enumerate(DEDOS):
        a = traslacion(*defi["base"]) @ rot_y(defi["abanico"] * pose["abanico"])
        puntos = [a[:3, 3].copy()]
        for j in range(3):
            a = a @ rot_x(-pose["dedos"][d][j])
            l = defi["largos"][j]
            marcos.append(a @ traslacion(0, 0, -l / 2))
            a = a @ traslacion(0, 0, -l)
            puntos.append(a[:3, 3].copy())
        cadenas.append(puntos)
    p = pose["pulgar"]
    a = traslacion(*PULGAR["base"]) @ rot_y(0.85 + p[0]) @ rot_z(1.0)
    puntos = [a[:3, 3].copy()]
    for j in range(3):
        a = a @ rot_x(-p[j + 1])
        l = PULGAR["largos"][j]
        marcos.append(a @ traslacion(0, 0, -l / 2))
        a = a @ traslacion(0, 0, -l)
        puntos.append(a[:3, 3].copy())
    cadenas.append(puntos)
    return cadenas, marcos


def limpiar():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)


def objeto_de(bm, nombre):
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def cadena_skin(puntos, radios, nombre):
    """Tubo suave por los puntos, con el radio de cada punto (modificador Skin + subdivisión)."""
    bm = bmesh.new()
    vs = [bm.verts.new(tuple(p)) for p in puntos]
    for a, b in zip(vs, vs[1:]):
        bm.edges.new((a, b))
    ob = objeto_de(bm, nombre)
    ob.modifiers.new("skin", "SKIN")
    for i, r in enumerate(radios):
        ob.data.skin_vertices[0].data[i].radius = (r, r)
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = 2
    return ob


def elipsoide(centro, radios, nombre, segmentos=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segmentos, v_segments=segmentos // 2, radius=1.0)
    for v in bm.verts:
        v.co.x = centro[0] + v.co.x * radios[0]
        v.co.y = centro[1] + v.co.y * radios[1]
        v.co.z = centro[2] + v.co.z * radios[2]
    return objeto_de(bm, nombre)


def caja_redonda(centro, medidas, nombre, nivel=2):
    """Caja con las aristas redondeadas (subdivisión de una caja)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = centro[0] + v.co.x * medidas[0]
        v.co.y = centro[1] + v.co.y * medidas[1]
        v.co.z = centro[2] + v.co.z * medidas[2]
    ob = objeto_de(bm, nombre)
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = nivel
    return ob


def puno(nombre):
    """Puño del guante: un tubo ovalado de la muñeca al antebrazo, que se abre un poco (como la caña del guante)."""
    bm = bmesh.new()
    anillos = []
    for z, rx, ry in ((0.030, 0.034, 0.022), (0.050, 0.036, 0.025), (0.072, 0.039, 0.029)):
        anillo = []
        for i in range(28):
            a = 2 * math.pi * i / 28
            anillo.append(bm.verts.new((rx * math.cos(a), ry * math.sin(a) + 0.001, z)))
        anillos.append(anillo)
    for r0, r1 in zip(anillos, anillos[1:]):
        for i in range(28):
            bm.faces.new((r0[i], r0[(i + 1) % 28], r1[(i + 1) % 28], r1[i]))
    bm.faces.new(list(reversed(anillos[0])))
    bm.faces.new(anillos[-1])
    ob = objeto_de(bm, nombre)
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = 1
    return ob


def armar():
    limpiar()
    cadenas, _ = esqueleto(POSE_MOLDE)
    partes = []
    g = GROSOR
    for d, (defi, pts) in enumerate(zip(DEDOS, cadenas[:4])):
        # la cadena arranca 9 mm adentro de la palma para que el dedo nazca de ella; la punta se acorta el radio
        base = np.array(pts[0])
        primero = np.array(pts[1]) - base
        adentro = base - primero / np.linalg.norm(primero) * 0.009
        punta = np.array(pts[3])
        ultimo = punta - np.array(pts[2])
        rad = [defi["radio"] * (1 - 0.07 * j) * g for j in range(3)]
        punta = punta - ultimo / np.linalg.norm(ultimo) * rad[2] * 0.75
        radios = [rad[0] * 1.05, rad[0], rad[0] * 0.97, rad[1] * 0.96, rad[2] * 0.95]
        partes.append(cadena_skin([adentro, base, pts[1], pts[2], punta], [radios[0], radios[1], radios[2] * 0.98, radios[3], radios[4]], f"dedo{d}"))
    pts = cadenas[4]
    rad = [PULGAR["radio"] * (1 - 0.06 * j) * g for j in range(3)]
    punta = np.array(pts[3]) - (np.array(pts[3]) - np.array(pts[2])) / np.linalg.norm(np.array(pts[3]) - np.array(pts[2])) * rad[2] * 0.75
    partes.append(cadena_skin([pts[0], pts[1], pts[2], punta], [rad[0] * 1.25, rad[0] * 1.02, rad[1], rad[2] * 0.95], "pulgar"))
    # palma: caja redondeada más ancha en los nudillos; eminencia del pulgar y del meñique; muñeca
    partes.append(caja_redonda((0.000, -0.001, -0.008), (0.078 * g, 0.024 * g, 0.082), "palma"))
    partes.append(elipsoide((-0.022, -0.008, 0.016), (0.019 * g, 0.014 * g, 0.026), "tenar"))
    partes.append(elipsoide((0.026, -0.007, 0.012), (0.012 * g, 0.012 * g, 0.026), "hipotenar"))
    partes.append(elipsoide((0.001, 0.001, 0.040), (0.031 * g, 0.020 * g, 0.020), "muneca"))
    # refuerzo de los nudillos (placa curva sobre el dorso) y almohadillas en el dorso de las primeras falanges
    partes.append(caja_redonda((-0.001, 0.0135 * g, -0.040), (0.074, 0.008, 0.016), "nudillos"))
    for d, defi in enumerate(DEDOS):
        a, b = np.array(cadenas[d][1]), np.array(cadenas[d][2])
        m = a * 0.45 + b * 0.55
        partes.append(elipsoide((m[0], m[1] + defi["radio"] * g * 0.78, m[2]), (defi["radio"] * g * 0.62, 0.0034, 0.0085), f"almohadilla{d}", 16))
    partes.append(puno("puno"))
    # todo en una malla
    grafo = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    for ob in partes:
        me = ob.evaluated_get(grafo).to_mesh()
        bm.from_mesh(me)
        ob.evaluated_get(grafo).to_mesh_clear()
    for ob in partes:
        bpy.data.objects.remove(ob, do_unlink=True)
    guante = objeto_de(bm, "Guante")
    rm = guante.modifiers.new("remesh", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = VOXEL
    rm.adaptivity = 0.0
    suave = guante.modifiers.new("suave", "SMOOTH")
    suave.factor = 0.6
    suave.iterations = 4
    grafo = bpy.context.evaluated_depsgraph_get()
    me = guante.evaluated_get(grafo).to_mesh()
    caras_remesh = len(me.polygons)
    bm = bmesh.new()
    bm.from_mesh(me)
    guante.evaluated_get(grafo).to_mesh_clear()
    bpy.data.objects.remove(guante, do_unlink=True)
    guante = objeto_de(bm, "Guante")
    dec = guante.modifiers.new("decimar", "DECIMATE")
    dec.ratio = min(1.0, CARAS / max(1, caras_remesh))
    tri = guante.modifiers.new("triangular", "TRIANGULATE")
    tri.keep_custom_normals = False
    grafo = bpy.context.evaluated_depsgraph_get()
    me = guante.evaluated_get(grafo).to_mesh()
    me.calc_loop_triangles()
    pos = np.array([v.co[:] for v in me.vertices], dtype=np.float64)
    for p in me.polygons:
        p.use_smooth = True
    nor = np.array([v.normal[:] for v in me.vertices], dtype=np.float64)
    tris = np.array([t.vertices[:] for t in me.loop_triangles], dtype=np.int64)
    guante.evaluated_get(grafo).to_mesh_clear()
    print(f"remesh: {caras_remesh} caras; final: {len(pos)} vértices, {len(tris)} triángulos")
    return pos, nor, tris


def distancia_segmento(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / max(1e-12, ab @ ab), 0.0, 1.0)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1), t


def pesos(pos):
    """Huesos y pesos de cada vértice.

    Cada dedo (y el pulgar) es una cadena: un tramo de palma que llega a los nudillos y sus tres falanges. El
    vértice toma la cadena más cercana y, sobre ella, el punto más cercano; los pesos salen de dónde cae ese punto
    respecto de cada articulación, con una transición suave de ±6 mm (±9 mm en la base del pulgar). Así la base
    de cada dedo deja de seguir a la palma apenas pasa el nudillo y las articulaciones doblan sin estirarse.
    """
    cadenas, marcos = esqueleto(POSE_MOLDE)
    n = len(pos)
    polis = []
    for c in range(5):
        pts = [np.array(p) for p in cadenas[c]]
        direccion = pts[1] - pts[0]
        direccion /= np.linalg.norm(direccion)
        ancla = pts[0] - direccion * (0.045 if c < 4 else 0.030)          # tramo de palma detrás del nudillo
        polis.append([ancla] + pts)
    huesos = np.zeros((n, 4), dtype=np.int64)
    w = np.zeros((n, 4))
    cadena = np.zeros(n, dtype=np.int64)
    # distancia de cada vértice a cada cadena (sin el tramo de palma) y parámetro sobre la polilínea completa
    dist_cad = np.full((n, 5), np.inf)
    param = np.zeros((n, 5))
    largos_cad = []
    for c, poli in enumerate(polis):
        largos = [np.linalg.norm(poli[k + 1] - poli[k]) for k in range(4)]
        acum = np.concatenate([[0.0], np.cumsum(largos)])
        largos_cad.append(acum)
        mejor = np.full(n, np.inf)
        u = np.zeros(n)
        for k in range(4):
            dk, tk = distancia_segmento(pos, poli[k], poli[k + 1])
            if k == 0:
                # el tramo de palma cuenta para el parámetro pero pesa más lejos (que no robe vértices del dorso)
                dk = dk + 0.004
            menor = dk < mejor
            mejor = np.where(menor, dk, mejor)
            u = np.where(menor, acum[k] + tk * largos[k], u)
        dist_cad[:, c] = mejor
        param[:, c] = u
    cadena = np.argmin(dist_cad, axis=1)
    def paso(u, borde, h):
        x = np.clip((u - (borde - h)) / (2 * h), 0.0, 1.0)
        return x * x * (3 - 2 * x)
    total = np.zeros((n, 16))
    for c in range(5):
        acum = largos_cad[c]
        u = param[:, c]
        t0 = paso(u, acum[1], 0.009 if c == 4 else 0.006)    # nudillo: palma → primera falange
        t1 = paso(u, acum[2], 0.005)                          # primera → segunda
        t2 = paso(u, acum[3], 0.004)                          # segunda → tercera
        ws = np.stack([1 - t0, t0 * (1 - t1), t1 * (1 - t2), t2], axis=1)
        # lejos de la cadena (cuerpo de la palma, dorso, puño) el vértice vuelve de a poco a la palma
        d = dist_cad[:, c]
        x = np.clip((d - 0.013) / 0.011, 0.0, 1.0)
        lejos = x * x * (3 - 2 * x)
        ws[:, 1:] *= (1 - lejos)[:, None]
        ws[:, 0] = 1 - ws[:, 1:].sum(axis=1)
        # mezcla suave entre cadenas vecinas (membrana entre dedos): cuanto más cerca, más pesa
        mezcla = np.exp(-(d - dist_cad.min(axis=1)) / 0.0025)
        hs = [0, 1 + 3 * c, 2 + 3 * c, 3 + 3 * c]
        for k in range(4):
            total[:, hs[k]] += mezcla * ws[:, k]
    total /= total.sum(axis=1, keepdims=True)
    for i in range(n):
        orden = np.argsort(-total[i])[:4]
        sel = total[i, orden]
        sel = np.where(sel < 0.02, 0.0, sel)
        sel = sel / sel.sum()
        huesos[i] = orden
        w[i] = sel
    return huesos, w, marcos, cadena


def zonas(pos, nor, tris, huesos, w, marcos):
    """Zona de cada vértice (tela, goma de la palma, yema, refuerzo, puño) y costuras en los bordes entre zonas."""
    n = len(pos)
    zona = np.zeros(n, dtype=np.int64)
    principal = huesos[np.arange(n), np.argmax(w, axis=1)]
    for i in range(n):
        h = principal[i]
        m = marcos[h]
        r = m[:3, :3]
        nl = r.T @ nor[i]
        pl = r.T @ (pos[i] - m[:3, 3])
        if h == 0:
            if pos[i, 2] > 0.030:
                zona[i] = PUNO
            elif nl[1] < -0.35:
                zona[i] = GOMA
            elif pos[i, 1] > 0.0115 * GROSOR and -0.053 < pos[i, 2] < -0.026:
                zona[i] = REFUERZO
        else:
            distal = h in (3, 6, 9, 12, 15)
            proximal = h in (1, 4, 7, 10, 13)
            if distal and pl[2] < -0.002:
                zona[i] = YEMA
            elif nl[1] < -0.55:
                zona[i] = GOMA
            elif proximal and h != 13 and nl[1] > 0.55 and abs(pl[2]) < 0.012:
                zona[i] = REFUERZO
    costura = np.zeros(n, dtype=np.int64)
    for t in tris:
        z = zona[t]
        if z.min() != z.max():
            costura[t] = 255
    # costuras laterales de los dedos (donde se cosen el dorso y la palma del guante)
    for i in range(n):
        h = principal[i]
        if h and zona[i] == TELA:
            nl = marcos[h][:3, :3].T @ nor[i]
            if abs(nl[0]) > 0.93:
                costura[i] = max(costura[i], 150)
    return zona, costura


def escribir(pos, nor, tris, huesos, w, zona, costura, marcos):
    n, m = len(pos), len(tris) * 3
    w8 = np.round(w * 255).astype(np.int64)
    w8[:, 0] += 255 - w8.sum(axis=1)                 # que sumen exactamente 255
    partes, desp = [], {}
    o = 0

    def agregar(nombre, datos):
        nonlocal o
        b = datos.tobytes()
        desp[nombre] = o
        partes.append(b)
        o += len(b)
        if o % 4:
            relleno = 4 - o % 4
            partes.append(b"\0" * relleno)
            o += relleno

    agregar("posicion", pos.astype(np.float32))
    agregar("normal", nor.astype(np.float32))
    agregar("huesos", huesos.astype(np.uint8))
    agregar("pesos", w8.astype(np.uint8))
    agregar("zona", zona.astype(np.uint8))
    agregar("costura", costura.astype(np.uint8))
    agregar("indices", tris.reshape(-1).astype(np.uint16))
    with open(os.path.join(SALIDA, "guante.bin"), "wb") as f:
        f.write(b"".join(partes))
    centros = [[round(float(x), 6) for x in mk[:3, 3]] for mk in marcos]
    info = {"vertices": n, "indices": m, "desplazamientos": desp, "huesos": HUESOS, "pose": POSE_MOLDE, "grosor": GROSOR, "centros": centros,
            "zonas": ["tela", "goma", "yema", "refuerzo", "puño"], "bytes": o}
    with open(os.path.join(SALIDA, "guante.json"), "w") as f:
        json.dump(info, f, ensure_ascii=False, indent=1)
    print(f"guante.bin: {o / 1024:.0f} kB · {n} vértices · {m // 3} triángulos")


def main():
    pos, nor, tris = armar()
    huesos, w, marcos, _ = pesos(pos)
    zona, costura = zonas(pos, nor, tris, huesos, w, marcos)
    cuenta = np.bincount(zona, minlength=5)
    print("vértices por zona:", dict(zip(["tela", "goma", "yema", "refuerzo", "puño"], cuenta.tolist())))
    escribir(pos, nor, tris, huesos, w, zona, costura, marcos)


if __name__ == "__main__":
    main()
