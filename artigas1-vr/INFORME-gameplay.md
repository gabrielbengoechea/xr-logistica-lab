# Artigas-1 · Informe de la tercera iteración: gameplay, interacción y exploración (12/11/2026)

Alcance: el simulador WebXR del portal (`web-dashboard/public/artigas1/`, three.js 0.170, sin dependencias nuevas). **El proyecto Unity no se tocó en esta iteración.**

**Cómo leer los estados**

- **Probado**: lo juega una prueba automática en Chrome sin interfaz, con los dos controles del visor simulados (posición, grip, gatillo, sticks y botones) sobre el mismo bucle del juego.
- **Pendiente de visor**: implementado, pero solo un Quest puede confirmarlo.
- **Pendiente**: no hecho.

Nada se midió en un Quest 2. Los 72 fps siguen siendo un objetivo.

## 1. Auditoría inicial

| Tema | Lo que había |
|---|---|
| Motor | three.js con WebXR (`recorrido.js` y módulos en `js/`). Unity 6 con XR Interaction Toolkit, sin compilar, en paralelo. |
| Rig | Un grupo (`rig`) con la cámara adentro; en 0G el rig es el cuerpo. |
| Manos | Tres cajas translúcidas por control. Sin dedos. |
| Locomoción | Stick izquierdo empuje, stick derecho giro de 30° y subir o bajar, gatillo freno. |
| Colisiones | Propias (grilla de triángulos), sólidas. |
| Interacción | El grip solo servía para barandas, paredes y los 29 objetos flotantes decorativos. Ninguno tenía función. |
| Interfaz | Un panel HTML que el visor no muestra. Dentro de la VR no había ningún menú. |
| Actividades | Ninguna en la versión web. Las de Unity (manifiesto, balance) nunca corrieron. |
| Navegación | A/B saltaba de módulo en módulo, sin mapa. |
| Exterior | No existía. |

## 2. Problemas detectados

1. **Los objetos no se podían usar** porque no había ningún sistema de herramientas: agarrar era lo único que existía.
2. **Las actividades no eran accesibles** porque en la versión web no había ninguna, y no había interfaz dentro de la VR desde donde iniciarlas.
3. **Las manos eran cajas** porque se dibujaban como tres `BoxGeometry` por control.
4. **No había navegación** más allá del salto con A/B.
5. **No había exterior.**

Fallas que encontraron las pruebas durante esta iteración, ya corregidas:

| Falla | Causa | Arreglo |
|---|---|---|
| El rayo del control no apretaba ningún botón | El cálculo del corte con el panel pisaba su propio vector de origen | Temporales propios en `PanelVR.cortar` |
| El casco exterior del Nodo estaba abierto del lado de la esclusa en lugar de abajo | Ángulo de inicio del cilindro mal calculado | Corregido y medido (abre de -143° a -37°) |
| Acercar la mano espantaba el objeto | La mano abierta le pasaba su velocidad | Solo empuja un manotazo de más de 0,6 m/s |
| Empujando contra el cable tenso, el cuerpo vibraba | El cable imponía una velocidad de retorno de golpe | Tramo elástico de 60 cm que tira suave |
| La guía avisaba «llegaste» antes de cruzar la escotilla | Radio de llegada de 85 cm | 60 cm |
| Apuntando al fondo del mapa, el gatillo izquierdo no lo cerraba | Cualquier gatillo sobre un panel se daba por usado | Solo si cae sobre un botón |

## 3. Arquitectura de interacción

| Pedido | Módulo | Qué hace |
|---|---|---|
| HandModelController, HandPoseController | `js/manos.js` | Manos, poses, brazos y cuerpo |
| VRInteractionManager, GrabbableObject | `js/flotantes.js` | Agarre universal, pasar de mano, soltar con inercia |
| GripPoint, ToolInteraction | `js/herramientas.js` | Modelos y puntos de agarre por mano |
| BarcodeScanner | `js/escaner.js` | Pistola lectora |
| LogisticsTablet | `js/tablet.js` | Tablet |
| InventoryInteraction | `js/inventario.js` | Bultos, huecos, contenedores |
| ActivityManager | `js/actividades.js`, `js/misiones.js` | Gestor y las cinco actividades |
| (puntos de trabajo) | `js/inspeccion.js` | Mantenimiento con herramienta y gatillo |
| StationMapController | `js/mapa.js` | Mapa |
| StationNavigation | `js/navegacion.js` | Módulo actual, visitados y guía |
| VRLocomotionController, VRViewController | `js/locomocion.js`, `recorrido.js` | Movimiento y giro |
| StationExteriorController, SolarPanelController, AntennaController | `js/exterior.js` | Exterior |
| EVAController, TetherSystem, StationTransitionManager | `js/eva.js` | Caminata, cable y transición |
| (interfaz VR) | `js/paneles.js`, `js/sonido.js` | Paneles con botones, rayo, toque y sonidos |

`recorrido.js` solo arma las piezas, reparte la entrada y corre el bucle.

## 4. Manos y agarre

- **Mano del traje en primera persona.** Guante blanco con palma y yemas de goma, puño celeste, antebrazo y brazo hasta el hombro (cinemática inversa de dos huesos), y debajo de la cabeza el torso, la unidad del pecho y las piernas. En la caminata el guante es más grueso.
- **Dedos.** Palma, pulgar y cuatro dedos de tres falanges cada uno, con flexión independiente. 13 poses: abierta, relajada, puño, señalar, botón, baranda, apoyo, cilindro, pistola, pistola con gatillo, pinza, plano y caja.
- **Sin seguimiento de dedos.** Las poses salen del grip, el gatillo y lo que la mano sostiene, como se decidió para la Beta con controles. El índice acompaña al gatillo.
- **No es una malla con esqueleto (skinned mesh).** Cada falange es una cápsula; manos, brazos y cuerpo son 72 piezas en **una** llamada de dibujo. Es más barato y se ve como mano, pero no tiene piel continua entre falanges.
- **Agarre.** El grip toma el objeto más cercano a menos de 12 cm de su superficie; un aro amarillo marca cuál. Se pasa de mano tomándolo con la otra. Al soltar conserva la velocidad de la mano.
- **Punto de agarre.** Cada herramienta define su pose en la mano (derecha y espejada para la izquierda) y la pose de dedos. Al tomarla se acomoda en 0,12 s.
- **Prioridades.** Una baranda al alcance gana sobre un objeto. Una mano con herramienta no se agarra de la estación ni apunta a paneles: su gatillo es de la herramienta.

## 5. Objetos funcionales

| Objeto | Función |
|---|---|
| Pistola lectora | El gatillo enciende el haz y lee. Rayo real contra bolsas y contenedores, alcance 1,6 m. Cuatro resultados: lectura correcta, «no veo la etiqueta» (de costado), «etiqueta ilegible» (bolsa dañada), «sin lectura». Pantalla, sonido, vibración y cartel. |
| Tablet | Se sostiene con una mano y se opera con la otra (rayo o dedo). Inventario, órdenes de trabajo, módulos con guía, ajustes. |
| Linterna | El gatillo enciende el haz; sirve en los puntos que la piden. |
| Inspector, medidor, llave | Trabajan en los puntos de mantenimiento: apuntando (inspector) o apoyando (medidor, llave) y manteniendo el gatillo. |
| Destornillador | Se toma con su agarre. No tiene tarea asignada todavía. |
| Radio | El gatillo da un mensaje de Control Montevideo. |
| Tarjeta, portapapeles, manuales | Se toman y se sueltan. Sin función. |
| Contenedores (6) | Código y hueco de destino. Soltados a menos de 32 cm de un hueco libre quedan asegurados con correa; en el hueco equivocado, quedan puestos y avisa el error. |

## 6. Actividades

Estados: `BLOQUEADA → DISPONIBLE → ACTIVA → COMPLETADA`, más `PAUSADA` y `FALLIDA`. Una a la vez. Reloj, errores, puntaje de 0 a 100 y resumen al terminar.

| Actividad | Dónde | Qué se hace | Concepto |
|---|---|---|---|
| Recepción del carguero | Colonia | Escanear cinco bultos del manifiesto e informar una discrepancia | Recepción e identificación |
| Almacenamiento | Rivera | Escanear tres contenedores, llevarlos a su hueco y asegurarlos | Ubicación y sujeción |
| Conteo de inventario | Rivera | Escanear todos los bultos de una estantería | Conteo cíclico |
| Mantenimiento | Tacuarembó | Cuatro puntos, cada uno con su herramienta | Mantenimiento |
| Caminata espacial | Esclusa | Salir, tres tareas afuera y volver, en 12 minutos | Seguridad operacional |

La caminata se desbloquea al completar el mantenimiento. Se inician desde seis terminales físicos, la tablet o el mapa.

## 7. Controles

| Control | Acción |
|---|---|
| Stick izquierdo | Moverse hacia donde se mira y de costado |
| X / Y | Bajar / subir |
| Stick derecho | Girar; mirar arriba o abajo |
| Gatillo izquierdo | Abrir y cerrar el mapa (se arma al 60 %) |
| Gatillo derecho | Usar la herramienta, o apretar el botón al que se apunta |
| Grips | Tomar y soltar; agarrarse de barandas y paredes |
| A | Freno |
| B | Enderezar el cuerpo |

- Si la mano izquierda lleva una herramienta, su gatillo es de la herramienta y no abre el mapa.
- Con un panel abierto la locomoción sigue activa; el mapa se cierra solo si te alejás 2,6 m.
- Durante una transición no se puede mover.
- Ajustes en la tablet: giro suave o por pasos de 30°, sensibilidad, velocidad, giro vertical, freno asistido y orientación de las manos. Se guardan en el navegador.
- **Compu:** W A S D, Q/E, Espacio, F tomar, X gatillo, M mapa, T tablet, V verse de afuera, clic en los botones.

## 8. Mapa y navegación

- Panel flotante a 85 cm, mirando al usuario, quieto en el espacio. Si ahí hay una pared se acerca, hasta 50 cm.
- Dibuja la estación de costado y a escala: carguero, Colonia, Rivera, Nodo, Tacuarembó, la Cúpula abajo, la esclusa y, por fuera, paneles solares, antena y radiadores.
- Marca dónde estás, qué visitaste y dónde hay actividades.
- Cada lugar se selecciona. Desde ahí: **guiarme** (flechas por el camino físico, pasando escotillas), **traslado** (fundido breve) o iniciar la actividad del módulo.
- Afuera, la guía sigue las rutas de pasamanos y sabe volver a la esclusa.

## 9. Locomoción

- Empuje de 1,1 m/s² hasta 1,5 m/s; al soltar el stick el cuerpo sigue por inercia.
- El giro es alrededor de la cabeza: el seguimiento del visor no se toca. Arranque y frenada suavizados.
- Freno: se detiene en unos 2 s.
- Barandas y paredes: igual que antes.

## 10. Exterior

- Cascos por módulo con los radios que envuelven el interior, mantas térmicas, aros de unión y la placa «ARTIGAS-1».
- Dos alas solares sobre un mástil con junta: giran a 2,2°/s hasta quedar de frente al sol y después lo siguen.
- Dos antenas orientables que cada tanto cambian de objetivo a 5°/s y se detienen; antenas fijas.
- Radiadores, viga, cámaras, luces de navegación, 33 pasamanos.
- 8 mallas y unos 5.900 triángulos. Se dibuja solo afuera y desde la Cúpula.

## 11. Caminata espacial

1. En el terminal de la esclusa del Nodo, «SALIR AL EXTERIOR». Lejos de la escotilla no deja y dice por qué.
2. Fundido con «despresurizando». Aparecés afuera, frente a la escotilla, con la misma orientación.
3. Guantes gruesos, borde del casco, indicadores (tiempo, oxígeno, cable, objetivo) y el cable a la vista.
4. El inspector y la llave esperan en un soporte junto a la escotilla.
5. **Cable de 14 m.** Avisa con sonido y vibración desde 11,5 m. Los últimos 60 cm tiran suave hacia la estación; a 14 m frena. Los tres puntos de trabajo quedan dentro del largo.
6. Desde afuera no se atraviesa el casco. Se vuelve por el terminal exterior, cerca de la escotilla.
7. Si se acaban los 12 minutos, la actividad falla y el cable te trae.

El traje completo (casco, mochila, botas) se ve solo en la compu con la tecla V. En el visor se ven guantes, brazos y cuerpo.

## 12. Archivos

**Nuevos** en `web-dashboard/public/artigas1/js/`: `actividades.js`, `misiones.js`, `inspeccion.js`, `escaner.js`, `inventario.js`, `herramientas.js`, `tablet.js`, `paneles.js`, `mapa.js`, `navegacion.js`, `exterior.js`, `eva.js`, `sonido.js`.

**Modificados:** `recorrido.js` (reescrito), `js/manos.js` (reescrito), `js/flotantes.js`, `js/estacion.js`, `js/etiquetas.js`, `index.html`.

**Pruebas:** `artigas1-vr/Tools/pruebas-web/juego.py` (nuevo), `fisica.py`, `web-dashboard/src/artigas1/juego.test.js` (nuevo).

## 13. Ejecución

- Quest 2: el portal en el navegador del visor, «Enter VR».
- Compu: `cd web-dashboard && npm run dev` y abrir `/artigas1/`.
- Pruebas: `npm test`; con el sitio servido en el puerto 8765, `python3 artigas1-vr/Tools/pruebas-web/juego.py` y `fisica.py`.

## 14. Resultados de las pruebas

| Conjunto | Resultado |
|---|---|
| `juego.py` (juego completo en Chrome) | 159 de 159 |
| `fisica.py` (colisiones, flotantes, Tierra) | 41 de 41 |
| Vitest | 85 de 85 (15 nuevas) |
| Lint | Limpio |

Las cinco actividades se juegan de punta a punta, con un error a propósito en cada una.

| Criterio | Estado |
|---|---|
| Manos reconocibles, dedos con movimiento, poses de agarre | Probado (poses y piezas). El aspecto, pendiente de visor |
| Los objetos se acomodan a la mano | Probado. La orientación respecto del control físico, pendiente de visor |
| Sin cuadrados | Probado |
| Escáner: se toma, se usa, reconoce etiquetas | Probado |
| Tablet | Probado |
| Herramientas, contenedores, soltar y colocar | Probado |
| Actividades accesibles, botones, inicio, fin, resultados | Probado |
| Gatillo izquierdo abre y cierra el mapa | Probado |
| Mapa representa la estación, módulos seleccionables, ubicación | Probado |
| Navegar entre módulos | Probado (guía volando con el stick y traslado) |
| Stick izquierdo en 3D, stick derecho orienta, 0G | Probado |
| Seguimiento de cabeza intacto | Probado (la cabeza no se mueve al girar) |
| Sin movimientos bruscos | Probado en números. La comodidad, pendiente de visor |
| Exterior, paneles que se orientan, antenas con movimiento | Probado |
| Escotilla, salida, caminata, pasamanos, cable, regreso | Probado |
| Funciona autónomo en el Quest 2 | Pendiente de visor |
| Sin errores críticos | Probado en Chrome |
| 72 fps | **No medido** |

Costo medido en esta PC: 0,07 ms de lógica por cuadro. Llamadas de dibujo: Tacuarembó 72, Nodo 50, Rivera 37, Colonia 19.

## 15. Limitaciones

- **Ningún control real.** Las pruebas simulan los controles según el estándar de WebXR. Si las manos aparecen giradas respecto del control, la tablet tiene ocho orientaciones para elegir.
- **Subieron las llamadas de dibujo.** Tacuarembó pasó de 45 a 72: cada herramienta y cada terminal es una. Siguen bajo 100, pero es lo primero a agrupar si el Quest no llega.
- **El rayo de los paneles atraviesa paredes.** Se puede apretar un terminal del otro lado de un mamparo si está a menos de 3 m.
- **En las pruebas de la caminata** el astronauta se ubica directamente en cada punto de trabajo. El recorrido por pasamanos entre puntos se probó solo en un tramo.
- **Los paneles solares se orientan solos**; el jugador no los maneja.
- **Sonidos:** tonos sintetizados, no grabaciones.
- **Sin telemetría:** la versión web no manda las sesiones al backend. El contrato de datos no cambió.
- **Unity:** no tiene nada de esto. Portarlo es un trabajo aparte.
- **Sin seguimiento de manos**, por decisión de la Beta.

## 16. Confort contra el mareo (corrección del 12/11/2026)

En la primera prueba con el visor, **el giro continuo con el stick derecho mareó mucho**. Se pasó al sistema de *Mission: ISS*, y ahora es lo de fábrica:

- **Giro por pasos con parpadeo.** Cada empujón del stick derecho gira 30°. La vista se funde a negro en 60 ms, el cuerpo gira con la pantalla tapada y la vista vuelve en 90 ms (190 ms en total). Nunca se ve la rotación. Para el siguiente giro hay que soltar el stick.
- **Arriba y abajo se mira con la cabeza.** El stick ya no inclina la vista. Si se activa en la tablet, también va por saltos de 20° con parpadeo.
- **Túnel al moverse.** Con el stick izquierdo, la periferia se oscurece y queda una ventana al frente. Se cierra con la velocidad y desaparece al quedarse quieto. Cuatro niveles en la tablet: apagado, suave, medio (de fábrica) y fuerte.
- **Ajustes viejos.** Quien ya tenía guardado el giro suave en el navegador pasa solo al modo de confort; se conservan la velocidad y la orientación de las manos.
- El giro suave sigue como opción, ahora con el túnel cerrado mientras gira.
- Si sigue mareando: túnel fuerte, frenado asistido activado y velocidad del propulsor al 50 %.

Código: `js/confort.js` (nuevo), `recorrido.js` y `js/tablet.js`. Se agregaron 15 pruebas a `juego.py` (173 en total), que verifican que el giro ocurre entero con la pantalla al 100 % de negro.

**Pendiente de visor:** si el parpadeo y el túnel alcanzan para quien se mareó. Es lo primero que hay que probar.
