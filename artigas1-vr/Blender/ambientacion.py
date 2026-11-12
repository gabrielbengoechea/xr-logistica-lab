"""Ambientacion de la Estacion Artigas-1: el equipamiento que la hace parecer habitada y en uso.

Todo se arma en coordenadas de la estacion armada (eje Y, Z arriba, estribor +X) y usa la paleta del kit,
asi que el recorrido web lo fusiona con el resto del modulo: no suma llamadas de dibujo.

Por modulo se generan:
  <L>_Det_Ambientacion   una sola malla con cables, bandejas, paneles, rejillas, tornilleria y mecanismos
                         (sin colision: va pegada a las paredes y sobresale pocos centimetros);
  <L>_Bulto_<n>          bolsas y redes que sobresalen de la pared (el recorrido les pone una caja de colision);
  <L>_Pantalla_Sistemas  pantallas y leyendas, con el atlas T_Artigas_Sistemas (material emisivo);
  <L>_Flot_<tipo>_<n>    objetos sueltos que flotan (el recorrido los anima; ver js/flotantes.js).

Letras de modulo: T Tacuarembo, N Nodo, R Rivera, C Colonia y carguero, F Cupula.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import TEX, Part, collection  # noqa: E402

FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
A = 1.2            # apotema de los modulos
ZB = 0.82          # altura de las bandejas portacables (por debajo de las barandas de las esquinas)
ZC = ZB - 0.035    # hasta donde suben los cables que entran a una bandeja
AG = 1.15          # apotema de la bodega del carguero

# ---------------------------------------------------------------- atlas de pantallas y leyendas
CELDAS = {}        # nombre -> (x, y, ancho, alto) en pixeles
PANTALLAS = {
    "presion": ("PRESIÓN INTERNA", ["CABINA      101,3 kPa", "ESCLUSA     101,1 kPa", "FUGA          0,00 kPa/h", "", "ESTADO: NOMINAL"], 0.84),
    "electrico": ("ESTADO ELÉCTRICO", ["BUS A   120,4 V   18 A", "BUS B   119,8 V   11 A", "BATERÍA        87 %", "PANELES      4,6 kW", "ESTADO: NOMINAL"], 0.87),
    "oxigeno": ("OXÍGENO", ["O2 CABINA      20,9 %", "CO2             0,31 %", "TANQUE 1         76 %", "TANQUE 2         92 %", "FILTRO CO2: 41 h"], 0.76),
    "temperatura": ("TEMPERATURA", ["TACUAREMBÓ   22,4 °C", "NODO         22,1 °C", "RIVERA       21,6 °C", "COLONIA      21,9 °C", "HUMEDAD        44 %"], 0.44),
    "inventario": ("INVENTARIO", ["HUECOS OCUPADOS  35/64", "BULTOS EN TRÁNSITO   3", "DISCREPANCIAS       3", "ÚLTIMO CONTEO  14:20", "PENDIENTE: CR-01"], 0.55),
    "carga": ("CARGA · CR-01", ["MANIFIESTO      24 bultos", "DESCARGADOS      0", "MASA         312 kg", "CUARENTENA       0", "ESTADO: ACOPLADO"], 0.0),
    "modulos": ("ESTADO DE MÓDULOS", ["A1-TAC  TALLER       OK", "A1-MVD  NODO         OK", "A1-RIV  ALMACÉN      OK", "A1-COL  RECEPCIÓN    OK", "A1-FAR  CÚPULA       OK"], 1.0),
    "comunicaciones": ("COMUNICACIONES", ["ENLACE TIERRA   ACTIVO", "PRÓX. PASADA   00:12:40", "BANDA S     -92 dBm", "BANDA KU   EN ESPERA", "CANAL 2 · CONTROL MVD"], 0.62),
    "ambiental": ("CONTROL AMBIENTAL", ["VENTILACIÓN     62 %", "CAUDAL      4,1 m3/min", "PARTÍCULAS    BAJO", "CONDENSADO   1,8 L", "MODO: AUTOMÁTICO"], 0.62),
    "procedimiento": ("PROC. 4.2 · FILTRO CO2", ["1 Cerrá la válvula V3", "2 Abrí la puerta del rack", "3 Sacá el filtro usado", "4 Poné el repuesto A1", "5 Abrí V3 y verificá"], 0.4),
}
LEYENDAS = ["BUS A", "BUS B", "ILUM", "VENT", "BOMBA 1", "BOMBA 2", "COM 1", "COM 2",
            "DATOS", "AUX", "O2", "N2", "AGUA", "CO2", "EMERG", "PRUEBA"]
ADHESIVOS = {
    "alta_tension": ("ALTA TENSIÓN · 120 V", (250, 200, 0), (20, 20, 20)),
    "retorno_aire": ("RETORNO DE AIRE · NO OBSTRUIR", (28, 30, 34), (245, 245, 242)),
    "valvula": ("VÁLVULA MANUAL · IGUALAR PRESIÓN", (190, 30, 30), (245, 245, 242)),
    "emergencia": ("EQUIPO DE EMERGENCIA", (190, 30, 30), (245, 245, 242)),
    "transferencia": ("TRANSFERENCIA DE ENERGÍA · CR-01", (0, 56, 148), (245, 245, 242)),
    "acceso": ("PANEL DE ACCESO · 8 CIERRES", (28, 30, 34), (245, 245, 242)),
    "extintor": ("EXTINTOR CO2", (190, 30, 30), (245, 245, 242)),
    "suministro": ("SUMINISTRO DE AIRE", (28, 30, 34), (245, 245, 242)),
}
DIALES = {"dial_o2": ("O2", "%", 0.76), "dial_n2": ("N2", "kPa", 0.58), "dial_presion": ("CABINA", "kPa", 0.66), "dial_temp": ("TEMP", "°C", 0.45)}


def write_atlas():
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (1024, 1024), (8, 10, 12))
    d = ImageDraw.Draw(img)
    ft, fl, fs = ImageFont.truetype(FB, 22), ImageFont.truetype(FR, 19), ImageFont.truetype(FB, 15)
    for i, (k, (titulo, lineas, barra)) in enumerate(PANTALLAS.items()):
        x0, y0 = (i % 3) * 336, (i // 3) * 216
        CELDAS[k] = (x0, y0, 320, 200)
        d.rectangle((x0, y0, x0 + 319, y0 + 199), fill=(6, 14, 20))
        d.rectangle((x0, y0, x0 + 319, y0 + 31), fill=(0, 56, 148))
        d.text((x0 + 10, y0 + 16), titulo, font=ft, fill=(240, 244, 248), anchor="lm")
        for j, ln in enumerate(lineas):
            color = (90, 230, 130) if ln.startswith(("ESTADO", "MODO")) else (255, 190, 60) if ln.startswith(("PENDIENTE", "FILTRO", "DISCREP")) else (110, 220, 235)
            d.text((x0 + 12, y0 + 52 + j * 26), ln, font=fl, fill=color, anchor="lm")
        d.rectangle((x0 + 12, y0 + 180, x0 + 307, y0 + 190), outline=(60, 110, 130))
        d.rectangle((x0 + 12, y0 + 180, x0 + 12 + int(295 * barra), y0 + 190), fill=(60, 190, 210))
    for i, (k, (nombre, unidad, valor)) in enumerate(DIALES.items()):
        x0, y0 = 336 + i * 136, 648
        CELDAS[k] = (x0, y0, 128, 128)
        cx, cy = x0 + 64, y0 + 64
        d.ellipse((x0 + 2, y0 + 2, x0 + 125, y0 + 125), fill=(232, 232, 226))
        for t in range(0, 11):
            a = math.radians(225 - t * 27)
            d.line((cx + 44 * math.cos(a), cy - 44 * math.sin(a), cx + 56 * math.cos(a), cy - 56 * math.sin(a)), fill=(20, 20, 20), width=3)
        a0, a1 = 225 - 8 * 27, 225 - 10 * 27
        d.arc((x0 + 10, y0 + 10, x0 + 117, y0 + 117), start=-a0, end=-a1, fill=(200, 40, 30), width=5)
        a = math.radians(225 - valor * 270)
        d.line((cx, cy, cx + 46 * math.cos(a), cy - 46 * math.sin(a)), fill=(190, 30, 30), width=4)
        d.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=(20, 20, 20))
        d.text((cx, cy + 26), nombre, font=fs, fill=(20, 20, 20), anchor="mm")
        d.text((cx, cy + 42), unidad, font=fs, fill=(60, 60, 60), anchor="mm")
    for i, txt in enumerate(LEYENDAS):
        x0, y0 = (i % 8) * 128, 792 + (i // 8) * 36
        CELDAS["ley_" + txt] = (x0, y0, 128, 32)
        d.rectangle((x0 + 1, y0 + 1, x0 + 126, y0 + 30), fill=(28, 30, 34), outline=(120, 124, 130))
        d.text((x0 + 64, y0 + 16), txt, font=fs, fill=(235, 236, 232), anchor="mm")
    for i, (k, (txt, bg, fg)) in enumerate(ADHESIVOS.items()):
        x0, y0 = (i % 2) * 512, 868 + (i // 2) * 39
        CELDAS[k] = (x0, y0, 512, 38)
        d.rectangle((x0, y0, x0 + 511, y0 + 37), fill=bg, outline=fg, width=2)
        d.text((x0 + 256, y0 + 19), txt, font=ft, fill=fg, anchor="mm")
    p = os.path.join(TEX, "T_Artigas_Sistemas.png")
    img.save(p)
    return p


def material_sistemas(path):
    m = bpy.data.materials.new("M_Artigas_Pantallas_Sistemas")
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(t.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.25
    return m


# ---------------------------------------------------------------- lugares (paredes) y modulo
class Lugar:
    """Una pared. Coordenadas locales: x a la derecha y z hacia afuera de la pared, mirandola desde adentro."""

    def __init__(self, origen, normal, u, mapa):
        n, u = Vector(normal), Vector(u)
        v = n.cross(u)
        o = Vector(origen)
        self.M = Matrix(((u.x, v.x, n.x, o.x), (u.y, v.y, n.y, o.y), (u.z, v.z, n.z, o.z), (0, 0, 0, 1)))
        self.mapa = mapa

    def P(self, a, b, d=0.0):
        """Punto de la estacion a partir de las dos coordenadas naturales de la pared y la distancia a ella."""
        lu, lv = self.mapa(a, b)
        return self.M @ Vector((lu, lv, d))

    def matriz(self, a, b, giro=0.0, d=0.0):
        lu, lv = self.mapa(a, b)
        return self.M @ Matrix.Translation((lu, lv, d)) @ Matrix.Rotation(giro, 4, "Z")


def estribor(ap=A):      # (y, z)
    return Lugar((ap, 0, 0), (-1, 0, 0), (0, -1, 0), lambda y, z: (-y, z))


def babor(ap=A):         # (y, z)
    return Lugar((-ap, 0, 0), (1, 0, 0), (0, 1, 0), lambda y, z: (y, z))


def techo(ap=A):         # (y, x)
    return Lugar((0, 0, ap), (0, 0, -1), (0, 1, 0), lambda y, x: (y, x))


def piso(ap=A):          # (y, x)
    return Lugar((0, 0, -ap), (0, 0, 1), (0, 1, 0), lambda y, x: (y, -x))


def mamparo(y, mira):    # (x, z). mira = +1 si la cara mira hacia +Y
    if mira > 0:
        return Lugar((0, y, 0), (0, 1, 0), (-1, 0, 0), lambda x, z: (-x, z))
    return Lugar((0, y, 0), (0, -1, 0), (1, 0, 0), lambda x, z: (x, z))


def volcar(q, destino, M):
    """Pasa la geometria de q (coordenadas locales) a destino, transformada por M, conservando los colores."""
    bmesh.ops.transform(q.bm, matrix=M, verts=q.bm.verts)
    me = bpy.data.meshes.new("_tmp")
    q.bm.to_mesh(me)
    q.bm.free()
    destino.bm.from_mesh(me)
    bpy.data.meshes.remove(me)


class Modulo:
    def __init__(self, letra, mat, col):
        self.letra, self.mat, self.col = letra, mat, col
        self.det = Part()
        self.quads = []          # (4 esquinas en la estacion, celda del atlas)
        self.n_bultos = 0
        self.objetos = []

    def poner(self, lugar, q, a, b, giro=0.0, d=0.0):
        volcar(q, self.det, lugar.matriz(a, b, giro, d))

    def bulto(self, lugar, q, a, b, giro=0.0):
        p = Part()
        volcar(q, p, lugar.matriz(a, b, giro))
        self.n_bultos += 1
        self.objetos.append(p.finish(f"{self.letra}_Bulto_{self.n_bultos}", self.mat, self.col, smooth_angle=35))

    def pantalla(self, lugar, celda, a, b, w, h=None, d=0.004, giro=0.0, dx=0.0, dy=0.0):
        """Rectangulo con una celda del atlas. dx, dy: corrimiento en las coordenadas locales de la pieza."""
        x0, y0, cw, ch = CELDAS[celda]
        h = h or w * ch / cw
        M = lugar.matriz(a, b, giro, d) @ Matrix.Translation((dx, dy, 0))
        esq = [M @ Vector(p) for p in ((-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0))]
        self.quads.append((esq, (x0 / 1024, 1 - (y0 + ch) / 1024, (x0 + cw) / 1024, 1 - y0 / 1024)))

    def cerrar(self, mat_sistemas):
        if self.det.bm.faces:
            self.objetos.append(self.det.finish(f"{self.letra}_Det_Ambientacion", self.mat, self.col, smooth_angle=35))
        if self.quads:
            me = bpy.data.meshes.new(f"SM_{self.letra}_Pantalla_Sistemas")
            verts, caras = [], []
            for esq, _ in self.quads:
                caras.append(tuple(range(len(verts), len(verts) + 4)))
                verts += [tuple(p) for p in esq]
            me.from_pydata(verts, [], caras)
            uv = me.uv_layers.new(name="UVMap")
            for i, (_, (u0, v0, u1, v1)) in enumerate(self.quads):
                for k, c in enumerate(((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
                    uv.data[i * 4 + k].uv = c
            me.materials.append(mat_sistemas)
            ob = bpy.data.objects.new(f"{self.letra}_Pantalla_Sistemas", me)
            self.col.objects.link(ob)
            self.objetos.append(ob)
        return self.objetos


# ---------------------------------------------------------------- tubos (cables, mangueras, ductos)
def redondear(pts, radio):
    """Reemplaza cada esquina de la poligonal por un arco corto de tres puntos."""
    pts = [Vector(p) for p in pts]
    if len(pts) < 3 or radio <= 0:
        return pts
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = pts[i - 1], pts[i], pts[i + 1]
        d1, d2 = min(radio, (b - a).length / 2.2), min(radio, (c - b).length / 2.2)
        p1, p2 = b + (a - b).normalized() * d1, b + (c - b).normalized() * d2
        out += [p1, 0.25 * p1 + 0.5 * b + 0.25 * p2, p2]
    out.append(pts[-1])
    return out


def tubo(part, pts, radio, color, lados=5, filete=0.035, tapas=False):
    """Tubo de seccion poligonal a lo largo de una poligonal (cable, manguera o ducto)."""
    pts = redondear(pts, filete)
    pts = [p for i, p in enumerate(pts) if i == 0 or (p - pts[i - 1]).length > 1e-4]
    if len(pts) < 2:
        return
    bm = bmesh.new()
    t0 = (pts[1] - pts[0]).normalized()
    n = t0.orthogonal().normalized()
    anillos = []
    for i, p in enumerate(pts):
        t = ((pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)])).normalized()
        n = (n - t * n.dot(t))
        n = n.normalized() if n.length > 1e-6 else t.orthogonal().normalized()
        b = t.cross(n)
        anillos.append([bm.verts.new(p + (n * math.cos(2 * math.pi * k / lados) + b * math.sin(2 * math.pi * k / lados)) * radio) for k in range(lados)])
    for i in range(len(anillos) - 1):
        for k in range(lados):
            j = (k + 1) % lados
            bm.faces.new((anillos[i][k], anillos[i][j], anillos[i + 1][j], anillos[i + 1][k]))
    if tapas:
        bm.faces.new(list(reversed(anillos[0])))
        bm.faces.new(anillos[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    part._merge(bm, color, (0, 0, 0), None)


def cable_pared(mod, lugar, recorrido, radio=0.007, color="goma", abrazaderas=True, d=None):
    """Cable sobre una pared: recorrido en las coordenadas de la pared, fijado con abrazaderas cada ~30 cm."""
    d = radio + 0.003 if d is None else d
    pts = [lugar.P(a, b, d) for a, b in recorrido]
    tubo(mod.det, pts, radio, color)
    if not abrazaderas:
        return
    for (a0, b0), (a1, b1) in zip(recorrido, recorrido[1:]):
        largo = math.hypot(a1 - a0, b1 - b0)
        (u0, v0), (u1, v1) = lugar.mapa(a0, b0), lugar.mapa(a1, b1)
        giro = math.atan2(v1 - v0, u1 - u0) + math.pi / 2          # la abrazadera cruza el cable
        n = int(largo / 0.32)
        for k in range(1, n + 1):
            f = k / (n + 1)
            q = Part()
            q.box((0, 0, d), (radio * 2 + 0.016, 0.016, radio * 2 + 0.006), "acero")
            mod.poner(lugar, q, a0 + (a1 - a0) * f, b0 + (b1 - b0) * f, giro)


def cable_libre(mod, p0, p1, holgura, radio=0.006, color="goma", n=7):
    """Cable entre dos puntos con holgura: en 0G no cuelga, hace una comba hacia donde lo dejaron."""
    p0, p1, h = Vector(p0), Vector(p1), Vector(holgura)
    pts = [p0 + (p1 - p0) * (i / n) + h * math.sin(math.pi * i / n) for i in range(n + 1)]
    tubo(mod.det, pts, radio, color, filete=0.02)


BANDEJA_COLORES = ("goma", "cable_gris", "azul", "goma", "correa", "cable_gris")


def bandeja(mod, lugar, a0, a1, b, cables=5, cajas=True):
    """Bandeja portacables a lo largo de la pared (repisa con labio), con sus cables atados y cajas de paso."""
    largo, medio = abs(a1 - a0), (a0 + a1) / 2
    q = Part()
    q.box((0, -0.004, 0.047), (largo, 0.004, 0.094), "gris")                 # repisa
    q.box((0, 0.011, 0.092), (largo, 0.026, 0.004), "gris")                  # labio
    n = max(2, int(largo / 0.55))
    for i in range(n + 1):
        x = -largo / 2 + 0.03 + (largo - 0.06) * i / n
        q.box((x, -0.022, 0.045), (0.018, 0.034, 0.09), "aluminio")          # mensula
        q.cyl((x, -0.048, 0.002), 0.006, 0.004, "acero", seg=6)              # tornillo de la mensula a la pared
    mod.poner(lugar, q, medio, b)
    for i in range(cables):
        r = 0.006 + 0.002 * (i % 3)
        dz = 0.014 + i * (0.066 / max(1, cables - 1))
        ini, fin = lugar.P(a0, b, dz), lugar.P(a1, b, dz)
        sube = lugar.M.to_3x3() @ Vector((0, r + 0.001, 0))
        tubo(mod.det, [ini + sube, fin + sube], r, BANDEJA_COLORES[i % len(BANDEJA_COLORES)], lados=5)
    m = max(2, int(largo / 0.4))
    for i in range(m):                                                       # precintos que retienen el mazo
        x = -largo / 2 + largo * (i + 0.5) / m
        q = Part()
        q.box((x, 0.012, 0.047), (0.008, 0.004, 0.088), "etiqueta")
        mod.poner(lugar, q, medio, b)
    if cajas:
        for a in (a0, a1):
            q = Part()
            q.box((0, 0.0, 0.05), (0.07, 0.11, 0.10), "gris", bevel=0.004)
            q.box((0, 0.0, 0.101), (0.05, 0.085, 0.003), "aluminio")
            for sy in (-0.035, 0.035):
                q.cyl((0.0, sy, 0.104), 0.005, 0.004, "acero", seg=6)
            mod.poner(lugar, q, a, b + 0.012)


# ---------------------------------------------------------------- piezas (coordenadas locales de la pared)
def tornillo(q, x, y, z=0.0, r=0.006):
    q.cyl((x, y, z + 0.002), r, 0.004, "acero", seg=6)


def panel_control(mod, lugar, a, b, w, h, filas, leyendas=(), semilla=1, pantalla=None):
    """Panel de control. filas: cadenas con i interruptor, b pulsador, s selector, l indicador, g interruptor con
    tapa, m medidor, espacio = hueco. pantalla: (celda, alto relativo 0..1) ocupa la franja superior."""
    rng = random.Random(semilla)
    q = Part()
    q.box((0, 0, 0.009), (w, h, 0.018), "aluminio", bevel=0.004)
    q.box((0, 0, 0.0185), (w - 0.018, h - 0.018, 0.003), "oscuro")
    for sx in (-1, 1):
        for sy in (-1, 1):
            tornillo(q, sx * (w / 2 - 0.012), sy * (h / 2 - 0.012), 0.018, 0.004)
    z = 0.02
    alto_util, y_top = h - 0.03, h / 2 - 0.015
    if pantalla:
        ph = alto_util * pantalla[1]
        pw = min(w - 0.04, ph * 1.6)
        q.box((0, y_top - ph / 2, z + 0.001), (pw + 0.012, ph + 0.012, 0.004), "pantalla")
        mod.pantalla(lugar, pantalla[0], a, b, pw, ph, d=z + 0.0045, dx=0, dy=y_top - ph / 2)
        y_top -= ph + 0.012
        alto_util -= ph + 0.012
    paso = alto_util / max(1, len(filas))
    ley = list(leyendas)
    for f, fila in enumerate(filas):
        y = y_top - paso * (f + 0.5)
        n = len(fila)
        for k, c in enumerate(fila):
            x = -w / 2 + 0.025 + (w - 0.05) * ((k + 0.5) / n)
            if c == "i":
                q.cyl((x, y, z + 0.003), 0.007, 0.006, "acero", seg=6)
                ang = math.radians(rng.choice((-24, 24)))
                q.box((x, y + 0.006 * math.copysign(1, ang), z + 0.014), (0.005, 0.005, 0.02), "aluminio", rot=Matrix.Rotation(-ang, 4, "X"))
            elif c == "b":
                q.cyl((x, y, z + 0.002), 0.011, 0.004, "acero", seg=8)
                q.cyl((x, y, z + 0.006), 0.008, 0.008, rng.choice(("led_verde", "led_ambar", "led_rojo", "gris", "gris")), seg=8)
            elif c == "s":
                q.cyl((x, y, z + 0.006), 0.014, 0.012, "goma", seg=10)
                q.box((x, y, z + 0.013), (0.004, 0.022, 0.003), "etiqueta", rot=Matrix.Rotation(math.radians(rng.choice((-50, -20, 15, 40))), 4, "Z"))
            elif c == "l":
                q.box((x, y, z + 0.002), (0.009, 0.009, 0.004), rng.choice(("led_verde", "led_verde", "led_verde", "led_ambar")))
            elif c == "g":
                q.cyl((x, y, z + 0.003), 0.007, 0.006, "acero", seg=6)
                q.box((x, y + 0.004, z + 0.012), (0.02, 0.032, 0.018), "rojo_mango", bevel=0.003)
            elif c == "m":
                q.cyl((x, y, z + 0.005), 0.03, 0.01, "acero", seg=12)
                mod.pantalla(lugar, rng.choice(list(DIALES)), a, b, 0.052, 0.052, d=z + 0.0105, dx=x, dy=y)
            if c in "ibsg" and ley and paso > 0.045:
                txt = ley.pop(0)
                mod.pantalla(lugar, "ley_" + txt, a, b, 0.036, 0.009, d=z + 0.001, dx=x, dy=y - 0.024)
    mod.poner(lugar, q, a, b)


def pantalla_sistema(mod, lugar, celda, a, b, w=0.17):
    """Pantalla chica de un sistema, con su marco."""
    h = w / 1.6
    q = Part()
    q.box((0, 0, 0.011), (w + 0.03, h + 0.03, 0.022), "oscuro", bevel=0.005)
    q.box((0, -h / 2 - 0.006, 0.023), (0.03, 0.006, 0.003), "led_verde")
    mod.poner(lugar, q, a, b)
    mod.pantalla(lugar, celda, a, b, w, h, d=0.0225)


def medidor(mod, lugar, celda, a, b, r=0.04):
    q = Part()
    q.cyl((0, 0, 0.011), r, 0.022, "acero", seg=12)
    q.cyl((0, -r - 0.012, 0.012), 0.008, 0.024, "aluminio", seg=6, axis="y")       # toma de presion
    mod.poner(lugar, q, a, b)
    mod.pantalla(lugar, celda, a, b, r * 1.72, r * 1.72, d=0.0225)


def rejilla(mod, lugar, a, b, w, h, adhesivo=None, giro=0.0):
    q = Part()
    q.box((0, 0, 0.006), (w, h, 0.012), "gris", bevel=0.003)
    q.box((0, 0, 0.0125), (w - 0.024, h - 0.024, 0.002), "goma")
    n = max(3, int((h - 0.03) / 0.022))
    for i in range(n):
        y = -h / 2 + 0.018 + (h - 0.036) * i / (n - 1)
        q.box((0, y, 0.016), (w - 0.028, 0.004, 0.012), "aluminio", rot=Matrix.Rotation(math.radians(35), 4, "X"))
    for sx in (-1, 1):
        for sy in (-1, 1):
            tornillo(q, sx * (w / 2 - 0.008), sy * (h / 2 - 0.008), 0.012, 0.004)
    mod.poner(lugar, q, a, b, giro)
    if adhesivo:
        mod.pantalla(lugar, adhesivo, a, b, min(w, 0.26), d=0.002, giro=giro, dy=-h / 2 - 0.022)


def panel_desmontable(mod, lugar, a, b, w, h, adhesivo="acceso", giro=0.0):
    q = Part()
    q.box((0, 0, 0.002), (w + 0.014, h + 0.014, 0.004), "gris")
    q.box((0, 0, 0.007), (w, h, 0.008), "panel", bevel=0.002)
    nx, ny = max(2, int(w / 0.16) + 1), max(2, int(h / 0.16) + 1)
    for i in range(nx):
        for j in range(ny):
            if i in (0, nx - 1) or j in (0, ny - 1):
                tornillo(q, -w / 2 + 0.016 + (w - 0.032) * i / (nx - 1), -h / 2 + 0.016 + (h - 0.032) * j / (ny - 1), 0.011, 0.005)
    q.torus_arc((0, -h * 0.18, 0.011), 0.035, 0.005, 0, 180, "acero", seg=6, rseg=5)   # manija
    mod.poner(lugar, q, a, b, giro)
    if adhesivo:
        mod.pantalla(lugar, adhesivo, a, b, min(w - 0.05, 0.22), d=0.0115, giro=giro, dy=h * 0.22)


def caja_electrica(mod, lugar, a, b, w=0.34, h=0.46, adhesivo="alta_tension"):
    """Tablero electrico con puerta, bisagras, termicas a la vista y prensacables arriba. Devuelve las bocas."""
    q = Part()
    q.box((0, 0, 0.035), (w, h, 0.07), "gris", bevel=0.006)
    q.box((0, 0, 0.072), (w - 0.03, h - 0.03, 0.006), "aluminio", bevel=0.002)
    for sy in (-0.3, 0.3):
        q.cyl((-w / 2 + 0.006, sy * h, 0.074), 0.007, 0.05, "acero", seg=6, axis="y")      # bisagras
    q.box((w / 2 - 0.03, 0, 0.079), (0.018, 0.05, 0.012), "goma", bevel=0.003)             # cierre
    q.box((0, h * 0.16, 0.076), (w * 0.62, h * 0.30, 0.003), "pantalla")                   # ventana de las termicas
    for i in range(8):
        x = -w * 0.26 + w * 0.52 * i / 7
        q.box((x, h * 0.16, 0.079), (0.018, h * 0.2, 0.006), "oscuro")
        q.box((x, h * 0.16 + (0.012 if i != 5 else -0.012), 0.084), (0.008, 0.016, 0.008), "etiqueta")
    q.box((-w * 0.2, -h * 0.34, 0.076), (0.01, 0.01, 0.004), "led_verde")
    q.box((-w * 0.12, -h * 0.34, 0.076), (0.01, 0.01, 0.004), "led_verde")
    bocas = []
    for i in range(3):
        x = -0.08 + 0.08 * i
        q.cyl((x, h / 2 + 0.012, 0.03), 0.014, 0.024, "acero", seg=8, axis="y")
        bocas.append((x, h / 2 + 0.024))
    mod.poner(lugar, q, a, b)
    if adhesivo:
        mod.pantalla(lugar, adhesivo, a, b, w * 0.7, d=0.0755, dx=0, dy=-h * 0.16)
    return bocas


def toma(mod, lugar, a, b):
    q = Part()
    q.box((0, 0, 0.012), (0.09, 0.06, 0.024), "gris", bevel=0.004)
    for sx in (-0.02, 0.02):
        q.cyl((sx, 0.004, 0.025), 0.012, 0.004, "goma", seg=8)
    q.box((0.034, -0.02, 0.025), (0.006, 0.006, 0.003), "led_verde")
    mod.poner(lugar, q, a, b)


def pasamuros(mod, lugar, a, b, n=3):
    """Placa con conectores industriales: ahi terminan los cables que cruzan de un modulo a otro."""
    w = 0.045 * n + 0.03
    q = Part()
    q.box((0, 0, 0.005), (w, 0.075, 0.01), "aluminio", bevel=0.003)
    xs = []
    for i in range(n):
        x = -w / 2 + 0.0375 + 0.045 * i
        q.cyl((x, 0, 0.02), 0.016, 0.022, "acero", seg=10)
        q.cyl((x, 0, 0.032), 0.011, 0.004, "goma", seg=8)
        xs.append(x)
    for sx in (-1, 1):
        for sy in (-1, 1):
            tornillo(q, sx * (w / 2 - 0.008), sy * 0.029, 0.01, 0.004)
    mod.poner(lugar, q, a, b)
    return xs


def modulo_com(mod, lugar, a, b):
    """Modulo de comunicaciones: parlante, perillas, pantalla y microfono de mano con cable en espiral."""
    q = Part()
    q.box((0, 0, 0.03), (0.32, 0.22, 0.06), "oscuro", bevel=0.006)
    for i in range(7):
        q.box((-0.10, -0.07 + i * 0.012, 0.062), (0.09, 0.005, 0.004), "gris")           # parlante
    for sx in (0.02, 0.07):
        q.cyl((sx, -0.07, 0.068), 0.013, 0.016, "goma", seg=10)
    for i in range(4):
        q.box((0.03 + i * 0.022, -0.035, 0.062), (0.008, 0.008, 0.004), ("led_verde", "led_verde", "led_ambar", "led_verde")[i])
    for sx in (-0.12, 0.12):
        q.cyl((sx, 0.11 + 0.012, 0.03), 0.01, 0.024, "acero", seg=8, axis="y")           # conectores de antena
    q.box((0.19, 0.0, 0.03), (0.035, 0.11, 0.035), "goma", bevel=0.006)                  # microfono de mano
    q.box((0.165, 0.0, 0.03), (0.02, 0.03, 0.02), "acero")                               # soporte
    esp = [Vector((0.19 + 0.012 * math.cos(t * 1.9), -0.06 - t * 0.012, 0.03 + 0.012 * math.sin(t * 1.9))) for t in range(22)]
    esp.append(Vector((0.13, -0.335, 0.03)))
    esp.append(Vector((0.10, -0.11, 0.03)))
    tubo(q, esp, 0.003, "goma", lados=4, filete=0.0)
    mod.poner(lugar, q, a, b)
    mod.pantalla(lugar, "comunicaciones", a, b, 0.13, 0.081, d=0.0625, dx=0.07, dy=0.045)


def consola(mod, lugar, a, b, celdas=("modulos", "electrico")):
    """Consola de monitoreo con dos pantallas y una fila de teclas."""
    q = Part()
    q.box((0, 0, 0.03), (0.46, 0.20, 0.06), "gris", bevel=0.008)
    q.box((0, 0.02, 0.061), (0.43, 0.135, 0.003), "pantalla")
    for i in range(10):
        q.box((-0.18 + i * 0.04, -0.075, 0.064), (0.026, 0.02, 0.008), "oscuro" if i % 4 else "celeste", bevel=0.002)
    mod.poner(lugar, q, a, b)
    for sx, c in zip((-0.107, 0.107), celdas):
        mod.pantalla(lugar, c, a, b, 0.2, 0.125, d=0.063, dx=sx, dy=0.02)


def extintor(mod, lugar, a, b):
    q = Part()
    q.box((0, 0, 0.004), (0.11, 0.36, 0.008), "gris", bevel=0.002)
    q.cyl((0, -0.02, 0.066), 0.055, 0.28, "rojo_mango", seg=12, axis="y")
    q.cyl((0, 0.135, 0.066), 0.022, 0.04, "acero", seg=8, axis="y")
    q.box((0, 0.165, 0.075), (0.03, 0.02, 0.06), "goma")                                 # gatillo
    q.cyl((0.04, 0.12, 0.066), 0.012, 0.09, "goma", seg=6, axis="y", radius2=0.02)       # tobera
    for sy in (-0.09, 0.06):
        q.box((0, sy, 0.064), (0.122, 0.022, 0.122), "acero", skip=("-z",))              # zunchos
    q.box((0, -0.02, 0.1225), (0.06, 0.08, 0.002), "etiqueta")
    mod.poner(lugar, q, a, b)
    mod.pantalla(lugar, "extintor", a, b, 0.11, d=0.002, dx=0, dy=-0.2)


def bolsillos(mod, lugar, a, b, w=0.34, h=0.42, filas=3, cols=3, semilla=3):
    """Organizador de tela con bolsillos; asoman mangos de herramientas y lapiceras."""
    rng = random.Random(semilla)
    q = Part()
    q.box((0, 0, 0.004), (w, h, 0.008), "tela_osc", bevel=0.002)
    q.box((0, h / 2 - 0.012, 0.009), (w - 0.02, 0.016, 0.003), "velcro")
    pw, ph = (w - 0.03) / cols, (h - 0.05) / filas
    for f in range(filas):
        for c in range(cols):
            x, y = -w / 2 + 0.015 + pw * (c + 0.5), -h / 2 + 0.012 + ph * (f + 0.4)
            q.box((x, y, 0.02), (pw - 0.012, ph * 0.62, 0.028), "tela", bevel=0.005)
            if rng.random() < 0.7:
                col = rng.choice(("rojo_mango", "azul", "vinilo_am", "goma", "acero"))
                q.cyl((x + rng.uniform(-0.02, 0.02), y + ph * 0.42, 0.022), rng.uniform(0.007, 0.012), ph * 0.36, col, seg=6, axis="y")
    for sx in (-1, 1):
        q.cyl((sx * (w / 2 - 0.014), h / 2 - 0.012, 0.011), 0.006, 0.004, "acero", seg=6)   # broches
    mod.poner(lugar, q, a, b)


def bolsa_pared(mod, lugar, a, b, w=0.5, h=0.38, d=0.2, color="tela", giro=0.0):
    """Bolsa de almacenamiento sujeta a la pared con dos correas y hebillas (asegurada: no flota)."""
    q = Part()
    q.box((0, 0, d / 2), (w, h, d), color, bevel=0.022, seg=2)
    for sx in (-w * 0.27, w * 0.27):
        q.box((sx, 0, d + 0.002), (0.03, h + 0.01, 0.004), "correa")
        for sy in (-1, 1):
            q.box((sx, sy * (h / 2 + 0.004), d / 2), (0.03, 0.004, d + 0.004), "correa")
            q.box((sx, sy * (h / 2 + 0.012), 0.006), (0.04, 0.02, 0.012), "acero")       # anclaje a la pared
        q.box((sx, h * 0.18, d + 0.007), (0.042, 0.05, 0.01), "acero", bevel=0.003)      # hebilla
    q.box((0, -h * 0.1, d + 0.001), (w * 0.3, h * 0.3, 0.003), "etiqueta")
    q.box((0, -h * 0.16, d + 0.003), (w * 0.24, 0.012, 0.002), "azul")
    q.box((0, h * 0.34, d + 0.001), (w * 0.4, 0.02, 0.003), "velcro")
    mod.bulto(lugar, q, a, b, giro)


def red_carga(mod, lugar, a, b, w=0.9, h=0.6, d=0.2, semilla=5, giro=0.0):
    """Red elastica que retiene bultos sueltos contra la pared, con ganchos a los anclajes."""
    rng = random.Random(semilla)
    q = Part()
    x = -w / 2 + 0.05
    while x < w / 2 - 0.12:                                                              # bultos bajo la red
        bw = rng.uniform(0.16, 0.28)
        bh = rng.uniform(h * 0.45, h * 0.8)
        bd = rng.uniform(d * 0.55, d * 0.9)
        col = rng.choice(("tela", "tela_osc", "polimero", "calabaza", "celeste"))
        q.box((x + bw / 2, rng.uniform(-0.04, 0.04), bd / 2), (bw, bh, bd), col, bevel=0.012)
        if col in ("polimero", "calabaza"):
            q.box((x + bw / 2, 0, bd + 0.001), (bw * 0.5, bh * 0.3, 0.002), "etiqueta")
        x += bw + 0.015
    nx, ny = max(3, int(w / 0.09)), max(3, int(h / 0.09))
    for i in range(nx + 1):
        q.box((-w / 2 + w * i / nx, 0, d + 0.004), (0.007 if i in (0, nx) else 0.004, h, 0.004), "tela_osc")
    for j in range(ny + 1):
        q.box((0, -h / 2 + h * j / ny, d + 0.004), (w, 0.007 if j in (0, ny) else 0.004, 0.004), "tela_osc")
    for sx in (-1, 1):
        for sy in (-1, 1):
            p0 = Vector((sx * w / 2, sy * h / 2, d + 0.004))
            p1 = Vector((sx * (w / 2 + 0.05), sy * (h / 2 + 0.05), 0.012))
            tubo(q, [p0, p1], 0.005, "correa", lados=4, filete=0)
            q.box(tuple(p1), (0.04, 0.04, 0.02), "acero", bevel=0.004)
    mod.bulto(lugar, q, a, b, giro)


def costilla(mod, lugar, a, medio_ancho=0.975, eje="b"):
    """Refuerzo estructural atornillado que cruza la pared (cuaderna)."""
    q = Part()
    largo = medio_ancho * 2
    q.box((0, 0, 0.009), (0.05, largo, 0.018), "gris", bevel=0.004)
    n = 6
    for i in range(n):
        tornillo(q, 0, -largo / 2 + 0.08 + (largo - 0.16) * i / (n - 1), 0.018, 0.006)
    mod.poner(lugar, q, a, 0.0)


def laptop(mod, lugar, a, b, celda="procedimiento"):
    """Computadora portatil en un brazo articulado, como las de procedimientos de una estacion real."""
    q = Part()
    q.box((0, 0, 0.012), (0.06, 0.06, 0.024), "acero", bevel=0.004)                      # mordaza a la pared
    tubo(q, [Vector((0, 0, 0.02)), Vector((0, 0.02, 0.16)), Vector((0, 0.10, 0.24))], 0.009, "acero", lados=6, filete=0.03)
    q.cyl((0, 0.02, 0.16), 0.016, 0.03, "goma", seg=8, axis="x")                         # articulacion
    q.box((0, 0.12, 0.245), (0.31, 0.21, 0.01), "oscuro", bevel=0.003)                   # tapa con la pantalla
    q.box((0, 0.12, 0.2505), (0.28, 0.18, 0.002), "pantalla")
    mod.poner(lugar, q, a, b)
    # la base del teclado va aparte para poder inclinarla sobre la bisagra
    base = Matrix.Translation((0, 0.012, 0.25)) @ Matrix.Rotation(math.radians(-72), 4, "X")
    k = Part()
    k.box((0, -0.105, 0.0), (0.31, 0.21, 0.014), "oscuro", bevel=0.003)
    k.box((0, -0.09, 0.0075), (0.27, 0.11, 0.002), "gris")
    k.box((0, -0.175, 0.0075), (0.09, 0.05, 0.002), "goma")
    volcar(k, mod.det, lugar.matriz(a, b) @ base)
    mod.pantalla(lugar, celda, a, b, 0.27, 0.169, d=0.2518, dx=0, dy=0.12)


def mecanismo_escotilla(mod, lugar, valvula=True):
    """Tornilleria del marco, burlete, dos trabas con palanca y la valvula manual de igualacion de presion."""
    q = Part()
    for t in (-0.36, -0.12, 0.12, 0.36):
        for s in (-1, 1):
            tornillo(q, s * 0.64, t, 0, 0.009)
            tornillo(q, t, s * 0.64, 0, 0.009)
    for sx in (-1, 1):
        for sy in (-1, 1):
            tornillo(q, sx * 0.565, sy * 0.565, 0, 0.009)
    for s in (-1, 1):                                                                     # burlete
        q.box((s * 0.6, 0, 0.004), (0.014, 0.78, 0.008), "goma")
        q.box((0, s * 0.6, 0.004), (0.78, 0.014, 0.008), "goma")
    for sx, sy in ((-1, 1), (1, -1)):                                                     # trabas
        r = Matrix.Rotation(math.radians(45 * sx * sy), 4, "Z")
        q.box((sx * 0.59, sy * 0.59, 0.02), (0.12, 0.055, 0.04), "gris", bevel=0.006, rot=r)
        q.box((sx * 0.59, sy * 0.59, 0.048), (0.10, 0.018, 0.016), "rojo_mango", bevel=0.004, rot=r)
        q.cyl((sx * 0.59, sy * 0.59, 0.043), 0.012, 0.012, "acero", seg=8)
    if valvula:
        q.cyl((0.61, 0.59, 0.016), 0.032, 0.032, "acero", seg=10)
        q.cyl((0.61, 0.59, 0.04), 0.012, 0.02, "aluminio", seg=8)
        q.box((0.61, 0.59, 0.054), (0.09, 0.016, 0.012), "rojo_mango", bevel=0.004, rot=Matrix.Rotation(math.radians(30), 4, "Z"))
    mod.poner(lugar, q, 0.0, 0.0)
    if valvula:
        ux, uz = (0.61, 0.59)
        lx = ux if lugar.mapa(1, 0)[0] > 0 else -ux      # el mecanismo se dibujo en locales: se busca su x natural
        mod.pantalla(lugar, "valvula", lx, uz - 0.075, 0.2, d=0.002)


def ducto(mod, pts, radio=0.055, color="tela_osc"):
    """Ducto flexible de ventilacion con abrazaderas de soporte."""
    pts = [Vector(p) for p in pts]
    tubo(mod.det, pts, radio, color, lados=8, filete=0.12)
    for a, b in zip(pts, pts[1:]):
        largo = (b - a).length
        n = int(largo / 0.45)
        eje = (b - a).normalized()
        for k in range(1, n + 1):
            c = a + (b - a) * (k / (n + 1))
            tubo(mod.det, [c - eje * 0.012, c + eje * 0.012], radio + 0.006, "gris", lados=8, filete=0, tapas=True)


# ---------------------------------------------------------------- distribucion por modulo
def tacuarembo(mod):
    E, B, T, P = estribor(), babor(), techo(), piso()
    fondo, mamp = mamparo(-6.77, +1), mamparo(-3.77, -1)
    # -- estribor: bandeja, tablero electrico, extintor, tomas, organizador y computadora de procedimientos
    bandeja(mod, E, -6.68, -3.86, ZB)
    bocas = caja_electrica(mod, E, -6.35, 0.30)
    for i, (bx, by) in enumerate(bocas):
        y = -6.35 - bx                                   # en estribor la x local va hacia -Y
        cable_pared(mod, E, [(y, 0.30 + by), (y, 0.66 - i * 0.03), (y + 0.06 * (i - 1), ZC)], 0.008, ("goma", "cable_gris", "azul")[i])
    extintor(mod, E, -6.50, -0.52)
    toma(mod, E, -6.14, -0.30)
    cable_pared(mod, E, [(-6.14, -0.27), (-6.14, -0.05), (-6.22, 0.05)], 0.006, "cable_gris")
    bolsillos(mod, E, -4.19, 0.42, semilla=7)
    toma(mod, E, -3.95, -0.38)
    laptop(mod, E, -4.32, -0.42)
    cable_libre(mod, E.P(-3.99, -0.38, 0.03), E.P(-4.32, -0.40, 0.2), (0, 0.0, -0.10), 0.005, "goma")
    cable_pared(mod, E, [(-3.93, -0.35), (-3.93, ZC)], 0.006, "goma")
    bolsa_pared(mod, E, -5.50, -0.88, 0.5, 0.3, 0.22)
    bolsa_pared(mod, E, -4.93, -0.88, 0.42, 0.3, 0.2, "tela_osc")
    # -- babor: instrumentos del soporte vital junto al rack, y retorno de aire al fondo
    for i, c in enumerate(("dial_o2", "dial_n2", "dial_presion")):
        medidor(mod, B, c, -4.10 + i * 0.11, 0.62)
    pantalla_sistema(mod, B, "ambiental", -3.99, 0.455)
    panel_control(mod, B, -3.99, -0.10, 0.36, 0.26, ["llllll", "iiiiii", "b s gb"], ("O2", "N2", "CO2", "AGUA", "VENT", "BOMBA 1", "BOMBA 2", "EMERG", "PRUEBA"), semilla=11)
    cable_pared(mod, B, [(-4.21, -0.30), (-4.12, -0.42), (-4.02, -0.42), (-4.02, -0.24)], 0.014, "acero")      # manguera de O2
    cable_pared(mod, B, [(-4.21, -0.48), (-4.08, -0.56), (-3.92, -0.56), (-3.92, -0.24)], 0.012, "celeste")    # manguera de agua
    cable_pared(mod, B, [(-3.85, 0.03), (-3.85, 0.15)], 0.006, "goma", abrazaderas=False)
    rejilla(mod, B, -6.55, 0.55, 0.30, 0.20, "retorno_aire")
    panel_desmontable(mod, B, -6.55, -0.15, 0.32, 0.42)
    # -- techo: ducto de ventilacion, bolsas de repuestos y cuadernas
    ducto(mod, [(-0.55, -6.60, 1.16), (-0.55, -6.60, 1.10), (-0.55, -3.95, 1.10), (-0.55, -3.95, 1.16)])
    for y in (-6.60, -3.95):
        q = Part()
        q.cyl((0, 0, 0.012), 0.075, 0.024, "gris", seg=10)
        mod.poner(T, q, y, -0.55)
    bolsa_pared(mod, T, -5.90, 0.42, 0.5, 0.4, 0.2)
    bolsa_pared(mod, T, -4.62, 0.42, 0.42, 0.36, 0.18, "tela_osc")
    for y in (-6.42, -5.25, -4.08):
        costilla(mod, T, y)
        costilla(mod, P, y)
    rejilla(mod, T, -5.25, 0.45, 0.30, 0.16, "suministro")
    # -- piso: paneles de acceso
    panel_desmontable(mod, P, -6.0, 0.0, 0.5, 0.5)
    panel_desmontable(mod, P, -4.65, 0.0, 0.5, 0.5, None)
    rejilla(mod, P, -5.62, -0.62, 0.36, 0.14)
    # -- fondo: consola electrica y retorno
    consola(mod, fondo, 0.0, 0.62, ("electrico", "temperatura"))
    rejilla(mod, fondo, 0.0, -0.84, 0.5, 0.18, "retorno_aire")
    pasamuros(mod, fondo, -0.86, 0.72, 3)
    cable_pared(mod, fondo, [(-0.86, 0.69), (-0.86, 0.62), (-0.26, 0.62)], 0.007, "goma")
    cable_pared(mod, fondo, [(-0.815, 0.69), (-0.815, 0.585), (-0.26, 0.585)], 0.006, "azul")
    mecanismo_escotilla(mod, mamp)
    pasamuros(mod, mamp, 0.88, 0.72, 4)
    cable_pared(mod, mamp, [(0.88, 0.76), (0.88, 0.93), (1.10, 0.93)], 0.008, "goma")


def nodo(mod):
    E, B, T, P = estribor(), babor(), techo(), piso()
    m0, m1 = mamparo(-3.31, +1), mamparo(-0.91, -1)
    bandeja(mod, B, -3.22, -1.00, ZB)
    bandeja(mod, E, -3.22, -1.00, ZB, cables=4)
    # -- estribor: comunicaciones, equipo de emergencia, consola de estado y tablero
    modulo_com(mod, E, -3.02, 0.42)
    cable_pared(mod, E, [(-2.90, 0.545), (-2.90, ZC)], 0.006, "cable_gris")
    cable_pared(mod, E, [(-3.14, 0.545), (-3.14, ZC)], 0.006, "goma")
    panel_desmontable(mod, E, -3.0, -0.44, 0.36, 0.30, "emergencia")
    consola(mod, E, -1.21, 0.42, ("modulos", "electrico"))
    cable_pared(mod, E, [(-1.21, 0.52), (-1.21, ZC)], 0.008, "goma")
    bocas = caja_electrica(mod, E, -1.21, -0.46)
    cable_pared(mod, E, [(-1.00, -0.20), (-1.00, ZC)], 0.008, "cable_gris")
    cable_pared(mod, E, [(-1.21 - bocas[1][0], -0.46 + bocas[1][1]), (-1.21, -0.12)], 0.007, "goma", abrazaderas=False)
    # -- babor: tomas, bolsa bajo el muelle de tabletas y extintor
    toma(mod, B, -3.10, 0.20)
    cable_pared(mod, B, [(-3.10, 0.23), (-3.10, 0.42)], 0.006, "goma", abrazaderas=False)
    pasamuros(mod, B, -3.10, -0.20, 2)
    bolsa_pared(mod, B, -2.11, -0.90, 0.5, 0.26, 0.2)
    extintor(mod, B, -1.12, -0.12)
    cable_pared(mod, B, [(-2.11, -0.44), (-2.11, -0.30)], 0.005, "goma", abrazaderas=False)       # alimentacion del muelle
    # -- techo: deposito transitorio bajo red y cuadernas
    red_carga(mod, T, -2.11, 0.0, 0.95, 0.7, 0.2, semilla=21)
    for y in (-3.05, -1.17):
        costilla(mod, T, y)
    panel_desmontable(mod, P, -3.03, 0.0, 0.4, 0.6)
    panel_desmontable(mod, P, -1.19, 0.0, 0.4, 0.6, None)
    for m in (m0, m1):
        mecanismo_escotilla(mod, m)
    pasamuros(mod, m0, -0.88, 0.72, 4)
    pasamuros(mod, m1, -0.88, 0.72, 4)
    cable_pared(mod, m0, [(-0.88, 0.76), (-0.88, 0.93), (-1.10, 0.93)], 0.008, "goma")
    cable_pared(mod, m1, [(-0.88, 0.76), (-0.88, 0.93), (-1.10, 0.93)], 0.008, "goma")


def rivera(mod):
    E, B, T, P = estribor(), babor(), techo(), piso()
    m0, m1 = mamparo(-0.45, +1), mamparo(4.65, -1)
    ya, yb = -0.235, 4.435                                   # franjas libres en las dos puntas del almacen
    # -- punta del Nodo
    pantalla_sistema(mod, E, "inventario", ya, 0.70)
    panel_control(mod, E, ya, 0.36, 0.30, 0.36, ["llll", "iiii", "bb s", "iigb"], ("ILUM", "VENT", "DATOS", "AUX", "BUS A", "BUS B", "PRUEBA", "EMERG"), semilla=4)
    cable_pared(mod, E, [(ya, 0.54), (ya, 0.635)], 0.006, "goma", abrazaderas=False)
    toma(mod, E, ya, -0.20)
    cable_pared(mod, E, [(ya + 0.1, 0.18), (ya + 0.1, -0.17)], 0.006, "cable_gris")
    rejilla(mod, E, ya, -0.65, 0.30, 0.18, "retorno_aire")
    bolsillos(mod, B, ya, 0.34, 0.34, 0.44, semilla=13)
    extintor(mod, B, ya, -0.48)
    rejilla(mod, T, ya, 0.0, 0.28, 0.6, None)
    panel_desmontable(mod, P, ya, 0.0, 0.32, 0.6)
    # -- punta de Colonia
    bocas = caja_electrica(mod, E, yb, 0.30, 0.32, 0.44)
    pasamuros(mod, E, yb, -0.28, 3)
    cable_pared(mod, E, [(yb - 0.045, -0.25), (yb - 0.045, 0.07)], 0.007, "goma", abrazaderas=False)
    cable_pared(mod, E, [(yb + 0.045, -0.25), (yb + 0.045, 0.07)], 0.007, "azul", abrazaderas=False)
    rejilla(mod, E, yb, -0.68, 0.30, 0.18)
    pantalla_sistema(mod, B, "carga", yb, 0.70)
    panel_control(mod, B, yb, 0.36, 0.30, 0.36, ["mm", "llll", "iiii", "b sg"], ("COM 1", "COM 2", "DATOS", "AUX", "PRUEBA", "EMERG"), semilla=9)
    toma(mod, B, yb, -0.20)
    bolsa_pared(mod, B, yb, -0.62, 0.34, 0.42, 0.16)
    rejilla(mod, T, yb, 0.0, 0.28, 0.6, None)
    panel_desmontable(mod, P, yb, 0.0, 0.32, 0.6, None)
    for m in (m0, m1):
        mecanismo_escotilla(mod, m)
    pasamuros(mod, m0, 0.88, 0.62, 4)
    pasamuros(mod, m1, 0.88, 0.62, 4)
    cable_pared(mod, m0, [(0.88, 0.66), (0.88, 1.0), (0.2, 1.0)], 0.008, "goma")
    cable_pared(mod, m1, [(0.88, 0.66), (0.88, 1.0), (0.2, 1.0)], 0.008, "cable_gris")
    cable_pared(mod, m0, [(-0.96, -0.5), (-0.96, -1.0), (-0.2, -1.05)], 0.012, "acero")
    cable_pared(mod, m1, [(0.96, -0.5), (0.96, -1.0), (0.2, -1.05)], 0.012, "acero")


def colonia(mod):
    E, B, T, P = estribor(), babor(), techo(), piso()
    m0 = mamparo(5.11, +1)
    bandeja(mod, B, 5.20, 8.34, ZB)
    bandeja(mod, E, 5.20, 8.34, ZB, cables=4)
    # -- estribor: tablero, panel de presion de la esclusa, instrumentos y manguera de igualacion
    bocas = caja_electrica(mod, E, 7.02, 0.30)
    cable_pared(mod, E, [(7.02, 0.55), (7.02, ZC)], 0.008, "goma", abrazaderas=False)
    pantalla_sistema(mod, E, "presion", 7.50, 0.64)
    pantalla_sistema(mod, E, "temperatura", 7.74, 0.64)
    panel_control(mod, E, 7.62, 0.32, 0.44, 0.34, ["llllllll", "iiiiiiii", "bb s  gg"], ("BUS A", "BUS B", "ILUM", "VENT", "BOMBA 1", "BOMBA 2", "COM 1", "DATOS", "PRUEBA", "EMERG"), semilla=23)
    cable_pared(mod, E, [(7.36, 0.49), (7.36, ZC)], 0.006, "cable_gris")
    for i, c in enumerate(("dial_presion", "dial_n2", "dial_temp")):
        medidor(mod, E, c, 8.03 + i * 0.11, 0.46)
    cable_pared(mod, E, [(8.14, 0.40), (8.14, 0.20), (8.30, 0.05), (8.30, -0.22)], 0.014, "acero")
    q = Part()
    q.cyl((0, 0, 0.02), 0.03, 0.04, "acero", seg=10)
    q.box((0, 0, 0.048), (0.08, 0.016, 0.012), "rojo_mango", bevel=0.004)
    mod.poner(E, q, 8.30, -0.26)
    extintor(mod, E, 5.42, -0.24)
    toma(mod, E, 5.76, -0.12)
    cable_pared(mod, E, [(5.76, -0.09), (5.76, 0.18)], 0.006, "goma", abrazaderas=False)
    bolsa_pared(mod, E, 5.60, -0.74, 0.5, 0.3, 0.2)
    # -- babor: bolsas, red de bultos y organizador despues de la cuarentena
    rejilla(mod, B, 5.50, 0.58, 0.30, 0.20, "retorno_aire")
    panel_desmontable(mod, B, 5.50, -0.30, 0.40, 0.50)
    bolsa_pared(mod, B, 7.30, 0.28, 0.48, 0.4, 0.22)
    bolsa_pared(mod, B, 7.82, 0.30, 0.42, 0.36, 0.2, "tela_osc")
    red_carga(mod, B, 7.56, -0.50, 0.85, 0.5, 0.18, semilla=31)
    bolsillos(mod, B, 8.22, 0.30, 0.30, 0.42, semilla=17)
    # -- techo y piso
    red_carga(mod, T, 6.20, 0.0, 0.9, 0.62, 0.2, semilla=41)
    bolsa_pared(mod, T, 7.55, -0.30, 0.5, 0.4, 0.2)
    for y in (5.58, 6.95, 8.10):
        costilla(mod, T, y)
    for y in (5.58, 6.30):
        costilla(mod, P, y)
    panel_desmontable(mod, P, 5.94, 0.0, 0.5, 0.5)
    mecanismo_escotilla(mod, m0)
    pasamuros(mod, m0, -0.88, 0.72, 4)
    cable_pared(mod, m0, [(-0.88, 0.76), (-0.88, 0.93), (-1.10, 0.93)], 0.008, "goma")
    # ---- bodega del carguero Charrua (misma letra de modulo: C)
    Tg, Pg, Eg, Bg = techo(AG), piso(AG), estribor(AG), babor(AG)
    mg, fg = mamparo(8.77, +1), mamparo(11.57, -1)
    mecanismo_escotilla(mod, mg)
    bandeja(mod, Tg, 8.86, 11.30, 0.62, cables=3, cajas=False)       # umbilical de energia y datos
    bolsa_pared(mod, Tg, 9.62, -0.30, 0.5, 0.4, 0.2)
    bolsa_pared(mod, Tg, 10.72, -0.30, 0.5, 0.4, 0.2, "tela_osc")
    for y in (9.20, 10.25, 11.32):
        costilla(mod, Tg, y, 0.9)
        costilla(mod, Pg, y, 0.9)
    red_carga(mod, Pg, 10.20, 0.0, 0.9, 0.6, 0.2, semilla=51)
    panel_desmontable(mod, Pg, 9.22, 0.0, 0.4, 0.5)
    caja_electrica(mod, fg, 0.72, 0.26, 0.32, 0.44, "transferencia")
    cable_pared(mod, fg, [(0.64, 0.50), (0.64, 1.05)], 0.008, "goma")
    cable_pared(mod, fg, [(0.72, 0.50), (0.72, 1.05)], 0.008, "cable_gris")
    cable_pared(mod, fg, [(0.80, 0.50), (0.80, 1.05)], 0.008, "azul")
    pantalla_sistema(mod, fg, "carga", -0.70, 0.52)
    panel_control(mod, fg, -0.70, 0.20, 0.36, 0.28, ["llllll", "iiiiii", "bb sgb"], ("BUS A", "BUS B", "ILUM", "VENT", "DATOS", "AUX", "PRUEBA", "EMERG"), semilla=29)
    for i, c in enumerate(("dial_presion", "dial_temp")):
        medidor(mod, fg, c, -0.76 + i * 0.12, -0.24)
    extintor(mod, fg, 0.78, -0.52)
    rejilla(mod, fg, 0.0, -0.82, 0.44, 0.18, "retorno_aire")
    toma(mod, Eg, 9.04, 0.1)
    pasamuros(mod, Eg, 9.04, -0.2, 3)
    bolsillos(mod, Bg, 9.04, 0.1, 0.30, 0.42, semilla=37)


# ---------------------------------------------------------------- objetos flotantes
def kit_flotantes(mat, col):
    """Modelos de los objetos sueltos, centrados en su origen. Devuelve {tipo: objeto}."""
    k = {}

    p = Part()                                           # portapapeles con una hoja
    p.box((0, 0, 0), (0.23, 0.32, 0.006), "calabaza", bevel=0.002)
    p.box((0, -0.008, 0.004), (0.21, 0.285, 0.002), "etiqueta")
    for i in range(7):
        p.box((-0.01 if i % 3 else 0.0, 0.09 - i * 0.03, 0.006), (0.16 if i % 3 else 0.18, 0.006, 0.003), "oscuro")
    p.box((0, 0.140, 0.0095), (0.09, 0.03, 0.012), "acero", bevel=0.003)
    k["Portapapeles"] = p.finish("SM_Flot_Portapapeles", mat, col, smooth_angle=35)

    p = Part()                                           # guante de trabajo
    p.box((0, 0, 0), (0.10, 0.11, 0.035), "tela", bevel=0.012, seg=2)
    p.box((0, -0.085, 0), (0.095, 0.06, 0.04), "azul", bevel=0.01)
    for i in range(4):
        p.box((-0.036 + i * 0.024, 0.09 - abs(i - 1.5) * 0.008, 0), (0.02, 0.075, 0.024), "tela", bevel=0.008)
    p.box((0.066, 0.0, 0), (0.022, 0.065, 0.024), "tela", bevel=0.008, rot=Matrix.Rotation(math.radians(-35), 4, "Z"))
    k["Guante"] = p.finish("SM_Flot_Guante", mat, col, smooth_angle=45)

    p = Part()                                           # manual tecnico
    p.box((0, 0, 0), (0.20, 0.26, 0.03), "azul", bevel=0.002)
    p.box((0.004, 0, 0), (0.198, 0.25, 0.024), "etiqueta")
    p.box((-0.02, 0.06, 0.0158), (0.13, 0.05, 0.001), "etiqueta")
    p.box((-0.02, -0.09, 0.0158), (0.13, 0.012, 0.001), "celeste")
    k["Manual"] = p.finish("SM_Flot_Manual", mat, col, smooth_angle=30)

    p = Part()                                           # contenedor chico con cierres
    p.box((0, 0, 0), (0.22, 0.16, 0.12), "polimero", bevel=0.01, seg=2)
    p.box((0, 0, 0.03), (0.224, 0.164, 0.008), "oscuro")
    for sx in (-0.06, 0.06):
        p.box((sx, -0.082, 0.03), (0.03, 0.01, 0.04), "acero")
    p.box((0, -0.081, -0.025), (0.12, 0.003, 0.045), "etiqueta")
    p.torus_arc((0, 0, 0.06), 0.04, 0.006, 0, 180, "goma", seg=6, rseg=5)
    k["Caja"] = p.finish("SM_Flot_Caja", mat, col, smooth_angle=35)

    p = Part()                                           # paquete logistico con cinta y etiqueta
    p.box((0, 0, 0), (0.26, 0.18, 0.14), "calabaza", bevel=0.004)
    p.box((0, 0, 0), (0.262, 0.04, 0.142), "etiqueta")
    p.box((0.06, -0.091, 0.01), (0.10, 0.002, 0.07), "etiqueta")
    p.box((0.06, -0.0925, -0.012), (0.08, 0.001, 0.01), "oscuro")
    p.box((-0.08, -0.091, 0.03), (0.04, 0.002, 0.04), "vinilo_am")
    k["Paquete"] = p.finish("SM_Flot_Paquete", mat, col, smooth_angle=30)

    p = Part()                                           # rollo de cinta
    p.torus_arc((0, 0, 0), 0.045, 0.02, 0, 360, "gris", seg=14, rseg=6)
    k["Cinta"] = p.finish("SM_Flot_Cinta", mat, col, smooth_angle=60)

    p = Part()                                           # linterna
    p.cyl((0, 0, 0), 0.016, 0.12, "oscuro", seg=10)
    p.cyl((0, 0, 0.075), 0.0175, 0.03, "oscuro", seg=10, radius2=0.026)
    p.cyl((0, 0, 0.092), 0.024, 0.004, "luz", seg=10)
    p.box((0.016, 0, 0.02), (0.006, 0.01, 0.02), "led_ambar")
    k["Linterna"] = p.finish("SM_Flot_Linterna", mat, col, smooth_angle=50)

    p = Part()                                           # bobina de cable atada con velcro
    for i in range(3):
        p.torus_arc((0, (i - 1) * 0.0135, 0), 0.07 + i * 0.002, 0.006, 0, 360, "goma", seg=14, rseg=5)
    p.box((0.07, 0, 0), (0.03, 0.05, 0.03), "velcro")
    tubo(p, [Vector((-0.07, 0, 0)), Vector((-0.10, 0.0, 0.03)), Vector((-0.12, 0.0, 0.09))], 0.006, "goma", lados=5, filete=0.02)
    p.cyl((-0.12, 0, 0.105), 0.011, 0.03, "acero", seg=8)
    k["Bobina"] = p.finish("SM_Flot_Bobina", mat, col, smooth_angle=60)

    p = Part()                                           # tableta
    p.box((0, 0, 0), (0.24, 0.16, 0.012), "oscuro", bevel=0.004)
    p.box((0, 0, 0.0065), (0.21, 0.13, 0.001), "pantalla_on")
    k["Tableta"] = p.finish("SM_Flot_Tableta", mat, col, smooth_angle=35)

    p = Part()                                           # lapicera
    p.cyl((0, 0, 0), 0.005, 0.13, "azul", seg=6)
    p.cyl((0, 0, 0.072), 0.0044, 0.014, "acero", seg=6, radius2=0.001)
    p.box((0.006, 0, -0.04), (0.003, 0.004, 0.04), "acero")
    k["Lapicera"] = p.finish("SM_Flot_Lapicera", mat, col, smooth_angle=50)

    p = Part()                                           # etiqueta de inventario con precinto
    p.box((0, 0, 0), (0.11, 0.065, 0.002), "etiqueta")
    p.box((0, 0.022, 0.0016), (0.106, 0.018, 0.001), "vinilo_am")
    for i in range(3):
        p.box((-0.01, 0.0 - i * 0.012, 0.0016), (0.07, 0.004, 0.001), "oscuro")
    p.torus_arc((-0.055, 0, 0), 0.03, 0.0025, 90, 270, "tela_osc", seg=8, rseg=4, plane="xy")
    k["Etiqueta"] = p.finish("SM_Flot_Etiqueta", mat, col, smooth_angle=40)

    p = Part()                                           # camara de fotos con teleobjetivo (Cupula)
    p.box((0, 0, 0), (0.15, 0.08, 0.10), "oscuro", bevel=0.008)
    p.box((-0.06, -0.01, 0.0), (0.04, 0.09, 0.09), "goma", bevel=0.01)
    p.cyl((0.01, -0.10, 0.0), 0.04, 0.12, "oscuro", seg=12, axis="y")
    p.cyl((0.01, -0.165, 0.0), 0.046, 0.02, "goma", seg=12, axis="y")
    p.cyl((0.01, -0.176, 0.0), 0.038, 0.002, "pantalla", seg=12, axis="y")
    p.box((0.02, 0.0, 0.058), (0.05, 0.05, 0.02), "oscuro", bevel=0.004)
    k["Camara"] = p.finish("SM_Flot_Camara", mat, col, smooth_angle=45)
    return k


# (tipo, x, y, z) en la estacion. Lejos del eje de paso y a mas de 20 cm de las paredes.
FLOTANTES = {
    "T": [("Portapapeles", 0.50, -5.20, 0.30), ("Llave", 0.58, -4.86, -0.02), ("Guante", -0.52, -4.40, 0.52),
          ("Cinta", 0.42, -5.62, 0.06), ("Linterna", -0.58, -6.28, -0.42), ("Bobina", 0.52, -6.18, 0.62),
          ("Destornillador", 0.62, -5.45, 0.10)],
    "N": [("Manual", 0.55, -2.92, 0.62), ("Tableta", -0.62, -1.62, -0.30), ("Lapicera", -0.64, -2.62, 0.16),
          ("Etiqueta", 0.62, -1.32, 0.70), ("Guante", 0.70, -3.02, -0.70)],
    "R": [("Escaner", 0.72, 0.52, 0.42), ("Paquete", -0.66, 1.82, -0.52), ("Portapapeles", 0.70, 2.92, -0.32),
          ("Caja", -0.70, 3.62, 0.52), ("Etiqueta", 0.62, 1.22, 0.74), ("Lapicera", 0.70, 2.80, -0.12)],
    "C": [("Paquete", 0.42, 7.42, -0.74), ("Guante", -0.56, 6.42, 0.60), ("Manual", 0.62, 5.62, 0.62),
          ("Caja", -0.50, 8.02, 0.72), ("Cinta", 0.66, 6.92, 0.74), ("Bolsa", 0.52, 9.22, -0.62),
          ("Paquete", -0.52, 10.62, 0.62), ("Linterna", 0.58, 11.22, 0.22), ("Portapapeles", -0.56, 9.42, 0.52)],
    "F": [("Camara", -0.62, -2.52, -1.80), ("Lapicera", 0.50, -1.66, -1.92)],
}
EXISTENTES = {"Llave": "SM_Llave_Inglesa", "Destornillador": "SM_Destornillador", "Escaner": "SM_Escaner", "Bolsa": "SM_BTC_1"}


def flotantes(mat, link, est_col):
    kit = kit_flotantes(mat, collection("Flotantes"))
    rng = random.Random(2026)
    n = 0
    for letra, lista in FLOTANTES.items():
        for i, (tipo, x, y, z) in enumerate(lista):
            src = kit.get(tipo) or bpy.data.objects[EXISTENTES[tipo]]
            rot = Matrix.Rotation(rng.uniform(0, 6.28), 4, Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))).normalized())
            link(src, f"{letra}_Flot_{tipo}_{i + 1}", Matrix.Translation((x, y, z)) @ rot, est_col)
            n += 1
    return n


def build(mat, link, est_col):
    """Agrega la ambientacion a la coleccion de la estacion armada. Devuelve un resumen por modulo."""
    mat_sis = material_sistemas(write_atlas())
    resumen = {}
    for letra, fn in (("T", tacuarembo), ("N", nodo), ("R", rivera), ("C", colonia)):
        mod = Modulo(letra, mat, est_col)
        fn(mod)
        obs = mod.cerrar(mat_sis)
        tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in obs)
        resumen[letra] = (len(obs), tris, len(mod.quads))
    resumen["flotantes"] = flotantes(mat, link, est_col)
    return resumen
