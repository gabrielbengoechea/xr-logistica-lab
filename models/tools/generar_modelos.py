"""
Genera los activos 3D del laboratorio (Blender 5.2 / bpy) con piezas separadas para la vista explotada y puntos de
encaje (Snap Zones). Todo es paramétrico: no hay modelos hechos a mano.

    python3 models/tools/generar_modelos.py            # con el bpy de pip
    blender -b -P models/tools/generar_modelos.py      # con Blender

Salida (relativa a /models):
    glb/<id>.glb      glTF binario (Y arriba, metros) para la web y para glTFast en Unity
    fbx/<id>.fbx      FBX (escala 1, Y arriba, -Z adelante) para importar en Unity
    blend/<id>.blend  fuente editable
    manifest.json     piezas, encajes, medidas y triángulos de cada activo

Convenciones (las usan el backend, el visor web y el cliente VR):
    raíz       <Id> (vacío) con propiedades: nombre, categoria, descripcion
    piezas     Part_<Nombre> (malla) con: pieza, material, masa_kg, explotar = [x, y, z] (desplazamiento de la vista
               explotada en metros, en coordenadas glTF: y arriba)
    encajes    Snap_<Id> (vacío) con: encaje (tipo de pieza que acepta), tolerancia_m
Las piezas que son hijas de otra pieza se mueven con ella (p. ej. las horquillas con el carro del montacargas).
"""
import json
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ---------------------------------------------------------------------------------------------------------------------
# Escena y materiales
# ---------------------------------------------------------------------------------------------------------------------
def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0


_mats = {}


def material(nombre, color, rugosidad=0.6, metalico=0.0, emision=None):
    if nombre in _mats:
        return _mats[nombre]
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    rgb = tuple(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb)
    bsdf.inputs["Base Color"].default_value = (*lin, 1.0)
    bsdf.inputs["Roughness"].default_value = rugosidad
    bsdf.inputs["Metallic"].default_value = metalico
    if emision:
        e = tuple(int(emision[i:i + 2], 16) / 255 for i in (1, 3, 5))
        bsdf.inputs["Emission Color"].default_value = (*e, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 2.0
    m.diffuse_color = (*lin, 1.0)
    _mats[nombre] = m
    return m


def mats():
    return {
        "amarillo": material("Pintura_Amarillo", "#F2B705", 0.45, 0.1),
        "gris": material("Pintura_Gris", "#5B6670", 0.5, 0.2),
        "negro": material("Caucho_Negro", "#1C1E21", 0.85),
        "acero": material("Acero", "#B8BEC4", 0.3, 1.0),
        "acero_oscuro": material("Acero_Oscuro", "#4A4F55", 0.4, 1.0),
        "azul": material("Pintura_Azul", "#1F5FAD", 0.45, 0.1),
        "naranja": material("Pintura_Naranja", "#E8641B", 0.45, 0.1),
        "aluminio": material("Aluminio_Anodizado", "#C9CED3", 0.35, 1.0),
        "pcb": material("PCB_Verde", "#1E6B3A", 0.55),
        "cobre": material("Cobre", "#C9773B", 0.35, 1.0),
        "celda": material("Celda_Solar", "#14213D", 0.2, 0.3),
        "vidrio": material("Vidrio_Lente", "#20313F", 0.05, 0.0),
        "madera": material("Madera_Pallet", "#B98A55", 0.8),
        "carton": material("Carton", "#B07D4B", 0.9),
        "led": material("LED_Verde", "#2BD46A", 0.4, 0.0, emision="#2BD46A"),
        "plastico": material("Plastico_Negro", "#2A2D31", 0.55),
    }


# ---------------------------------------------------------------------------------------------------------------------
# Primitivas (todo en coordenadas de Blender: x adelante, y izquierda, z arriba; metros)
# ---------------------------------------------------------------------------------------------------------------------
def _objeto(nombre, me, padre):
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(ob)
    if padre is not None:
        ob.parent = padre
    return ob


def _desde_bmesh(nombre, bm, mat, padre, ubicacion):
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = _objeto(nombre, me, padre)
    ob.location = ubicacion
    for p in me.polygons:
        p.use_smooth = False
    return ob


def caja(nombre, medidas, centro, mat, padre=None, bisel=0.0):
    """Caja con el origen en su centro."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(medidas), verts=bm.verts)
    ob = _desde_bmesh(nombre, bm, mat, padre, Vector(centro))
    if bisel > 0:
        mod = ob.modifiers.new("Bisel", "BEVEL")
        mod.width = bisel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    return ob


def cilindro(nombre, radio, largo, centro, mat, padre=None, eje="Z", lados=24, radio2=None):
    """Cilindro (o cono truncado con radio2) centrado, a lo largo del eje dado."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=lados, radius1=radio, radius2=radio if radio2 is None else radio2, depth=largo)
    if eje == "X":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=_rot("Y", math.pi / 2))
    elif eje == "Y":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=_rot("X", math.pi / 2))
    ob = _desde_bmesh(nombre, bm, mat, padre, Vector(centro))
    for p in ob.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return ob


def tubo(nombre, r_ext, r_int, largo, centro, mat, padre=None, eje="Z", lados=32):
    """Tubo (anillo extruido)."""
    bm = bmesh.new()
    for r in (r_ext, r_int):
        pass
    ext = [Vector((r_ext * math.cos(2 * math.pi * i / lados), r_ext * math.sin(2 * math.pi * i / lados), 0)) for i in range(lados)]
    inn = [Vector((r_int * math.cos(2 * math.pi * i / lados), r_int * math.sin(2 * math.pi * i / lados), 0)) for i in range(lados)]
    vs = []
    for z in (-largo / 2, largo / 2):
        vs.append([bm.verts.new(p + Vector((0, 0, z))) for p in ext])
        vs.append([bm.verts.new(p + Vector((0, 0, z))) for p in inn])
    (e0, i0, e1, i1) = vs
    for i in range(lados):
        j = (i + 1) % lados
        bm.faces.new((e0[i], e0[j], e1[j], e1[i]))
        bm.faces.new((i0[j], i0[i], i1[i], i1[j]))
        bm.faces.new((e1[i], e1[j], i1[j], i1[i]))
        bm.faces.new((e0[j], e0[i], i0[i], i0[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if eje == "X":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=_rot("Y", math.pi / 2))
    elif eje == "Y":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=_rot("X", math.pi / 2))
    ob = _desde_bmesh(nombre, bm, mat, padre, Vector(centro))
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def _rot(eje, ang):
    from mathutils import Matrix
    return Matrix.Rotation(ang, 3, eje)


def unir(nombre, objetos):
    """Une varias mallas en una (la primera queda como destino y conserva su origen)."""
    destino = objetos[0]
    with bpy.context.temp_override(active_object=destino, selected_editable_objects=objetos, selected_objects=objetos):
        bpy.ops.object.join()
    destino.name = nombre
    destino.data.name = nombre
    return destino


def aplicar_modificadores(ob):
    if not ob.modifiers:
        return
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    vieja = ob.data
    ob.data = me
    me.name = vieja.name
    bpy.data.meshes.remove(vieja)


def vacio(nombre, centro, padre=None, tam=0.1):
    ob = bpy.data.objects.new(nombre, None)
    ob.empty_display_type = "ARROWS"
    ob.empty_display_size = tam
    bpy.context.scene.collection.objects.link(ob)
    ob.location = Vector(centro)
    if padre is not None:
        ob.parent = padre
    return ob


def pieza(ob, nombre_es, mat_es, masa, explotar_blender):
    """Marca una malla como pieza: el desplazamiento se da en Blender (x, y, z) y se guarda en glTF (x, z, -y)."""
    x, y, z = explotar_blender
    ob["pieza"] = nombre_es
    ob["material"] = mat_es
    ob["masa_kg"] = float(round(masa, 3))
    ob["explotar"] = [float(round(x, 4)) + 0.0, float(round(z, 4)) + 0.0, float(round(-y, 4)) + 0.0]
    return ob


def encaje(nombre, centro, padre, acepta, tolerancia=0.05):
    v = vacio(f"Snap_{nombre}", centro, padre, 0.15)
    v["encaje"] = acepta
    v["tolerancia_m"] = float(tolerancia)
    return v


def raiz(id_, nombre, categoria, descripcion):
    r = vacio(id_, (0, 0, 0), None, 0.5)
    r["nombre"] = nombre
    r["categoria"] = categoria
    r["descripcion"] = descripcion
    return r


# ---------------------------------------------------------------------------------------------------------------------
# Activos
# ---------------------------------------------------------------------------------------------------------------------
def montacargas(M):
    """Autoelevador contrapesado eléctrico de 2,5 t. Adelante = +x. Origen en el piso, entre los ejes."""
    r = raiz("Forklift", "Montacargas eléctrico 2,5 t", "Equipos de manipulación",
             "Autoelevador contrapesado con mástil dúplex, carro portahorquillas y batería de tracción.")
    chasis = pieza(caja("Part_Chasis", (2.1, 1.1, 0.55), (0, 0, 0.55), M["amarillo"], r, 0.04), "Chasis", "Acero pintado", 1450, (0, 0, 0))
    pieza(caja("Part_Contrapeso", (0.45, 1.12, 0.75), (-1.2, 0, 0.75), M["gris"], r, 0.05), "Contrapeso", "Fundición", 1800, (-1.0, 0, 0))
    bat = caja("Part_Bateria", (0.85, 0.9, 0.55), (-0.15, 0, 1.05), M["azul"], r, 0.02)
    pieza(bat, "Batería de tracción 48 V", "Plomo-ácido", 980, (0, 0, 1.0))
    asiento = unir("Part_Asiento", [caja("Asiento_base", (0.5, 0.5, 0.12), (-0.3, 0, 1.42), M["negro"], r, 0.03),
                                     caja("Asiento_resp", (0.1, 0.5, 0.5), (-0.52, 0, 1.68), M["negro"], r, 0.03)])
    pieza(asiento, "Asiento", "Espuma y vinilo", 18, (0, 0, 1.6))
    techo = []
    for x in (-0.65, 0.45):
        for y in (-0.48, 0.48):
            techo.append(caja(f"Poste_{x}_{y}", (0.07, 0.07, 1.25), (x, y, 1.95), M["negro"], r))
    techo.append(caja("Techo_marco", (1.2, 1.05, 0.06), (-0.1, 0, 2.6), M["negro"], r))
    for i in range(6):
        techo.append(caja(f"Techo_barra_{i}", (1.15, 0.04, 0.04), (-0.1, -0.4 + i * 0.16, 2.6), M["negro"], r))
    pieza(unir("Part_Proteccion", techo), "Techo protector (FOPS)", "Acero", 95, (0, 0, 1.2))
    volante = unir("Part_Volante", [tubo("Volante_aro", 0.17, 0.15, 0.03, (0.25, 0, 1.55), M["negro"], r, "Z"),
                                     cilindro("Volante_columna", 0.025, 0.45, (0.3, 0, 1.33), M["negro"], r)])
    pieza(volante, "Volante y columna", "Acero y caucho", 7, (0.4, 0, 1.0))
    ruedas = [("DI", 0.65, 0.42, 0.33), ("DD", 0.65, -0.42, 0.33), ("TI", -0.85, 0.42, 0.26), ("TD", -0.85, -0.42, 0.26)]
    for n, x, y, rad in ruedas:
        rueda = unir(f"Part_Rueda_{n}", [cilindro(f"Cubierta_{n}", rad, 0.24, (x, y + math.copysign(0.12, y), rad), M["negro"], r, "Y", 32),
                                         cilindro(f"Llanta_{n}", rad * 0.55, 0.25, (x, y + math.copysign(0.12, y), rad), M["acero"], r, "Y", 16)])
        pieza(rueda, f"Rueda {'delantera' if n[0] == 'D' else 'trasera'} {'izquierda' if n[1] == 'I' else 'derecha'}",
              "Caucho macizo", 45 if n[0] == "D" else 30, (0, math.copysign(0.7, y), 0))
    # Mástil dúplex: exterior fijo, interior telescópico; el carro y las horquillas cuelgan del interior.
    exterior = unir("Part_Mastil_Exterior", [caja("Riel_ext_I", (0.12, 0.08, 2.2), (1.15, 0.38, 1.25), M["acero_oscuro"], r),
                                             caja("Riel_ext_D", (0.12, 0.08, 2.2), (1.15, -0.38, 1.25), M["acero_oscuro"], r),
                                             caja("Trav_ext", (0.1, 0.84, 0.1), (1.15, 0, 2.3), M["acero_oscuro"], r)])
    pieza(exterior, "Mástil exterior", "Acero laminado", 320, (0.8, 0, 0))
    interior = unir("Part_Mastil_Interior", [caja("Riel_int_I", (0.1, 0.07, 2.1), (1.25, 0.3, 1.3), M["acero"], r),
                                             caja("Riel_int_D", (0.1, 0.07, 2.1), (1.25, -0.3, 1.3), M["acero"], r),
                                             caja("Trav_int", (0.08, 0.66, 0.08), (1.25, 0, 2.32), M["acero"], r)])
    pieza(interior, "Mástil interior", "Acero laminado", 240, (1.2, 0, 0.4))
    pieza(cilindro("Part_Cilindro_Elevacion", 0.06, 1.9, (1.1, 0, 1.15), M["acero"], r), "Cilindro hidráulico de elevación", "Acero cromado", 45, (0.5, 0, 0.6))
    carro = caja("Part_Carro", (0.1, 1.0, 0.45), (1.38, 0, 0.45), M["acero_oscuro"], r, 0.01)
    pieza(carro, "Carro portahorquillas", "Acero", 110, (1.6, 0, 0))
    for n, y in (("I", 0.28), ("D", -0.28)):
        h = unir(f"Part_Horquilla_{n}", [caja(f"Horq_{n}_v", (0.05, 0.12, 0.5), (1.45, y, 0.38), M["acero_oscuro"], r),
                                          caja(f"Horq_{n}_h", (1.15, 0.12, 0.05), (2.0, y, 0.12), M["acero_oscuro"], r)])
        h.parent = carro
        h.location -= carro.location
        pieza(h, f"Horquilla {'izquierda' if n == 'I' else 'derecha'}", "Acero forjado", 60, (0.6, math.copysign(0.35, y), 0))
    # sobre las horquillas, en coordenadas del carro (el encaje sube y baja con él)
    encaje("Pallet_Horquillas", Vector((2.0, 0, 0.145)) - carro.location, carro, "pallet", 0.12)
    return r


def pallet(M):
    """Pallet europeo EUR 1200 × 800 × 144 mm con una carga de cajas."""
    r = raiz("Pallet", "Pallet EUR con carga", "Unidades de carga", "Pallet europeo 1200 × 800 mm (EN 13698-1) con 8 cajas de cartón.")
    tablas = []
    for i, y in enumerate((-0.35, 0, 0.35)):
        tablas.append(caja(f"Larguero_{i}", (1.2, 0.1, 0.022), (0, y, 0.011), M["madera"], r))
    for i, x in enumerate((-0.55, 0, 0.55)):
        for j, y in enumerate((-0.35, 0, 0.35)):
            tablas.append(caja(f"Taco_{i}_{j}", (0.145, 0.1, 0.078), (x, y, 0.061), M["madera"], r))
    for i, x in enumerate((-0.55, 0, 0.55)):
        tablas.append(caja(f"Travesano_{i}", (0.145, 0.8, 0.022), (x, 0, 0.111), M["madera"], r))
    for i in range(5):
        tablas.append(caja(f"Tabla_{i}", (1.2, 0.1 if i % 2 else 0.145, 0.022), (0, -0.33 + i * 0.165, 0.133), M["madera"], r))
    pieza(unir("Part_Pallet", tablas), "Pallet de madera", "Madera de pino", 25, (0, 0, 0))
    for i in range(8):
        x = -0.3 + (i % 2) * 0.6
        y = -0.2 + ((i // 2) % 2) * 0.4
        z = 0.144 + 0.2 + (i // 4) * 0.4
        pieza(caja(f"Part_Caja_{i + 1}", (0.58, 0.38, 0.39), (x, y, z), M["carton"], r, 0.01),
              f"Caja {i + 1}", "Cartón corrugado", 12, (x * 0.9, y * 1.5, 0.35 + (i // 4) * 0.45))
    encaje("Base", (0, 0, 0), r, "pallet", 0.1)
    return r


def rack(M):
    """Rack selectivo: 2 módulos de 2,7 m × 3 niveles; cada hueco lleva dos pallets EUR."""
    r = raiz("Rack", "Rack selectivo de pallets", "Almacenamiento",
             "Estantería de doble módulo, tres niveles de carga con largueros de 2,7 m y fondo de 1,1 m.")
    xs = (-2.75, 0.0, 2.75)
    for i, x in enumerate(xs):
        partes = []
        for y in (-0.5, 0.5):
            partes.append(caja(f"Parante_{i}_{y}", (0.09, 0.07, 4.5), (x, y, 2.25), M["azul"], r))
        for k in range(6):
            z = 0.3 + k * 0.75
            partes.append(caja(f"Diag_{i}_{k}", (0.03, 1.0, 0.03), (x, 0, z), M["azul"], r))
        partes.append(caja(f"Pie_{i}", (0.15, 1.15, 0.01), (x, 0, 0.005), M["acero"], r))
        pieza(unir(f"Part_Bastidor_{i + 1}", partes), f"Bastidor {i + 1}", "Acero galvanizado y pintado", 85, (0, 0, 0))
    niveles = (0.15, 1.65, 3.15)
    for b in range(2):
        xc = (xs[b] + xs[b + 1]) / 2
        for n, z in enumerate(niveles):
            if n == 0:
                continue
            for y in (-0.5, 0.5):
                lg = caja(f"Part_Larguero_M{b + 1}_N{n + 1}_{'F' if y < 0 else 'T'}", (2.66, 0.05, 0.12), (xc, y, z - 0.06), M["naranja"], r)
                pieza(lg, f"Larguero módulo {b + 1} nivel {n + 1} {'frente' if y < 0 else 'fondo'}", "Acero pintado", 22,
                      (0, math.copysign(0.6, y), 0.25 * n))
        for n, z in enumerate(niveles):
            for k, dx in enumerate((-0.65, 0.65)):
                encaje(f"M{b + 1}_N{n + 1}_P{k + 1}", (xc + dx, 0, z), r, "pallet", 0.15)
    return r


def sensor(M):
    """Sensor fotoeléctrico industrial de 18 mm con soporte y conector M12."""
    r = raiz("Sensor", "Sensor fotoeléctrico M18", "Sensores",
             "Sensor de proximidad óptico de barrera con cuerpo roscado M18, LED de estado y conector M12 de 4 pines.")
    pieza(cilindro("Part_Cuerpo", 0.009, 0.07, (0, 0, 0), M["acero"], r, "X", 32), "Cuerpo roscado M18", "Latón niquelado", 0.06, (0, 0, 0))
    pieza(cilindro("Part_Lente", 0.0075, 0.004, (0.037, 0, 0), M["vidrio"], r, "X", 32), "Lente", "PMMA", 0.002, (0.04, 0, 0))
    pieza(cilindro("Part_Tuerca_A", 0.0125, 0.004, (0.02, 0, 0), M["acero_oscuro"], r, "X", 6), "Tuerca de fijación delantera", "Acero", 0.01, (0.025, 0, 0.02))
    pieza(cilindro("Part_Tuerca_B", 0.0125, 0.004, (-0.012, 0, 0), M["acero_oscuro"], r, "X", 6), "Tuerca de fijación trasera", "Acero", 0.01, (-0.02, 0, 0.02))
    pieza(caja("Part_Soporte", (0.004, 0.04, 0.06), (0.004, 0, -0.012), M["acero"], r), "Soporte en L", "Acero inoxidable", 0.03, (0, 0, -0.04))
    pieza(caja("Part_Placa", (0.04, 0.012, 0.002), (0, 0, 0), M["pcb"], r), "Placa electrónica", "FR-4", 0.004, (0, 0.03, 0.03))
    pieza(cilindro("Part_LED", 0.002, 0.003, (-0.03, 0, 0.0085), M["led"], r, "Z", 12), "LED de estado", "Epoxi", 0.001, (0, 0, 0.025))
    con = unir("Part_Conector", [cilindro("M12", 0.006, 0.014, (-0.042, 0, 0), M["acero"], r, "X", 24),
                                  cilindro("M12_tuerca", 0.0075, 0.008, (-0.052, 0, 0), M["plastico"], r, "X", 6)])
    pieza(con, "Conector M12 4 pines", "Latón y PA", 0.012, (-0.04, 0, 0))
    encaje("Montaje", (0.004, 0, -0.04), r, "soporte", 0.01)
    return r


def motor(M):
    """Motor de inducción trifásico IEC 132 (5,5 kW) con patas B3."""
    r = raiz("Motor", "Motor eléctrico trifásico 5,5 kW", "Motores",
             "Motor asíncrono de jaula de ardilla IEC 132, 4 polos, carcasa aleteada de aluminio y ventilación externa.")
    carcasa = [cilindro("Carcasa_cuerpo", 0.12, 0.3, (0, 0, 0.132), M["azul"], r, "X", 40)]
    for i in range(16):
        a = 2 * math.pi * i / 16
        carcasa.append(caja(f"Aleta_{i}", (0.28, 0.006, 0.025), (0, 0.13 * math.cos(a), 0.132 + 0.13 * math.sin(a)), M["azul"], r))
        carcasa[-1].rotation_euler = (a + math.pi / 2, 0, 0)
    for x in (-0.1, 0.1):
        for y in (-0.08, 0.08):
            carcasa.append(caja(f"Pata_{x}_{y}", (0.06, 0.05, 0.03), (x, y, 0.015), M["azul"], r))
    pieza(unir("Part_Carcasa", carcasa), "Carcasa aleteada con patas", "Aluminio inyectado", 18, (0, 0, 0))
    pieza(tubo("Part_Estator", 0.11, 0.07, 0.2, (0, 0, 0.132), M["cobre"], r, "X"), "Estator bobinado", "Chapa magnética y cobre", 14, (0, 0, 0.35))
    rotor = unir("Part_Rotor", [cilindro("Rotor_jaula", 0.068, 0.19, (0, 0, 0.132), M["acero_oscuro"], r, "X", 32),
                                cilindro("Eje", 0.019, 0.52, (0.06, 0, 0.132), M["acero"], r, "X", 20)])
    pieza(rotor, "Rotor y eje", "Acero y aluminio", 11, (0.45, 0, 0))
    pieza(cilindro("Part_Tapa_LA", 0.122, 0.03, (0.165, 0, 0.132), M["azul"], r, "X", 40), "Tapa lado acople", "Fundición", 3.2, (0.3, 0, 0))
    pieza(cilindro("Part_Tapa_LOA", 0.122, 0.03, (-0.165, 0, 0.132), M["azul"], r, "X", 40), "Tapa lado opuesto", "Fundición", 3.0, (-0.3, 0, 0))
    pieza(tubo("Part_Rodamiento_LA", 0.036, 0.019, 0.017, (0.19, 0, 0.132), M["acero"], r, "X"), "Rodamiento 6308 lado acople", "Acero al cromo", 0.6, (0.6, 0, 0))
    pieza(tubo("Part_Rodamiento_LOA", 0.031, 0.019, 0.015, (-0.19, 0, 0.132), M["acero"], r, "X"), "Rodamiento 6206 lado opuesto", "Acero al cromo", 0.4, (-0.45, 0, 0))
    vent = [cilindro("Vent_cubo", 0.03, 0.03, (-0.22, 0, 0.132), M["plastico"], r, "X", 16)]
    for i in range(8):
        a = 2 * math.pi * i / 8
        p = caja(f"Paleta_{i}", (0.02, 0.004, 0.08), (-0.22, 0.06 * math.cos(a), 0.132 + 0.06 * math.sin(a)), M["plastico"], r)
        p.rotation_euler = (a + math.pi / 2, 0, 0)
        vent.append(p)
    pieza(unir("Part_Ventilador", vent), "Ventilador", "Polipropileno", 0.3, (-0.55, 0, 0))
    pieza(cilindro("Part_Cubreventilador", 0.125, 0.09, (-0.235, 0, 0.132), M["gris"], r, "X", 40, radio2=0.11), "Cubreventilador", "Chapa de acero", 1.1, (-0.7, 0, 0))
    pieza(caja("Part_Caja_Bornes", (0.11, 0.11, 0.07), (0.03, 0, 0.29), M["azul"], r, 0.006), "Caja de bornes", "Aluminio", 1.0, (0, 0, 0.3))
    pieza(caja("Part_Chaveta", (0.04, 0.01, 0.008), (0.27, 0, 0.152), M["acero"], r), "Chaveta", "Acero", 0.02, (0.7, 0, 0.05))
    encaje("Acople", (0.33, 0, 0.132), r, "acople", 0.01)
    return r


def cubesat(M):
    """CubeSat 1U (100 × 100 × 113,5 mm) con stack PC/104, batería, paneles solares y antena desplegable."""
    r = raiz("CubeSat", "CubeSat 1U", "Satélites",
             "Nanosatélite estándar 1U: estructura de aluminio 7075, pila PC/104 (OBC, EPS, COM), batería y paneles solares.")
    rieles = []
    for x in (-0.0465, 0.0465):
        for y in (-0.0465, 0.0465):
            rieles.append(caja(f"Riel_{x}_{y}", (0.0085, 0.0085, 0.1135), (x, y, 0.05675), M["aluminio"], r))
    for z in (0.004, 0.1095):
        for s in (-1, 1):
            rieles.append(caja(f"Marco_x_{z}_{s}", (0.1, 0.006, 0.006), (0, s * 0.0465, z), M["aluminio"], r))
            rieles.append(caja(f"Marco_y_{z}_{s}", (0.006, 0.1, 0.006), (s * 0.0465, 0, z), M["aluminio"], r))
    pieza(unir("Part_Estructura", rieles), "Estructura 1U", "Aluminio 7075 anodizado", 0.1, (0, 0, 0))
    for i, (n, z) in enumerate((("OBC", 0.03), ("EPS", 0.05), ("COM", 0.07))):
        placa = unir(f"Part_Placa_{n}", [caja(f"PCB_{n}", (0.09, 0.096, 0.0016), (0, 0, z), M["pcb"], r),
                                         caja(f"Chip_{n}", (0.02, 0.02, 0.002), (0.01, -0.01, z + 0.0018), M["plastico"], r),
                                         caja(f"PC104_{n}", (0.05, 0.006, 0.01), (0, 0.038, z + 0.005), M["plastico"], r)])
        pieza(placa, {"OBC": "Computadora de a bordo (OBC)", "EPS": "Sistema de potencia (EPS)", "COM": "Comunicaciones UHF (COM)"}[n],
              "FR-4", 0.07, (0, 0, 0.0))
        placa["explotar"] = [0.0, 0.12 + i * 0.05, 0.0]
        encaje(f"Ranura_{n}", (0, 0, z), r, f"placa_{n.lower()}", 0.006)
    pieza(caja("Part_Bateria", (0.06, 0.04, 0.018), (0, 0, 0.012), M["azul"], r, 0.002), "Batería Li-ion 2S", "Celdas 18650", 0.1, (0, 0, -0.08))
    paneles = (("XP", (0.0525, 0, 0.0568), (0.003, 0.082, 0.098), (0.12, 0, 0)), ("XM", (-0.0525, 0, 0.0568), (0.003, 0.082, 0.098), (-0.12, 0, 0)),
               ("YP", (0, 0.0525, 0.0568), (0.082, 0.003, 0.098), (0, 0.12, 0)), ("YM", (0, -0.0525, 0.0568), (0.082, 0.003, 0.098), (0, -0.12, 0)))
    for n, c, med, ex in paneles:
        pieza(caja(f"Part_Panel_{n}", med, c, M["celda"], r), f"Panel solar {n[0]}{'+' if n[1] == 'P' else '−'}", "GaAs triple juntura", 0.05, ex)
    ant = unir("Part_Antena", [caja("Antena_base", (0.09, 0.09, 0.004), (0, 0, 0.1155), M["plastico"], r),
                               caja("Antena_cinta", (0.16, 0.004, 0.0005), (0.08, 0.04, 0.118), M["acero"], r)])
    pieza(ant, "Antena UHF desplegable", "Cinta de acero", 0.08, (0, 0, 0.1))
    encaje("Despliegue", (0, 0, 0), r, "pod_1u", 0.002)
    return r


ACTIVOS = [
    ("forklift", montacargas),
    ("pallet", pallet),
    ("rack", rack),
    ("sensor", sensor),
    ("motor", motor),
    ("cubesat", cubesat),
]


# ---------------------------------------------------------------------------------------------------------------------
# Exportación
# ---------------------------------------------------------------------------------------------------------------------
def arbol(r):
    out = [r]
    for c in r.children:
        out += arbol(c)
    return out


def triangulos(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for o in objs:
        if o.type != "MESH":
            continue
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        n += len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
    return n


def medidas(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    d = hi - lo
    # a glTF: x, z, -y  → ancho (x), alto (y), fondo (z)
    return [round(d.x, 4), round(d.z, 4), round(d.y, 4)]


def seleccionar(objs):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def exportar(id_, r):
    objs = arbol(r)
    for o in objs:
        if o.type == "MESH":
            aplicar_modificadores(o)
    bpy.context.view_layer.update()
    seleccionar(objs)
    glb = os.path.join(RAIZ, "glb", f"{id_}.glb")
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_extras=True, export_yup=True)
    fbx = os.path.join(RAIZ, "fbx", f"{id_}.fbx")
    bpy.ops.export_scene.fbx(filepath=fbx, use_selection=True, apply_scale_options="FBX_SCALE_UNITS", axis_forward="-Z", axis_up="Y",
                             use_custom_props=True, add_leaf_bones=False, bake_space_transform=True, object_types={"EMPTY", "MESH"})
    piezas = [{"nodo": o.name, "nombre": o["pieza"], "material": o["material"], "masa_kg": o["masa_kg"], "explotar": list(o["explotar"]),
               "padre": o.parent.name if o.parent is not r else None}
              for o in objs if "pieza" in o]
    encajes = []
    for o in objs:
        if "encaje" in o:
            p = o.matrix_world.translation
            encajes.append({"nodo": o.name, "acepta": o["encaje"], "tolerancia_m": o["tolerancia_m"], "posicion": [round(p.x, 4) + 0.0, round(p.z, 4) + 0.0, round(-p.y, 4) + 0.0]})
    return {
        "id": id_,
        "nodo_raiz": r.name,
        "nombre": r["nombre"],
        "categoria": r["categoria"],
        "descripcion": r["descripcion"],
        "archivos": {"glb": f"glb/{id_}.glb", "fbx": f"fbx/{id_}.fbx", "blend": f"blend/{id_}.blend"},
        "medidas_m": medidas(objs),
        "triangulos": triangulos(objs),
        "masa_kg": round(sum(p["masa_kg"] for p in piezas), 3),
        "piezas": piezas,
        "encajes": encajes,
    }


def main():
    for d in ("glb", "fbx", "blend"):
        os.makedirs(os.path.join(RAIZ, d), exist_ok=True)
    manifest = {"version": 1, "unidades": "metros", "ejes": "glTF (Y arriba, -Z adelante en Unity)", "activos": []}
    for id_, fn in ACTIVOS:
        limpiar()
        _mats.clear()
        M = mats()
        r = fn(M)
        info = exportar(id_, r)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RAIZ, "blend", f"{id_}.blend"), compress=True)
        for k, ruta in info["archivos"].items():
            info.setdefault("bytes", {})[k] = os.path.getsize(os.path.join(RAIZ, ruta))
        manifest["activos"].append(info)
        print(f"{id_:9s} {info['triangulos']:6d} tris  {len(info['piezas']):2d} piezas  {len(info['encajes']):2d} encajes  {info['medidas_m']}")
    with open(os.path.join(RAIZ, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
    sys.exit(0)
