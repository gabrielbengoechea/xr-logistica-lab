# Artigas-1 VR · Sprint 02: variación, ruta, debrief y calidad técnica

Base: `main` en `c1021e7` + los cambios del Sprint 01 (`docs/SPRINT_01_ESTABILIZACION.md`), todavía sin commitear. Alcance: el recorrido WebXR (`web-dashboard/public/artigas1/`), sus pruebas y CI. No se tocó Unity.

Se tomaron los ítems del backlog de la auditoría que se pueden hacer y verificar **sin visor, sin usuarios y sin decisiones del responsable del proyecto**.

## Trazabilidad

| ID | Problema (auditoría) | Solución | Prueba | Estado |
|---|---|---|---|---|
| B07 | Contenido determinista: mismo manifiesto y misma estantería en cada intento | Semilla por sesión y generador por intento; Recepción elige 5 bultos y Conteo una estantería distinta a la anterior. `?semilla=` reproduce un caso; la variante va en `activity_start` | `variacion.test.js` (4), `juego.py` fase 15 (3) | Implementado y probado en Chrome |
| B11 | Sin progresión: seis actividades abiertas sin orden | Ruta sugerida (no bloquea): Recepción → Almacenamiento → Conteo → Descarga → Balance → Taller → Filtro → EVA. «Siguiente recomendada» en la tablet y aro celeste en el mapa | `variacion.test.js` (2), `juego.py` fase 15 (1) | Implementado y probado en Chrome |
| B05 | Sin explicación ni debrief | Pantalla POR QUÉ IMPORTA en el resultado (porqué + caso terrestre) y «Para la próxima» según errores y tiempo | `debrief.test.js` (5), `juego.py` fase 15 (2) | Implementado · **contenido en borrador, falta revisión docente** |
| B27 | No se aclara lo ficticio | «En el simulador:» en Balance, EVA, Descarga y Filtro | `debrief.test.js` | Implementado · falta revisión docente |
| B10 (parcial) | Instrucciones de 54 a 68 palabras | Objetivo + pasos de 15 palabras como máximo en el informe y en los terminales | `debrief.test.js`, `juego.py` fase 15 (1) | Implementado. Pendiente: voz y ampliar la práctica guiada |
| B17 | Cuerpo tapa la Cúpula; salida de EVA mirando al vacío | Torso y piernas se ocultan en la Cúpula al mirar a los pies (con histéresis; los brazos siguen). Al salir, con la vista a negro, el cuerpo gira solo en horizontal hacia la estación | `vista.test.js` (2), `juego.py` (2) | Implementado y probado en Chrome · **verificar en Quest 2** |
| B20 | GLB de 4,2 MB sin comprimir | meshopt **sin cuantizar posiciones**: 4,22 → 1,63 MB (−61 %), mismos 514 nodos con la misma transformación | Las tres baterías de navegador con el GLB nuevo | Implementado y probado en Chrome |
| B14 | Pruebas de navegador fuera de CI | Workflow `artigas1-web.yml`: `fisica.py` y `juego.py` en cada PR que toca el recorrido | YAML validado | **No ejecutado en GitHub** (sin push) |
| B23 (parcial) | Sin control de volumen | Volumen en AJUSTES (0 a 100 % de a 25), guardado como ajuste del visor | `juego.py` fase 15 (1) | Implementado. Modo zurdo: pendiente |
| B24 | `window.artigas1` expuesto en producción | Solo en servidor local o con `?depurar`; fuera de local, `?depurar` apaga la telemetría | `vendor.test.js` (1), `juego.py` (1) con host no local | Implementado y probado en Chrome |
| B25 | three.js duplicado (vendor + npm) | Prueba que exige que `vendor/` sea idéntico byte a byte a `node_modules/three` + `scripts/vendorizar-three.mjs` | `vendor.test.js` (2) | Implementado |
| Extra | Texto de PRÁCTICA GUIADA desbordado (pendiente del Sprint 01) | La etiqueta de cualquier botón se achica si no entra | Captura | Implementado |

## Decisiones y hallazgos

**B20: la cuantización rompía la estación.** Con `gltf-transform meshopt --level medium` (cuantiza posiciones, `KHR_mesh_quantization`) el GLB queda en 1,52 MB, pero cambia la transformación de los 514 nodos. Resultado: falló la prueba de portales de `juego.py` (lo oculto detrás de escotillas cerradas pasaba a verse). Se usa meshopt con filtros y sin cuantizar (`artigas1-vr/Tools/comprimir-glb/`): 1,63 MB y transformaciones idénticas, comprobado nodo por nodo. Hay que correr `comprimir.sh` después de cada exportación desde Blender.

**B07: la Descarga queda fija.** Su manifiesto y su faltante son constantes usadas por `descarga.js`, por la lógica de la escotilla y por las pruebas. Variarla exige rehacer esa actividad (Sprint 03, junto con B13).

**B11: la ruta solo sugiere.** No se bloquea ninguna actividad nueva (la EVA sigue dependiendo del Taller, como antes). Bloquear todo en orden se puede activar después si el docente lo prefiere.

**B05: contenido en borrador.** `js/debrief.js` tiene `ESTADO_CONTENIDO = 'borrador'` y `REVISADO_POR = ''`. Lo escribió el equipo de desarrollo con conceptos generales de logística, sin fuentes específicas citadas. El criterio de aceptación de la auditoría pide revisión de un docente de Logística: **no usarlo para evaluar hasta esa revisión**. No se muestra «borrador» al estudiante.

**B17: hay que verlo en el visor.** El umbral (mirar más de unos 33° por debajo de la horizontal del cuerpo; vuelve por encima de unos 27°) y el punto al que se orienta la salida (`MIRAR_AL_SALIR`, a lo largo del casco hacia Rivera) son valores de diseño. En las pruebas se cambió la regla «sale con la misma orientación» por «sale mirando a la estación, girando solo en horizontal».

**B24: depuración por host.** Usa el nombre del host solo para habilitar la consola de depuración, no para la telemetría (B26 sigue sin depender del dominio).

## Archivos

Nuevos: `js/variacion.js`, `js/debrief.js`, `js/vista.js`, `vendor/addons/libs/meshopt_decoder.module.js` (three 0.170, MIT), `src/artigas1/{variacion,debrief,vista,vendor}.test.js`, `scripts/vendorizar-three.mjs`, `artigas1-vr/Tools/comprimir-glb/{comprimir.sh,comprimir.mjs}`, `.github/workflows/artigas1-web.yml`.

Modificados: `estacion.glb` (comprimido), `recorrido.js` (cargador meshopt, informe con debrief, terminales con pasos cortos, torso en la Cúpula, volumen, depuración, semilla), `js/actividades.js` (ruta), `js/misiones.js` (variación, ruta), `js/mapa.js` y `js/tablet.js` (recomendada, volumen), `js/sesion.js` (variante en la telemetría), `js/manos.js` (`ocultarTorso`), `js/eva.js` (orientación al salir), `js/sonido.js` (volumen), `js/paneles.js` (etiquetas que no entran), `artigas1-vr/Tools/pruebas-web/juego.py` (fase 15, B24, regla nueva de la EVA).

## Pruebas ejecutadas

Tipos: **[A]** automatizada ejecutada · **[M]** manual (captura revisada) · **[Q]** pendiente en Quest 2.

| Prueba | Tipo | Resultado |
|---|---|---|
| Vitest completo | A | 26 archivos, 131 pruebas, todas pasan (Sprint 01: 115) |
| Lint del repo y build (normal y GitHub Pages) | A | Sin errores; el GLB comprimido y el decodificador llegan a `dist/` |
| `juego.py` | A | 303 de 303 (Sprint 01: 293) |
| `fisica.py` | A | 41 de 41 |
| `vision.py` | A | 10 de 11: la misma falla previa («luz: sin parpadeos») |
| Backend pytest (sin cambios) | A | 31 de 31 |
| `comprimir.sh` desde el GLB original | A | Produce exactamente el archivo probado |
| Capturas de informe, POR QUÉ IMPORTA, terminal, tablet (inicio, órdenes, ajustes) | M | Legibles, sin desbordes |
| Workflow de CI en GitHub | — | No ejecutado (no hay push) |
| Todo lo anterior en el visor | Q | Pendiente |

## Limitaciones conocidas

- El contenido educativo es un borrador sin revisión docente.
- La Descarga no varía entre intentos.
- B10 queda parcial: no hay voz y la práctica guiada no incluye amarre ni herramientas.
- B23 queda parcial: no hay modo zurdo (toca el mapeo de controles de la locomoción).
- El tamaño del GLB baja un 61 %, pero el tiempo de carga en el wifi del aula no se midió.
- La falla de `vision.py` sigue; por eso `vision.py` no está en CI.
- `rectRedondo` sin usar en `recorrido.js` y el lint del repo que no revisa los `.js` del recorrido siguen como antes.

## Validación en Meta Quest 2 (sumar al procedimiento del Sprint 01)

1. Repetir Recepción dos veces: los bultos pedidos tienen que cambiar.
2. Tablet → ÓRDENES DE TRABAJO: la primera sin completar dice «Siguiente recomendada»; en el mapa tiene un aro celeste.
3. Terminar una actividad con un error: el resultado muestra «Para la próxima»; POR QUÉ IMPORTA se lee bien a la distancia de uso.
4. En la Cúpula, mirar a los pies: torso y piernas desaparecen y se ve la ventana central; al levantar la vista vuelven sin parpadear.
5. Salir a la EVA mirando hacia el lado de la escotilla: al aclarar la vista se tiene que ver la estación, sin sensación de giro.
6. AJUSTES → Volumen: bajar a 0 % y comprobar silencio; volver a 100 %.
7. Medir el tiempo de carga desde GitHub Pages en el wifi del aula, antes y después del GLB comprimido.

## Pendientes para el Sprint 03

Dependen de vos o del hardware: **B03** (fps en el Quest), **B04** (prueba con 5 novatos), **B12** (decidir WebXR o Unity), **B08** (luz horneada, según B03), **revisión docente del debrief**.

Desarrollo: B13 (cada actividad como módulo con `preparar()`/`limpiar()`, y con eso variar la Descarga), B15 (progreso guardado por estudiante), B09 (ambiente sonoro y voces con acento rioplatense), B10 completo (voz y práctica ampliada), B16 (plan de carga del carguero), B19 (memoria de lienzos), B21 (pre/post test en el portal), B23 (modo zurdo), B28 (acelerar órbita en la Cúpula) y la falla de `vision.py`.
