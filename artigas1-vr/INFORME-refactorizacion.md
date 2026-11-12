# Artigas-1 · Informe técnico de la refactorización (12/11/2026)

Alcance: el recorrido WebXR publicado en el portal (`web-dashboard/public/artigas1/`, three.js 0.170), que es el prototipo que hoy se puede usar en el Quest 2, más el kit 3D de Blender del que salen sus modelos. El proyecto Unity (`artigas1-vr/`) recibe los mismos modelos y un cambio chico de colisiones; sigue sin compilarse contra Unity.

**Cómo leer «verificado»:** todo lo que dice *verificado* se probó de forma automática en Chrome sin interfaz, en una PC sin GPU. **Nada se midió en un Quest 2.** Los 72 fps son un objetivo con optimizaciones aplicadas, no un resultado.

## A. Auditoría inicial

| Tema | Lo que había |
|---|---|
| Arquitectura | Dos versiones: recorrido web (un solo archivo de 215 líneas, `recorrido.js`) y proyecto Unity 6 con XR Interaction Toolkit 3, sin compilar. Modelos generados con scripts de Blender. |
| Colisiones | Ninguna en la web: se salía por las paredes al espacio. En Unity, barrido de esfera al flotar, sin corrección cuando el jugador mete la cabeza en una pared. |
| Locomoción | Web: el stick fijaba la velocidad; al soltarlo el cuerpo se detenía. Sin agarre de barandas. |
| Cúpula | Ventanas abiertas, pero con un vidrio gris al 12 % que apagaba las estrellas; marcos finos; Tierra sin día/noche ni atmósfera; estrellas como imagen borrosa de 2K; no se podía entrar flotando (escotilla cerrada). |
| Materiales y luz | Paleta de colores planos (casi todo no metálico, rugosidad parecida); 6 luces puntuales calculadas por píxel; sin reflejos. |
| Rendimiento | **203 llamadas de dibujo** en la vista de Rivera (límite recomendado por Meta para Quest 2: 100). 313 objetos sueltos que compartían 13 materiales. |
| Identidad | «Estación Artigas-1» en dos lugares; etiquetas de la carga en blanco; sin correas. |

## B. Cambios implementados

**Física y colisiones** (`js/colisiones.js`, `js/estacion.js`)
- Sistema propio, sin dependencias nuevas: 9.448 triángulos de colisión en una grilla espacial de 0,5 m. La geometría de colisión es independiente de la visual: malla para cascos, racks, bahías, anillos, banco, red y vidrios; **caja de 12 triángulos** para cada bolsa y cada equipo; nada para carteles, correas ni pantallas.
- El cuerpo son dos esferas (cabeza y torso). Cada cuadro se corrige la penetración más profunda, hasta 4 veces. El movimiento se parte en subpasos de 8 cm como máximo (menos que el radio), así no hay efecto túnel ni a 30 m/s ni con cuadros de 50 ms.
- La cabeza se mide desde la cámara del visor: si el jugador se inclina hacia una pared, el cuerpo retrocede.
- Escotillas: las cinco que conectan módulos son corredizas, se abren solas a 1,7 m y vuelven a ser sólidas al cerrarse. El puerto de acople 2 queda cerrado.

**Locomoción 0G** (`js/locomocion.js`)
- El stick da **empuje** (1,1 m/s²), no velocidad. Sin empuje el cuerpo conserva el impulso (fricción 0,04/s). Gatillo o Espacio: freno.
- Choque: se devuelve el 25 % de la velocidad normal y se conserva el 94 % de la tangencial; por debajo de 0,2 m/s no rebota (sin efecto pinball).
- Parámetros en un solo objeto (`PARAMETROS`), para calibrar en las pruebas con usuarios.

**Barandas** (`js/barandas.js`, `js/manos.js`)
- 66 barandas como segmentos en una capa propia: las manos las detectan a 16 cm y el cuerpo no choca con ellas.
- Con el grip cerrado la mano queda clavada y el cuerpo se mueve al revés; al soltar sale con la velocidad promedio de los últimos 5 cuadros (tope 2,2 m/s). Sin baranda cerca, la mano se **apoya en cualquier superficie** a menos de 10 cm y sirve igual para impulsarse.
- Manos translúcidas que cambian de color (libre, algo para tomar, tomado) y vibran al agarrar y al chocar.

**Cúpula** (`Blender/cupula.py`)
- Sigue octogonal (7 ventanas laterales + la central + panel de equipos), ahora con marcos de aleación oscura de 16 cm de profundidad con bisel de aluminio, costillas estructurales entre ventanas con refuerzos, y 100 tornillos hexagonales. 2.578 triángulos.
- Vidrio (`js/materiales.js`): un solo plano transparente por ventana, casi invisible de frente (3,5 %), con reflejo azulado en ángulo rasante (Fresnel cúbico), tinte antirreflejo y brillo del sol.

**Entorno orbital** (`js/entorno.js`, `Blender/tierra.py`)
- Tierra con costas reales, línea día/noche ancha con franja cálida, bruma azul hacia el limbo y halo de atmósfera. El sol está a 12° sobre el horizonte oeste-noroeste: el Río de la Plata queda de día y el terminador se ve hacia el este.
- 3.200 estrellas en **una** llamada de dibujo (puntos con tamaño y color propios), sobre fondo negro. Disco solar con halo.
- La luz del sol entra a la Cúpula por el material (misma dirección que afuera), no como luz de escena, para no iluminar los módulos cerrados a través de las paredes.
- Orientación revisada: mirando hacia abajo con el norte arriba, el este queda a la derecha (no está espejada).

**Materiales PBR** (`Blender/kitlib.py`, `js/materiales.js`)
- Paleta rehecha con metalicidad y rugosidad distintas por material: aluminio satinado (metal 0,95 / rug. 0,42), aleación oscura de la Cúpula (0,90 / 0,38), racks de metal gris (0,80 / 0,48), pasamanos de aluminio anodizado (0,90 / 0,36), acero (1,0 / 0,30), polímero de contenedores (0 / 0,58), paneles blancos mate (0 / 0,68), vinilo, pantallas de vidrio (rug. 0,10).
- Reflejos de entorno (IBL) generados una vez con la luz de la cabina.
- Juntas de panel cada 0,5 m y veta de cepillado, calculadas en el shader en espacio de mundo: no agregan texturas ni objetos.
- No hay mapas de normales ni de oclusión: con la paleta (un color por cara) no hay UV donde ponerlos. El relieve sale de geometría (biseles, tornillos, costillas, nervaduras) y de las juntas del shader.

**Iluminación**
- Se quitaron las 6 luces puntuales. Queda una luz de hemisferio + reflejos de entorno + tiras LED emisivas. Sin iluminación horneada todavía (pendiente).

**Identidad** (`Blender/identidad.py`, `js/etiquetas.js`)
- 49 placas nuevas en mamparos y paredes: ESTACIÓN ARTIGAS-1, identificador de cada módulo (A1-TAC, A1-MVD, A1-RIV, A1-COL, A1-FAR, CR-01), DEPÓSITO LOGÍSTICO, ALMACENAMIENTO, INVENTARIO, CARGA · DESCARGA, EQUIPAMIENTO, HERRAMIENTAS, MATERIAL CRÍTICO, ZONA DE SEGURIDAD, ACCESO RESTRINGIDO, ESCOTILLA, MÓDULO DE OBSERVACIÓN.
- 110 etiquetas logísticas, una por bolsa, en **una** llamada de dibujo: código, descripción, categoría con color, peso, ubicación real del hueco (p. ej. `RIV-E2-A3`), código tipo QR y advertencia de manipulación.
- Correas con hebilla en cada hueco ocupado (112), a los lados de la etiqueta.

## C. Archivos

| Ruta | Función | Cambio |
|---|---|---|
| `web-dashboard/public/artigas1/recorrido.js` | Entrada: arma las piezas y corre el bucle | Reescrito; conserva módulos, salto con fundido, giro de 30° y A/B |
| `…/js/colisiones.js` | Colisiones | Nuevo |
| `…/js/locomocion.js` | Locomoción 0G y cuerpo sólido | Nuevo |
| `…/js/barandas.js` | Capa de barandas | Nuevo |
| `…/js/manos.js` | Controles y manos VR | Nuevo |
| `…/js/estacion.js` | Fusión de mallas, colliders, escotillas | Nuevo |
| `…/js/materiales.js` | Materiales PBR, reflejos, vidrio | Nuevo |
| `…/js/entorno.js` | Tierra, atmósfera, sol, estrellas | Nuevo |
| `…/js/etiquetas.js` | Etiquetas logísticas | Nuevo |
| `…/index.html` | Ayuda en pantalla | Controles nuevos |
| `…/estacion.glb`, `tierra.glb` | Modelos | Regenerados; se borró `estrellas.webp` |
| `web-dashboard/src/artigas1/fisica.test.js` | 10 pruebas unitarias (Vitest) | Nuevo |
| `artigas1-vr/Tools/pruebas-web/fisica.py` | 26 pruebas sobre la estación real, en navegador | Nuevo |
| `artigas1-vr/Blender/kitlib.py`, `props.py`, `modulo.py`, `colonia.py`, `cupula.py`, `tierra.py`, `run_all2.py`, `export_all2.py` | Kit 3D | Paleta PBR, correas, cúpula, colores de la Tierra |
| `artigas1-vr/Blender/identidad.py`, `export_web.py` | Placas; exportación web | Nuevos |
| `artigas1-vr/Assets/Artigas1/Modelos`, `Texturas` | Kit para Unity | Regenerados |
| `artigas1-vr/Assets/…/Runtime/ZeroGLocomotion.cs` | Locomoción Unity | Corrección de penetración de la cabeza (`Depenetrar`) |
| `artigas1-vr/Assets/…/Editor/ArtigasMenu.cs` | Armado de escena | Esfera del cuerpo y material de identidad |

## D. Optimización

| Medida (Chrome, 1280×720) | Antes | Después |
|---|---|---|
| Llamadas de dibujo, vista de Rivera | 203 | 18 |
| Llamadas de dibujo, peor vista (Tacuarembó) | sin medir | 30 |
| Objetos de la estación | 313 mallas sueltas | 21 lotes + 5 escotillas |
| Luces dinámicas por píxel | 6 puntuales + 3 | 1 de hemisferio |
| Triángulos en pantalla, peor vista | 67.000 | 101.000 |
| Texturas en GPU | 9 | 13 |
| Física por cuadro (PC) | no había | menos de 0,01 ms |

- Técnicas: fusión de mallas por módulo y material (se conserva el descarte por módulo fuera de cámara), instanciado de etiquetas, estrellas en una llamada, un solo plano transparente por ventana, foveado fijo al máximo, materiales compartidos, sin asignaciones de memoria por cuadro en física ni entrada.
- Los triángulos subieron por las correas, los tornillos y las placas; siguen siendo el 13 % del límite de 750.000.
- Limitaciones: el atlas de etiquetas es de 2048×2048 sin comprimir (unos 22 MB de memoria de GPU); no hay LOD ni oclusión entre módulos (hoy no hace falta con 30 llamadas); la iluminación no está horneada; `MeshStandardMaterial` es el costo dominante por píxel y es lo primero a cambiar si el Quest 2 no llega a 72 fps.

## E. Configuración y ejecución

- Dependencias: ninguna nueva. three.js 0.170 ya vendorizado en `vendor/`.
- En la compu: `cd web-dashboard && npm run dev` y abrir `/artigas1/`. W A S D para impulsarse, Q/E, Espacio para frenar.
- En el Quest 2: abrir el portal en el navegador del visor (necesita HTTPS: GitHub Pages sirve) y tocar «Enter VR». Grip sobre una baranda o pared para impulsarse; stick izquierdo, propulsor; stick derecho, giro y subir/bajar; gatillo, freno; A/B, cambiar de módulo.
- Pruebas: `cd web-dashboard && npm test` (incluye las 10 de física) y `python3 artigas1-vr/Tools/pruebas-web/fisica.py` con el sitio servido en el puerto 8765.
- Regenerar modelos: ver `artigas1-vr/Blender/README.md` (`tierra.py`, `run_all2.py`, `export_web.py`, `export_all2.py`).

**Qué probar en el visor (nada de esto está medido):**
1. Fps en cada módulo con OVR Metrics Tool; el peor candidato es Tacuarembó mirando hacia el Nodo.
2. Agarre real: distancia de 16 cm a la baranda, si el grip engancha a la primera, si la vibración se siente.
3. Mareo con inercia casi sin fricción (0,04/s). Si marea, subir `friccionLibre` en `js/locomocion.js`.
4. Meter la cabeza en una pared inclinándose: el cuerpo tiene que retroceder sin saltos.
5. Legibilidad de etiquetas y placas a 1 m.
6. Que las escotillas no se cierren sobre el jugador.

## F. Estado de aceptación

V = implementado y verificado (navegador). H = implementado, no verificado en hardware. P = pendiente.

| Criterio | Estado | Evidencia o nota |
|---|---|---|
| **Física** | | |
| No atraviesa paredes | V | 0,3 a 12 m/s, cuadros de 14 y 50 ms; 300 lanzamientos al azar sin fugas |
| No atraviesa racks | V | Prueba contra un hueco ocupado |
| Contenedores con colisión | V | Caja por bolsa |
| Escotillas con colisión | V | Cerrada bloquea; abierta deja pasar; acople 2 siempre cerrado |
| Las manos detectan los objetos | H | Detección de baranda y de superficie probada con manos simuladas; con controles reales, sin probar |
| Las barandas se pueden agarrar | H | Ídem |
| Las barandas no bloquean las manos | V | Capa aparte: no están en la colisión del cuerpo |
| Impulsos con inercia | V | Conserva el 96 % de la velocidad tras 1 s sin empuje |
| Choques amortiguados | V | Rebote de 0,24 m/s entrando a 1 m/s; tangencial conservada |
| Sin penetraciones persistentes | V | Peor caso: 0,2 mm |
| Funciona a distintas velocidades | V | Hasta 30 m/s en las pruebas unitarias |
| **Cúpula** | | |
| Estructura poligonal | V | Octogonal |
| Marcos con profundidad | V | 16 cm con bisel, costillas y tornillos |
| Ventanas transparentes | V | Captura |
| Vidrio con reflejos y Fresnel | H | Implementado; el brillo solar solo se aprecia en movimiento |
| Se ve la Tierra | V | Captura |
| Se reconoce Sudamérica | V | Río de la Plata y costa uruguaya bajo la ventana central; el continente entero no entra a 400 km |
| Campo de estrellas | V | 3.200 puntos |
| Luz solar coherente | V | Misma dirección para Tierra, vidrio y marcos |
| **Materiales e iluminación** | | |
| PBR en lugar de colores planos | V | Paleta con metal y rugosidad por material + reflejos |
| Diferencias de rugosidad y metalicidad | V | Ver sección B |
| Metales con reflejos controlados | H | Se ven en captura; el nivel se ajusta en el visor |
| Profundidad visual en superficies | V | Juntas, biseles, tornillos; sin mapas de normales (ver B) |
| Iluminación funcional por módulo | P | Hay luz pareja y tiras LED; falta hornear y dar contraste entre zonas |
| Paneles con indicadores luminosos | V | Ya existían: balance, presión, RFID, soporte vital, LED |
| Iluminación sin exceso de draw calls | V | 1 luz; 30 llamadas en el peor caso |
| **Identidad** | | |
| Identificada como ARTIGAS-1 | V | En todos los módulos y en cada etiqueta |
| Módulos señalizados | V | 49 placas nuevas |
| Contenedores con etiqueta logística | V | 110 etiquetas |
| Correas y sistemas de fijación | V | 112 correas con hebilla; anclajes en Colonia |
| Señalética en español | V | Rioplatense |
| Coherencia industrial y aeroespacial | H | Juicio visual: verla en el visor |
| **Rendimiento** | | |
| Corre en Quest 2 autónomo | H | WebXR en el navegador del visor; no probado en esta versión |
| 72 fps | H | **No medido** |
| Sin shaders costosos | H | Sin posprocesado ni sombras; falta medir `MeshStandardMaterial` en el visor |
| Draw calls optimizados | V | 203 → 18 a 30 |
| Geometría optimizada | H | 101.000 triángulos en el peor caso; colliders simples |
| Overdraw reducido | H | Una capa transparente por ventana; no medido |
| Memoria controlada | H | 13 texturas; el atlas de etiquetas es lo más pesado |
| Sin errores críticos | V | Consola limpia en los 6 módulos; 62 pruebas del tablero y 26 de física en verde |

**Unity:** `Depenetrar` y la esfera del cuerpo están escritos y pasan el chequeo de sintaxis, pero no se compilaron: estado H para todo lo de Unity.
