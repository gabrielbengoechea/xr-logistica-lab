"""
Comprueba que los manifests describen los archivos que hay en /models: que existen, que el tamaño coincide, que cada .glb
es glTF 2.0 válido y que sus nodos incluyen todas las piezas y encajes declarados.

- models/manifest.json: modelos del laboratorio (generar_modelos.py);
- models/proyectos/manifest.json: modelos de los otros proyectos (importar_proyectos.py), si existe.

    python3 models/tools/verificar_manifest.py
Sale con código 1 si encuentra algún problema.
"""
import json
import os
import struct
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def nodos_glb(ruta):
    with open(ruta, "rb") as f:
        datos = f.read()
    magia, version, largo = struct.unpack("<4sII", datos[:12])
    if magia != b"glTF" or version != 2 or largo != len(datos):
        raise ValueError(f"{ruta}: no es un glTF 2.0 binario válido")
    largo_json, tipo = struct.unpack("<I4s", datos[12:20])
    if tipo != b"JSON":
        raise ValueError(f"{ruta}: el primer bloque no es JSON")
    gltf = json.loads(datos[20:20 + largo_json])
    return {n.get("name") for n in gltf.get("nodes", [])}


def verificar(manifest, ids):
    errores = []
    for a in manifest["activos"]:
        if a["id"] in ids:
            errores.append(f"id repetido: {a['id']}")
        ids.add(a["id"])
        if "glb" not in a["archivos"]:
            errores.append(f"{a['id']}: falta el .glb en el manifest")
            continue
        for tipo, rel in a["archivos"].items():
            ruta = os.path.join(RAIZ, rel)
            if not os.path.isfile(ruta):
                errores.append(f"{a['id']}: falta {rel}")
            elif os.path.getsize(ruta) != a["bytes"][tipo]:
                errores.append(f"{a['id']}: {rel} pesa {os.path.getsize(ruta)} B y el manifest dice {a['bytes'][tipo]} B")
        try:
            nodos = nodos_glb(os.path.join(RAIZ, a["archivos"]["glb"]))
        except (OSError, ValueError) as e:
            errores.append(str(e))
            continue
        for p in a["piezas"]:
            if p["nodo"] not in nodos:
                errores.append(f"{a['id']}: la pieza {p['nodo']} no está en el glb")
            if len(p["explotar"]) != 3:
                errores.append(f"{a['id']}: {p['nodo']} tiene un desplazamiento inválido")
        for e in a["encajes"]:
            if e["nodo"] not in nodos:
                errores.append(f"{a['id']}: el encaje {e['nodo']} no está en el glb")
        if a["nodo_raiz"] not in nodos:
            errores.append(f"{a['id']}: falta el nodo raíz {a['nodo_raiz']}")
    return errores


def main():
    errores = []
    ids = set()
    total = 0
    for rel in ("manifest.json", os.path.join("proyectos", "manifest.json")):
        ruta = os.path.join(RAIZ, rel)
        if not os.path.isfile(ruta):
            if rel == "manifest.json":
                errores.append("falta models/manifest.json")
            continue
        with open(ruta, encoding="utf-8") as f:
            manifest = json.load(f)
        errores += verificar(manifest, ids)
        total += len(manifest["activos"])
    for e in errores:
        print("ERROR", e)
    print(f"{total} activos, {len(errores)} problemas")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
