"""
Suma al laboratorio los modelos 3D de los otros proyectos, en models/proyectos/ con su propio manifest.

| Proyecto | Origen |
|---|---|
| Terminal portuaria | logistica3d: kit portuario de Blender (`tools/blender/kit_portuario/construir_todo.py`) |
| Juego del montacargas | quest-xr-pilotos/autoelevador/modelo |
| Atlas XR | quest-xr-pilotos/atlas-xr/modelo |
| Brazo robótico (RA) | quest-xr-pilotos/robot-6-ejes/modelo |

    python3 models/tools/importar_proyectos.py --quest ../quest-xr-pilotos --kit SALIDA_DEL_KIT [--kit OTRA_SALIDA]

`--kit` es la carpeta que escribe `construir_todo.py --out` del kit portuario: tiene un `<Activo>_web.glb` por activo.
Se puede pasar varias veces (por ejemplo, si se armaron por separado las grúas y los buques).

Como models/glb, models/fbx y models/blend, esta carpeta no se edita a mano: se regenera con este script. El manifest de
proyectos usa el mismo formato que models/manifest.json, más `proyecto` y `origen`. Los modelos de los proyectos no
siguen la convención Part_*: acá se declaran sus piezas móviles (con nombre y material en español) y el desplazamiento de
la vista explotada se calcula alejando cada pieza del centro del conjunto. Sin dependencias: lee el glTF a mano.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import struct
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "proyectos")

PROYECTOS = {
    "puerto": {"nombre": "Terminal portuaria", "origen": "logistica3d · kit portuario de Blender (tools/blender/kit_portuario)"},
    "autoelevador": {"nombre": "Juego del montacargas", "origen": "quest-xr-pilotos · autoelevador/modelo"},
    "atlas": {"nombre": "Atlas XR", "origen": "quest-xr-pilotos · atlas-xr/modelo"},
    "robot": {"nombre": "Brazo robótico (RA)", "origen": "quest-xr-pilotos · robot-6-ejes/modelo"},
}

# fuente: ("kit", archivo) o ("quest", ruta relativa). extras: otros formatos para descargar (usdz para la RA del iPhone).
# piezas: (nodo, nombre, material). encajes: (prefijo de nodo, acepta, tolerancia_m).
ACTIVOS = [
    {
        "id": "puerto-sts", "proyecto": "puerto", "fuente": ("kit", "STS_Crane_web.glb"), "raiz": "STS_Crane",
        "nombre": "Grúa pórtico de muelle (STS)", "categoria": "Puerto",
        "descripcion": "Grúa de muelle de 28 m de trocha y 60 m de alcance: pluma abatible, carro, spreader telescópico de 20'/40' con twistlocks.",
        "piezas": [("Boom_Hinge", "Pluma abatible", "Acero pintado"), ("Forestays", "Tirantes de la pluma", "Cable de acero"),
                   ("Trolley", "Carro", "Acero pintado"), ("Spreader", "Spreader telescópico", "Acero pintado")],
    },
    {
        "id": "puerto-rtg", "proyecto": "puerto", "fuente": ("kit", "RTG_Crane_web.glb"), "raiz": "RTG_Crane",
        "nombre": "Grúa de patio sobre neumáticos (RTG)", "categoria": "Puerto",
        "descripcion": "Grúa de patio de 23,5 m de trocha para 6 filas y 5 niveles, con bogies que giran 90° para cambiar de bloque.",
        "piezas": [("Trolley.001", "Carro", "Acero pintado"), ("Bogie_FL", "Bogie delantero izquierdo", "Acero y caucho"),
                   ("Bogie_FR", "Bogie delantero derecho", "Acero y caucho"), ("Bogie_RL", "Bogie trasero izquierdo", "Acero y caucho"),
                   ("Bogie_RR", "Bogie trasero derecho", "Acero y caucho")],
    },
    {
        "id": "puerto-buque", "proyecto": "puerto", "fuente": ("kit", "Ship_Panamax_web.glb"), "raiz": "Ship_Panamax",
        "nombre": "Buque portacontenedores Panamax", "categoria": "Puerto",
        "descripcion": "Buque de 262 × 32,2 m (calado 11,5 m) con superestructura a popa, timón y hélice.",
        "piezas": [("Rudder.001", "Timón", "Acero"), ("Propeller.001", "Hélice", "Bronce"), ("Funnel_Band.001", "Franja de la chimenea", "Pintura")],
    },
    {
        "id": "puerto-contenedor-40", "proyecto": "puerto", "fuente": ("kit", "Container_40_web.glb"), "raiz": "Container_40",
        "nombre": "Contenedor ISO de 40'", "categoria": "Puerto",
        "descripcion": "Contenedor 42G1 (12,19 × 2,44 × 2,59 m) con chapa corrugada y esquineros ISO 1161 para apilar.",
        "piezas": [],
        "encajes": [("Socket_40_T", "contenedor_40", 0.025)],
    },
    {
        "id": "puerto-tractor-patio", "proyecto": "puerto", "fuente": ("kit", "Yard_Tractor_web.glb"), "raiz": "Yard_Tractor",
        "nombre": "Tractor de terminal", "categoria": "Puerto",
        "descripcion": "Tractor de patio que lleva los contenedores entre el muelle y los bloques, con quinta rueda.",
        "piezas": [("Steer_FL.001", "Rueda delantera izquierda", "Caucho"), ("Steer_FR.001", "Rueda delantera derecha", "Caucho"),
                   ("Wheel_RL", "Rueda trasera izquierda", "Caucho"), ("Wheel_RR", "Rueda trasera derecha", "Caucho")],
    },
    {
        "id": "juego-autoelevador", "proyecto": "autoelevador", "fuente": ("quest", "autoelevador/modelo/Autoelevador_web.glb"),
        "raiz": "Forklift_Root", "nombre": "Autoelevador del juego", "categoria": "Equipos de manipulación",
        "descripcion": "El montacargas del juego en VR: mástil de dos etapas, carro con horquillas, palancas de elevación, inclinación y desplazamiento lateral, pedales y volante.",
        "piezas": [("Mast_Outer_Stage", "Mástil exterior", "Acero"), ("Mast_Inner_Stage", "Mástil interior", "Acero"),
                   ("Fork_Carriage", "Carro portahorquillas", "Acero"), ("Fork_Left", "Horquilla izquierda", "Acero forjado"),
                   ("Fork_Right", "Horquilla derecha", "Acero forjado"), ("Steering_Wheel", "Volante", "Plástico"),
                   ("Rear_Axle", "Eje trasero direccional", "Acero"), ("Wheel_Front_Left", "Rueda delantera izquierda", "Caucho"),
                   ("Wheel_Front_Right", "Rueda delantera derecha", "Caucho")],
    },
    {
        "id": "juego-deposito", "proyecto": "autoelevador", "fuente": ("quest", "autoelevador/modelo/Deposito_web.glb"),
        "raiz": "Warehouse_Root", "nombre": "Depósito del juego", "categoria": "Almacenamiento",
        "descripcion": "La nave del juego: racks de 4 calles con 24 posiciones, 12 pallets con carga, conos y 3 zonas de entrega.",
        "piezas": [("Racks", "Racks", "Acero pintado"), ("Pallet_01", "Pallet 1 con carga", "Madera"), ("Pallet_02", "Pallet 2 con carga", "Madera"),
                   ("Pallet_03", "Pallet 3 con carga", "Madera")],
        "encajes": [("DropZone_", "pallet", 0.25), ("RackSlot_", "pallet", 0.1)],
    },
    {
        "id": "atlas-xr", "proyecto": "atlas", "fuente": ("quest", "atlas-xr/modelo/AtlasXR_web.glb"), "raiz": "Atlas_Base",
        "nombre": "Atlas XR: globo logístico", "categoria": "Geografía logística",
        "descripcion": "Globo terráqueo con 39 puertos y pasos estratégicos y las principales rutas marítimas, sobre su base.",
        "extras": {"usdz": ("quest", "atlas-xr/modelo/AtlasXR.usdz")},
        "piezas": [("Globe_Sphere", "Globo", "Mapa pintado"), ("Logistics_Nodes_Group", "Puertos y pasos", "Marcadores"),
                   ("Logistics_Routes", "Rutas marítimas", "Líneas")],
    },
    {
        "id": "robot-6-ejes", "proyecto": "robot", "fuente": ("quest", "robot-6-ejes/modelo/Robot6Ejes_web.glb"), "raiz": "Base_Mesh",
        "nombre": "Brazo robótico de 6 ejes", "categoria": "Automatización",
        "descripcion": "Robot industrial articulado de la RA de mesa: base, hombro, brazo, codo y muñeca de 3 ejes.",
        "extras": {"usdz": ("quest", "robot-6-ejes/modelo/Robot6Ejes.usdz")},
        "piezas": [("Shoulder_Joint", "Hombro (eje 1-2)", "Aluminio fundido"), ("Upper_Arm", "Brazo", "Aluminio fundido"),
                   ("Elbow_Joint", "Codo (eje 3)", "Aluminio fundido"), ("Wrist_1", "Muñeca (eje 4)", "Aluminio"),
                   ("Wrist_2", "Muñeca (eje 5)", "Aluminio"), ("Wrist_3", "Brida de herramienta (eje 6)", "Acero")],
    },
]

# Mallas que no son parte del objeto visible: colisiones del kit, niveles de detalle bajos y planos de sombra.
def es_auxiliar(nombre: str) -> bool:
    n = nombre or ""
    return n.startswith("UCX_") or n.startswith("ShadowCatcher") or any(f"_LOD{k}" in n for k in (1, 2, 3))


# ---------------------------------------------------------------------------------------------------------------------
# glTF mínimo: matrices de los nodos y cajas de las mallas
# ---------------------------------------------------------------------------------------------------------------------
def leer_glb(ruta: str) -> dict:
    with open(ruta, "rb") as f:
        datos = f.read()
    magia, version, _ = struct.unpack("<4sII", datos[:12])
    if magia != b"glTF" or version != 2:
        raise ValueError(f"{ruta}: no es glTF 2.0 binario")
    largo = struct.unpack("<I", datos[12:16])[0]
    return json.loads(datos[20:20 + largo])


def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def mat_nodo(n: dict):
    if "matrix" in n:
        m = n["matrix"]
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    tx, ty, tz = n.get("translation", [0, 0, 0])
    x, y, z, w = n.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = n.get("scale", [1, 1, 1])
    r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[r[0][0] * sx, r[0][1] * sy, r[0][2] * sz, tx],
            [r[1][0] * sx, r[1][1] * sy, r[1][2] * sz, ty],
            [r[2][0] * sx, r[2][1] * sy, r[2][2] * sz, tz],
            [0, 0, 0, 1]]


def aplicar(m, p):
    return [m[i][0] * p[0] + m[i][1] * p[1] + m[i][2] * p[2] + m[i][3] for i in range(3)]


class Escena:
    def __init__(self, gltf: dict):
        self.g = gltf
        self.nodos = gltf.get("nodes", [])
        self.padre = {}
        for i, n in enumerate(self.nodos):
            for c in n.get("children", []):
                self.padre[c] = i
        self.mundo = {}
        for r in gltf["scenes"][gltf.get("scene", 0)]["nodes"]:
            self._recorrer(r, [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])

    def _recorrer(self, i, m_padre):
        m = mat_mul(m_padre, mat_nodo(self.nodos[i]))
        self.mundo[i] = m
        for c in self.nodos[i].get("children", []):
            self._recorrer(c, m)

    def indice(self, nombre: str):
        for i, n in enumerate(self.nodos):
            if n.get("name") == nombre:
                return i
        return None

    def subarbol(self, i):
        yield i
        for c in self.nodos[i].get("children", []):
            yield from self.subarbol(c)

    def caja(self, raiz_idx):
        lo = [math.inf] * 3
        hi = [-math.inf] * 3
        for i in self.subarbol(raiz_idx):
            n = self.nodos[i]
            if "mesh" not in n or es_auxiliar(n.get("name", "")) or i not in self.mundo:
                continue
            for p in self.g["meshes"][n["mesh"]]["primitives"]:
                acc = self.g["accessors"][p["attributes"]["POSITION"]]
                a, b = acc["min"], acc["max"]
                for x in (a[0], b[0]):
                    for y in (a[1], b[1]):
                        for z in (a[2], b[2]):
                            q = aplicar(self.mundo[i], (x, y, z))
                            lo = [min(lo[k], q[k]) for k in range(3)]
                            hi = [max(hi[k], q[k]) for k in range(3)]
        return (lo, hi) if lo[0] != math.inf else None

    def triangulos(self, raiz_idx):
        t = 0
        for i in self.subarbol(raiz_idx):
            n = self.nodos[i]
            if "mesh" not in n or es_auxiliar(n.get("name", "")):
                continue
            for p in self.g["meshes"][n["mesh"]]["primitives"]:
                cuenta = self.g["accessors"][p["indices"]]["count"] if "indices" in p else self.g["accessors"][p["attributes"]["POSITION"]]["count"]
                t += cuenta // 3
        return t


def centro(c):
    return [(c[0][k] + c[1][k]) / 2 for k in range(3)]


def r4(v):
    return [round(x, 4) + 0.0 for x in v]


# ---------------------------------------------------------------------------------------------------------------------
def fuente(args, f):
    tipo, rel = f
    if tipo == "quest":
        return os.path.join(args.quest, rel)
    for d in args.kit:
        ruta = os.path.join(d, rel)
        if os.path.isfile(ruta):
            return ruta
    return os.path.join(args.kit[0] if args.kit else "", rel)


def importar(args, a: dict) -> dict:
    origen = fuente(args, a["fuente"])
    if not os.path.isfile(origen):
        raise FileNotFoundError(f"{a['id']}: no encuentro {origen}")
    carpeta = os.path.join(DESTINO, a["proyecto"])
    os.makedirs(carpeta, exist_ok=True)
    archivos = {"glb": f"proyectos/{a['proyecto']}/{a['id']}.glb"}
    shutil.copyfile(origen, os.path.join(RAIZ, archivos["glb"]))
    for fmt, f in a.get("extras", {}).items():
        ruta = fuente(args, f)
        if os.path.isfile(ruta):
            archivos[fmt] = f"proyectos/{a['proyecto']}/{a['id']}.{fmt}"
            shutil.copyfile(ruta, os.path.join(RAIZ, archivos[fmt]))
        else:
            print(f"  aviso: {a['id']} sin {fmt} ({ruta})")

    esc = Escena(leer_glb(os.path.join(RAIZ, archivos["glb"])))
    raiz = esc.indice(a["raiz"])
    if raiz is None:
        raise ValueError(f"{a['id']}: el glb no tiene el nodo raíz {a['raiz']}")
    # la caja del conjunto toma todas las raíces visibles de la escena (el globo y su base, el robot y su base…)
    cajas = [esc.caja(r) for r in esc.g["scenes"][esc.g.get("scene", 0)]["nodes"]]
    cajas = [c for c in cajas if c]
    lo = [min(c[0][k] for c in cajas) for k in range(3)]
    hi = [max(c[1][k] for c in cajas) for k in range(3)]
    medidas = [hi[k] - lo[k] for k in range(3)]
    ctr = [(lo[k] + hi[k]) / 2 for k in range(3)]
    tamano = max(medidas)
    tris = sum(esc.triangulos(r) for r in esc.g["scenes"][esc.g.get("scene", 0)]["nodes"])

    piezas = []
    nombres = {n.get("name") for n in esc.nodos}
    declaradas = {p[0] for p in a["piezas"]}
    for nodo, nombre, material in a["piezas"]:
        i = esc.indice(nodo)
        if i is None:
            raise ValueError(f"{a['id']}: no está la pieza {nodo}")
        c = esc.caja(i)
        if c is None:
            raise ValueError(f"{a['id']}: la pieza {nodo} no tiene malla")
        # pieza declarada más cercana hacia arriba en la jerarquía (el codo cuelga del brazo, que cuelga del hombro)
        padre = esc.padre.get(i)
        while padre is not None and esc.nodos[padre].get("name") not in declaradas:
            padre = esc.padre.get(padre)
        nombre_padre = esc.nodos[padre].get("name") if padre is not None else None
        # Se aleja del centro del conjunto o, si es hija de otra pieza, del centro de esa pieza (así una cadena se
        # estira en vez de salir toda para el mismo lado). Nunca hacia abajo: no atraviesa el piso.
        base = centro(esc.caja(padre)) if padre is not None else ctr
        d = [centro(c)[k] - base[k] for k in range(3)]
        d[1] = max(d[1], 0.0)
        largo = math.sqrt(sum(x * x for x in d))
        direccion = [x / largo for x in d] if largo > 0.02 * tamano else [0.0, 1.0, 0.0]
        dist = (0.12 if padre is not None else 0.22) * tamano
        piezas.append({
            "nodo": nodo, "nombre": nombre, "material": material, "masa_kg": None,
            "explotar": r4([direccion[k] * dist for k in range(3)]),
            "padre": nombre_padre,
        })
    encajes = []
    for prefijo, acepta, tol in a.get("encajes", []):
        for i, n in enumerate(esc.nodos):
            if n.get("name", "").startswith(prefijo) and i in esc.mundo:
                encajes.append({"nodo": n["name"], "acepta": acepta, "tolerancia_m": tol, "posicion": r4(aplicar(esc.mundo[i], (0, 0, 0)))})
    if not nombres >= {p["nodo"] for p in piezas}:
        raise ValueError(f"{a['id']}: piezas fuera del glb")
    return {
        "id": a["id"], "proyecto": a["proyecto"], "nodo_raiz": a["raiz"], "nombre": a["nombre"], "categoria": a["categoria"],
        "descripcion": a["descripcion"], "origen": PROYECTOS[a["proyecto"]]["origen"], "archivos": archivos,
        "bytes": {k: os.path.getsize(os.path.join(RAIZ, v)) for k, v in archivos.items()},
        "medidas_m": r4(medidas), "triangulos": tris, "masa_kg": None, "piezas": piezas, "encajes": encajes,
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--quest", required=True, help="Copia local del repositorio quest-xr-pilotos")
    ap.add_argument("--kit", action="append", default=[], help="Salida de construir_todo.py del kit portuario (se puede repetir)")
    args = ap.parse_args(argv)
    if os.path.isdir(DESTINO):
        shutil.rmtree(DESTINO)
    os.makedirs(DESTINO)
    activos = []
    for a in ACTIVOS:
        r = importar(args, a)
        activos.append(r)
        print(f"  {r['id']:24s} {len(r['piezas']):2d} piezas, {len(r['encajes']):2d} encajes, {r['triangulos']:6d} triángulos, "
              f"{sum(r['bytes'].values()) / 1e6:5.1f} MB ({', '.join(r['archivos'])})")
    manifest = {
        "version": 1, "unidades": "metros", "ejes": "glTF (Y arriba, -Z adelante en Unity)",
        "proyectos": {k: v["nombre"] for k, v in PROYECTOS.items()},
        "activos": activos,
    }
    with open(os.path.join(DESTINO, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{len(activos)} activos de {len(PROYECTOS)} proyectos en models/proyectos/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
