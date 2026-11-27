#!/usr/bin/env bash
# Comprime estacion.glb con meshopt (Sprint 02, B20): 4,2 MB → 1,6 MB, mismos 514 nodos con la misma transformación.
# Correr después de cada exportación desde Blender (artigas1-vr/Blender/export_web.py), que deja el GLB sin comprimir.
# El recorrido lo lee con el decodificador de three.js (vendor/addons/libs/meshopt_decoder.module.js).
#
#   bash artigas1-vr/Tools/comprimir-glb/comprimir.sh
#
# NO cuantiza posiciones (KHR_mesh_quantization): eso mueve la transformación de cada nodo y el recorrido anima
# escotillas y objetos por su posición. Con cuantización, la prueba de portales de juego.py falla.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
GLB="$AQUI/../../../web-dashboard/public/artigas1/estacion.glb"
TMP="$(mktemp -d)"
cp "$AQUI/comprimir.mjs" "$TMP/"
( cd "$TMP" && npm init -y >/dev/null && npm i --no-audit --no-fund @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer >/dev/null )
cp "$GLB" "$TMP/entrada.glb"
( cd "$TMP" && node comprimir.mjs entrada.glb salida.glb )
mv "$TMP/salida.glb" "$GLB"
ls -l "$GLB"
