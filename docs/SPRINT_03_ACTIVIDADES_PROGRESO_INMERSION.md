# Artigas-1 VR · Sprint 03: escenarios, progreso, sonido y órbita

Base: rama `feature/artigas1-sprint01-02` (PR #24, Sprints 01 y 02). Alcance: el recorrido WebXR (`web-dashboard/public/artigas1/`), sus pruebas y CI. No se tocaron Unity ni el contrato de datos del backend.

## Trazabilidad

| ID | Problema | Solución | Prueba | Estado |
|---|---|---|---|---|
| Deuda | `vision.py` fallaba («luz: sin parpadeos») desde antes del Sprint 01 | Diagnóstico: no era un parpadeo de luz sino la **maniobra inicial de las alas solares** (giran 51° a 2,2°/s durante unos 23 s después de cargar); el marco del ala, más fino que un píxel a la resolución de la prueba, barre los píxeles (oscuro → claro → oscuro). La prueba ahora mide el régimen normal (maniobra terminada; siguen el seguimiento fino, las antenas y las balizas) | `vision.py` 11/11; sumado a CI | Resuelto |
| B13 (parcial) | Preparación de actividades dentro del oyente de `recorrido.js` (T3) | El gestor llama a `def.preparar()` antes de calcular los pasos y a `def.limpiar()` al terminar o abandonar. El escenario de Filtro, Descarga, Balance y Taller pasó a `js/escenarios.js` | `escenarios.test.js` (5), juego completo | T3 resuelto. T2 no: `recorrido.js` tiene 1.386 líneas (meta de la auditoría: menos de 700) |
| B07 en la Descarga | La Descarga era siempre igual | En cada intento cambia el contenedor que llegó sin manifestar y el código faltante (`CNT-0090` a `CNT-0099`). Se reproduce con `?semilla=` | `escenarios.test.js`, `juego.py` con semilla al azar y fijas (1 y 4) | Implementado y probado en Chrome |
| B15 | Recargar borra todo el progreso | Con registro aceptado, lo completado se guarda por código (mejor puntaje). Se recupera del **backend** (reconstruido de los `activity_end` que ya manda la telemetría, sin cambiar el contrato) y, sin backend, de **este visor** | `progreso.test.js` (4), `juego.py` (1), manual con el backend real | Implementado y probado |
| B09 (parcial) | Sin sonido ambiente | Ambiente sintetizado por módulo (ventilación filtrada + zumbido de equipos, con firma propia en cada uno); en la EVA se apaga y queda la respiración en el casco | `ambiente.test.js` (2), `juego.py` (1) | Implementado. **Sin voces** (necesitan grabación con acento rioplatense) |
| B28 | Sol fijo, sin órbita | En la Cúpula, un panel para acelerar la órbita: 92 min en 30 s (×184). El terminador recorre Uruguay | `orbita.test.js` (2), `juego.py` (2), capturas | Implementado y probado en Chrome |
| B23 | Sin modo zurdo | AJUSTES → Mano dominante: se intercambian los dos controles. La bienvenida, la práctica y la página lo nombran bien | `juego.py` (2), capturas | Implementado y probado en Chrome · falta probar con controles reales |

## Decisiones

**`vision.py`: se ajustó la prueba, no el juego.** Primero probé suavizar la grilla de las celdas en el shader: la medida no cambió en nada, así que no era eso. Congelando cada parte por separado (alas, antenas, todo el exterior) quedó aislado el movimiento de las alas. Al doble y al triple de resolución la cuenta no converge, porque lo que mide es movimiento real de una línea fina. La maniobra pasa solo en los primeros ~25 s de la sesión: en una EVA normal (minutos después de cargar) ya terminó. **Verificar en el Quest** que las alas no titilen si se sale muy rápido.

**B15: identidad y privacidad.** El progreso se asocia al código de estudiante, igual que la telemetría. En el visor se guarda en `artigas1.progreso` (fuera de las claves de sesión: «Nuevo estudiante» no lo borra, a propósito). Cualquiera que escriba ese código en ese visor recupera ese progreso. Solo guarda qué actividades completó y el mejor puntaje. Se avisó en el texto de consentimiento: «Tu progreso queda guardado con ese código para la próxima vez». Desde la consola de depuración se puede borrar (`progresoLocal.borrar()`); falta un botón para el docente.

**B15: progreso restaurado.** Las actividades recuperadas quedan COMPLETADAS con el mejor puntaje y desbloquean lo que dependía de ellas (por ejemplo, la EVA). No se manda telemetría por eso. La tablet las muestra como «N puntos (sesión anterior)».

**B28: simplificación.** Solo se mueven el sol del cielo y el terminador de la Tierra. La luz de la estación queda en el atardecer de siempre y el terreno no se corre (Uruguay sigue a la vista). Al salir de la Cúpula todo vuelve al tiempo real.

**B23: los botones van por índice.** En modo zurdo, X/Y y A/B cambian de rol junto con los sticks (moverse, subir y bajar en la mano derecha; girar, frenar y enderezar en la izquierda).

**Pruebas: correcciones en `juego.py` que destapó la variación.** Con el sobrante al azar aparecieron supuestos de la prueba: tomaba `DC.carga[0]` como «uno del manifiesto», soltaba todos los contenedores en el mismo punto (el agarre tomaba cualquiera) y armaba mal las direcciones con parámetros (`?semilla=4?alumno=31`). Las tres cosas se corrigieron; la del armado de direcciones también afectaba a la prueba de texturas con `?ktx2=no`.

## Archivos

Nuevos: `js/escenarios.js`, `js/progreso.js`, `js/ambiente.js`, `js/orbita.js`, `src/artigas1/{escenarios,progreso,ambiente,orbita}.test.js`.

Modificados: `recorrido.js` (oyente sin preparación de actividades, progreso, ambiente, panel de la órbita, modo zurdo), `js/actividades.js` (`preparar`, `limpiar`, `restaurar`), `js/misiones.js` (hooks y variación de la Descarga), `js/descarga.js` (manifiesto, sobrante y faltante por turno), `js/entorno.js` (órbita acelerada), `js/induccion.js` y `index.html` (textos para zurdos), `js/tablet.js` (fila Mano dominante, progreso restaurado), `js/sesion.js` (texto de consentimiento), `js/debrief.js` (la Descarga cambia al repetir), `artigas1-vr/Tools/pruebas-web/{juego,vision}.py`, `.github/workflows/artigas1-web.yml` (suma `vision.py`).

## Pruebas ejecutadas

| Prueba | Tipo | Resultado |
|---|---|---|
| Vitest | Automatizada | 30 archivos, 144 pruebas, todas pasan (Sprint 02: 131) |
| Lint y build (normal y GitHub Pages) | Automatizada | Sin errores |
| `juego.py` | Automatizada | 309 de 309, con semilla al azar y con `?semilla=4` (Sprint 02: 303) |
| `fisica.py` | Automatizada | 41 de 41 |
| `vision.py` | Automatizada | **11 de 11** (antes 10 de 11) |
| Backend pytest (sin cambios) | Automatizada | 31 de 31 |
| Progreso con el backend FastAPI real: 101 completa en un navegador, lo recupera en otro navegador limpio; 202 no ve nada | Manual | Correcto |
| Capturas: Tierra de día y de noche desde la Cúpula, panel de la órbita, ajustes con 10 filas, bienvenida zurda | Manual | Correcto |
| Workflow de CI en GitHub | — | Pendiente de la primera corrida en el PR |
| Todo en el visor | Pendiente en Quest 2 | — |

## Limitaciones conocidas

- B13 queda parcial: `recorrido.js` sigue siendo grande (1.386 líneas).
- No hay voces; el ambiente es sintetizado y su volumen sale del mismo ajuste que los avisos.
- El progreso local no tiene botón de borrado para el docente.
- Con backend, recuperar el progreso pide hasta 21 consultas (lista de sesiones + eventos de las últimas 20). Un endpoint de progreso por estudiante lo haría en una sola, pero cambia el contrato.
- La órbita acelerada no cambia la luz de la estación.

## Validación en Meta Quest 2 (sumar a los Sprints 01 y 02)

1. Repetir la Descarga dos veces: el contenedor que va a cuarentena y el faltante tienen que cambiar.
2. Escuchar el cambio de ambiente al pasar de un módulo a otro, y el silencio con respiración en la EVA. Ajustar el volumen desde la tablet.
3. En la Cúpula: ACELERAR ÓRBITA, ver pasar el día y la noche sobre el Río de la Plata y comprobar que no maree. Al salir, todo vuelve a la normalidad.
4. Activar el modo zurdo y hacer la práctica guiada completa con los controles intercambiados.
5. Completar una actividad con un código, recargar, volver a entrar con el mismo código: tiene que aparecer «Progreso recuperado».
6. Salir a la EVA en los primeros 30 s después de cargar y mirar las alas solares (maniobra inicial).

## Pendientes para el Sprint 04

Dependen de vos o del hardware: B03 (fps en el Quest), B04 (prueba con novatos), B12 (WebXR o Unity), revisión docente del debrief, B08 (luz horneada, según B03).

Desarrollo: B13 completo (paneles y oyentes de cada actividad fuera de `recorrido.js`), B16 (plan de carga del carguero), B21 (pre/post test; necesita preguntas del docente), B19 (memoria de lienzos), botón docente para borrar progreso, voces de Control Montevideo (necesitan grabación).
