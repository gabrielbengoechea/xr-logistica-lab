# Artigas-1 VR · Sprint 01: estabilización para uso en aula

Base: rama `main`, commit `c1021e7` (PR #23), sin cambios locales al empezar. Alcance: solo el recorrido WebXR (`web-dashboard/public/artigas1/`). No se tocaron Unity, la locomoción 0G, el agarre, el antimareo, la geometría, el astronauta, el audio, los materiales ni el contrato de datos del backend.

Objetivo: que varios estudiantes puedan usar el mismo visor, uno tras otro, sin heredar identidad, sin mezclar telemetría y sin que una actividad trabe a las demás.

## Trazabilidad

| ID | Problema | Solución | Prueba | Estado |
|---|---|---|---|---|
| B01 | Almacenamiento sin pasos | El gestor no activa actividades sin pasos; Almacenamiento arma una partida nueva o avisa que está completo | `almacenamiento.test.js` (6), `juego.py` fase 14 (2) | Implementado y probado en Chrome · falta Quest 2 |
| B02 | Identidad heredada | Sesión por carga, código no persistente, «Nuevo estudiante» en tablet y página, bienvenida por sesión | `sesion.test.js` (5), `juego.py` fase 14 (4) y pantalla inicial (1), manual con backend real | Implementado y probado en Chrome · falta Quest 2 |
| B06 | Consentimiento | Panel previo con ACEPTAR / SEGUIR ANÓNIMO; sin aceptación, ningún pedido | `telemetria.test.js` (5), `juego.py` fase 9 (3) y pantalla inicial (1) | Implementado y probado en Chrome · falta Quest 2 |
| B22 | Interfaz en inglés | Traducción del botón de VRButton sin tocar `vendor/`; ayuda sin `?fps` | `sesion.test.js` (1), `juego.py` pantalla inicial (1) | Implementado · falta ver los textos dentro y fuera de la RV en Quest 2 |
| B26 | POST sin backend | Prueba de salud una vez; estados `ausente` y `sin_conexion` | `telemetria.test.js` (5), `juego.py` (2), manual con backend real | Implementado y probado |

## 1. Problemas originales

| ID | Problema |
|---|---|
| B01 | Con los seis contenedores ya guardados, iniciar Almacenamiento devolvía `true`, creaba cero pasos y la actividad quedaba ACTIVA para siempre. Como solo puede haber una activa, se bloqueaban todas las demás. |
| B02 | El código del alumno quedaba en `localStorage` (`artigas1.alumno`): el siguiente estudiante lo heredaba. La bienvenida se mostraba una sola vez por navegador (`artigas1.bienvenida`). |
| B06 | La telemetría mandaba datos con el código del alumno sin explicarle nada antes. |
| B22 | La pantalla inicial decía ENTER VR / VR NOT SUPPORTED; la ayuda mencionaba «Enter VR» y el parámetro de depuración `?fps`. |
| B26 | Sin backend, la telemetría hacía POST a `/api` del mismo origen y recibía 501 (servidores estáticos como `python -m http.server`). Solo GitHub Pages y `file:` se detectaban, por el nombre del dominio. |

## 2. Diagnóstico técnico

- **B01.** `GestorActividades.iniciar()` asignaba `a.pasos = def.pasos(a)` y pasaba a ACTIVA sin revisar si la lista venía vacía. Una actividad solo se completa cuando `pasos.every(hecho)` se dispara desde `completarPaso`, que nunca se llama si no hay pasos. En `misiones.js`, Almacenamiento elige «contenedores que no están en su destino»: con todos guardados, la lista es vacía. Además, un contenedor sin destino asignado quedaba siempre como pendiente.
- **B02.** `telemetria.js → leerConfig()` guardaba `?alumno=` y lo releía en cada carga. `recorrido.js → bienvenidaVista()` leía una marca permanente. No había ninguna acción para cerrar la sesión de un estudiante.
- **B06.** `Telemetria._enviar()` solo miraba si había backend.
- **B22.** Los textos los pone `vendor/addons/webxr/VRButton.js` (three.js, código de terceros) y los cambia según el estado de la sesión.
- **B26.** `leerConfig()` usaba `ubicacion.origin` como backend salvo en `*.github.io` y `file:`.
- **Dependencias.** Bienvenida, identidad y telemetría estaban acopladas por `localStorage`; el gestor de actividades alimenta la telemetría por un oyente dentro de `recorrido.js`.

## 3. Archivos modificados

| Archivo | Cambio |
|---|---|
| `web-dashboard/public/artigas1/js/actividades.js` | `iniciar()` no activa actividades sin pasos válidos; `motivoNoInicio`, evento `sin_pasos`, `def.sinPasos`. |
| `web-dashboard/public/artigas1/js/misiones.js` | Almacenamiento: reacomodo seguro con todo guardado; ignora contenedores sin destino; mensaje `sinPasos`. |
| `web-dashboard/public/artigas1/js/telemetria.js` | Consentimiento (`aceptar`, `anonimo`), prueba de salud del backend con estados, `finalizar()`, `?alumno=` solo como sugerencia. |
| `web-dashboard/public/artigas1/js/sesion.js` (nuevo) | Sesión del estudiante: flujo consentimiento → código, fin de sesión, claves de sesión vs. ajustes del visor, panel VR, oyente de telemetría del gestor. |
| `web-dashboard/public/artigas1/js/entrada.js` (nuevo) | Traducción del botón de VRButton sin modificar `vendor/`. |
| `web-dashboard/public/artigas1/js/tablet.js` | Fila de sesión en el menú y página de confirmación «Nuevo estudiante». |
| `web-dashboard/public/artigas1/recorrido.js` | Integración: panel de sesión, bienvenida por sesión, `nuevoEstudiante()`, reacomodo de contenedores, mensajes de carga sin detalles técnicos. Cambios puntuales, sin refactor. |
| `web-dashboard/public/artigas1/index.html` | Estado de la sesión y botón «Nuevo estudiante»; ayuda en español sin `?fps`. |
| `web-dashboard/src/artigas1/almacenamiento.test.js` (nuevo) | Pruebas B01. |
| `web-dashboard/src/artigas1/telemetria.test.js` (nuevo) | Pruebas B06, B26 y contrato SessionReport. |
| `web-dashboard/src/artigas1/sesion.test.js` (nuevo) | Pruebas B02 (estudiante A → B), panel y B22. |
| `artigas1-vr/Tools/pruebas-web/juego.py` | Se adapta al nuevo flujo (modo anónimo al empezar, bienvenida por sesión, telemetría con consentimiento) y suma la fase 14 y las verificaciones de la pantalla inicial. |
| `artigas1-vr/Tools/pruebas-web/vision.py` | Dos líneas: empieza en modo anónimo para que el panel de sesión no tape las capturas. |

## 4. Soluciones implementadas

**B01.** Regla general en el gestor: si `def.pasos()` devuelve una lista vacía, pasos sin `id` o lanza un error, la actividad no se activa, `iniciar()` devuelve `false` y deja el motivo en `motivoNoInicio`. `iniciarActividad()` en `recorrido.js` lo muestra como aviso. Para Almacenamiento, con todo guardado, se arma una partida nueva: hasta tres contenedores bien ubicados que nadie tiene en la mano vuelven sueltos a su lugar de origen (mismo procedimiento que ya usa Balance con sus tanques: `inventario.retirar`, `amarres.quitar`, `flotantes.guardar`). Si no hay nada para mover, se informa «El almacenamiento ya está completo…» y la actividad queda DISPONIBLE.

**B02.** Cada carga de la página es una sesión independiente: `session_id` nuevo, consentimiento sin decidir, código vacío y bienvenida pendiente. El código ya no se guarda; `?alumno=` solo propone el código en el teclado y hay que confirmarlo. «Nuevo estudiante» está en la tablet (menú → NUEVO ESTUDIANTE → SÍ, TERMINAR / CANCELAR) y en el panel de la página (con confirmación del navegador). Al confirmar: se cierra la actividad en curso como «abandonada», se manda el informe final (si hubo consentimiento), se borran las claves de sesión, se sale de la sesión XR y se recarga la estación sin `?alumno=`.

Decisión de diseño: **recargar** en lugar de reiniciar en el lugar. Reiniciar en caliente exigía devolver a su estado inicial contenedores, filtro, carga del carguero, inventario escaneado, EVA y guía, repartidos en `recorrido.js` (fuera de alcance: «no refactorizar masivamente»). La recarga garantiza independencia total. Costo: el visor sale de la RV y el próximo estudiante vuelve a tocar «Entrar en realidad virtual»; los recursos ya están en caché del navegador.

Datos que se conservan (`CLAVES_DEL_VISOR`): `artigas1.ajustes`, `artigas1.calibracionManos`, `artigas1.backend`, `artigas1.clave`. Datos de sesión que se borran (`CLAVES_DE_SESION`): `artigas1.alumno`, `artigas1.bienvenida`, `artigas1.sesion`. No se borra todo `localStorage`.

**B06.** Al cargar aparece un panel (VR y compu) que explica qué se registra (pasos, errores, tiempos y pistas, con un código y no con el nombre), para qué (evaluar el desempeño y mejorar las actividades), quién lo ve (el docente, en el panel del aula) y que se puede usar todo sin aceptar. Aclara que no reemplaza la autorización institucional o familiar. Opciones: ACEPTAR EL REGISTRO (pide el código con un teclado numérico) o SEGUIR ANÓNIMO. Sin aceptación no sale ningún pedido del visor: ni POST ni la prueba del backend. El consentimiento vive en el objeto `Telemetria` de esa carga y no se guarda, así que cada estudiante decide de nuevo. Con aceptación, el informe es el mismo `SessionReport` de siempre.

Decisión: el modo anónimo no envía nada, ni siquiera agregados sin código. Es lo más simple de verificar; un modo anónimo con agregados queda para el Sprint 02 si el docente lo necesita.

**B22.** `traducirBotonVR()` envuelve el elemento que devuelve `VRButton.createButton` y, con un `MutationObserver`, traduce cada texto que VRButton le pone: ENTRAR EN REALIDAD VIRTUAL, VOLVER AL MODO DE ESCRITORIO, REALIDAD VIRTUAL NO COMPATIBLE, REALIDAD VIRTUAL NO PERMITIDA, LA REALIDAD VIRTUAL NECESITA HTTPS, ESTE NAVEGADOR NO TIENE REALIDAD VIRTUAL. Cuando no se puede entrar, el `title` explica qué hacer. La sesión XR la sigue manejando VRButton sin cambios. Se sacó `?fps` de la ayuda y los mensajes de error de carga ya no muestran rutas ni excepciones (van a la consola).

**B26.** Antes del primer envío (y solo con consentimiento) se pide `GET /api/v1/health` una vez. Si responde JSON con `status: "ok"` se envía; si da 404, 405, 501 o algo que no es JSON (sitio estático o SPA), la telemetría queda apagada para esa sesión, con un `console.info`. Un error de red se registra como `sin_conexion` con un `console.warn` y se vuelve a probar a los 30 s: así un backend caído se distingue de no tener backend. GitHub Pages y `file:` siguen sin probar nada. Con el backend confirmado, los envíos salen en el acto (necesario para `keepalive` al cerrar la página).

## 5. Pruebas ejecutadas

Tipos: **[A]** automatizada ejecutada · **[M]** manual ejecutada (script ad hoc en Chrome) · **[C]** inspeccionada en código · **[Q]** pendiente en Meta Quest 2.

| Prueba | Tipo | Resultado |
|---|---|---|
| Vitest completo (`npm test`) | A | 22 archivos, 115 pruebas, todas pasan (base: 19 archivos, 93 pruebas) |
| `almacenamiento.test.js` (B01), verificado también que falla con el código original (6 de 6 fallan) | A | 6 de 6 pasan |
| `telemetria.test.js` (B06, B26, contrato) | A | 10 de 10 pasan |
| `sesion.test.js` (B02 A → B, panel, B22) | A | 6 de 6 pasan |
| `npm run lint` | A | Sin errores ni advertencias |
| `npm run build` y build estático de GitHub Pages | A | Compilan; `sesion.js` y `entrada.js` llegan a `dist/artigas1/js/` |
| `pruebas-web/juego.py` (Chrome sin interfaz, juego completo) | A | 293 de 293 (base: 280 de 280; 13 nuevas: B01, B02, B06, B22, B26) |
| `pruebas-web/fisica.py` | A | 41 de 41 (igual que la base) |
| `pruebas-web/vision.py` | A | 10 de 11: la misma falla que en la base («luz: sin parpadeos»), previa al sprint |
| Validación del informe con `SessionReport` de `backend/app/schemas.py` | A | Válido |
| `backend` pytest (no modificado) | A | 31 de 31 |
| Recorrido en Chrome contra el backend FastAPI real, dos estudiantes con código y uno anónimo | M | A (101) y B (202) quedan como dos sesiones distintas en `/api/v1/telemetry/sessions`, con `ended_at`; el anónimo no hace ningún pedido al backend; 0 envíos fallidos |
| Capturas de los paneles nuevos (consentimiento, código, tablet, confirmación) y de la vista de compu | M | Legibles; se corrigió el alto del panel y la ubicación del botón en la página |
| Errores de consola en el juego completo | A | Ninguno propio; solo advertencias de WebGL del renderizado por software |
| Pruebas de lógica C# de Artigas-1 (`dotnet`) | No ejecutadas | No hay `dotnet` en el entorno; no se tocó C# |
| Todo en el visor | Q | Pendiente |

## 6. Resultados obtenidos

- Una actividad sin pasos ya no puede quedar activa ni bloquear el gestor; Almacenamiento se puede repetir indefinidamente.
- Dos estudiantes seguidos generan dos `session_id` y dos `student_id` distintos; ningún evento de A aparece en los informes de B; los ajustes del visor se conservan.
- Sin aceptar el registro no hay ningún pedido de red de telemetría.
- En un servidor estático no hay POST; el contrato `SessionReport` no cambió.
- No se detectaron regresiones en las baterías existentes.

## 7. Limitaciones conocidas

- **Una línea 404 en la consola en servidores estáticos que no son GitHub Pages**, solo si el estudiante acepta el registro: es la prueba `GET /api/v1/health`. No hay POST. El navegador registra el 404 como error de recurso y no se puede silenciar desde la página.
- **Cambiar de estudiante saca al visor de la RV** (recarga). Ver la decisión en la sección 4.
- **Actividad abandonada:** el gestor vacía `pasos` antes de avisar el abandono, así que sus pasos cumplidos no suman a `parts_placed` (los errores sí). Es el comportamiento previo; no se cambió para no tocar el significado de los datos del panel docente.
- **El código de estudiante es solo numérico** en el teclado VR (un código con letras puede venir por `?alumno=`, pero hay que confirmarlo). No se verifica contra una lista del docente: dos estudiantes que escriben el mismo código quedan con el mismo `student_id` (con `session_id` distintos).
- **La explicación de consentimiento** es un texto técnico de la herramienta: no reemplaza la autorización de la institución ni de las familias, y no fija plazos de conservación (eso depende de cómo el centro administre el backend).
- En el juego de prueba quedaron **5 contenedores almacenables** (con destino); la auditoría hablaba de seis. La corrección no depende del número.
- Falla previa de `vision.py` («luz: sin parpadeos ni destellos») y botón PRÁCTICA GUIADA de la tablet con el texto más ancho que el botón: ambas existían antes y quedan fuera del alcance.
- `rectRedondo` se importa sin usar en `recorrido.js` (previo; el lint del repo no revisa los `.js` del recorrido).

## 8. Validación en Meta Quest 2

Servir la rama por https (GitHub Pages de una rama de prueba o el backend del aula) y repetir con dos personas:

1. Abrir la página en el navegador del Quest. Verificar que el botón diga ENTRAR EN REALIDAD VIRTUAL y que, dentro de la RV, al salir diga VOLVER AL MODO DE ESCRITORIO.
2. Entrar en RV: tiene que aparecer el panel «Antes de empezar: registro de actividad» delante, legible a la distancia de lectura, y los dos botones se tienen que poder apretar con el rayo y con el dedo.
3. ACEPTAR EL REGISTRO, escribir un código con el teclado (probar BORRAR y VOLVER) y LISTO. Después tiene que aparecer la bienvenida.
4. Completar Almacenamiento dos veces (o hasta guardar todos) y apretar REPETIR: tiene que arrancar con tres contenedores sueltos y un aviso de partida nueva. Iniciar otra actividad después.
5. Con una actividad en curso: tablet → NUEVO ESTUDIANTE → SÍ, TERMINAR. El visor sale de la RV y la página se recarga; en el panel docente la sesión aparece cerrada con la actividad «abandonada».
6. Segunda persona: tiene que ver otra vez el consentimiento (sin el código anterior) y, al aceptar, la bienvenida. Elegir SEGUIR ANÓNIMO y jugar una actividad: en el panel docente no tiene que aparecer nada nuevo.
7. Revisar que los ajustes de comodidad elegidos por la primera persona (giro, túnel, manos) sigan iguales.
8. Medir cuánto tarda la recarga hasta poder volver a entrar en RV.
9. En el navegador de la compu, sobre GitHub Pages, abrir la consola: no tiene que haber pedidos a `/api`.

## 9. Pendientes para el Sprint 02

- Decidir con el docente si «nuevo estudiante» debe ser sin recarga (exige un reinicio del mundo por sistema) según lo que se mida en el paso 8.
- Contar los pasos cumplidos de una actividad abandonada en el informe (cambio de semántica: acordarlo con el panel docente).
- Lista de códigos válidos por grupo (en el backend) para evitar códigos repetidos o mal tipeados.
- Modo anónimo con métricas agregadas sin identificador, si sirve para la evaluación del curso.
- Ajustar el botón PRÁCTICA GUIADA de la tablet y revisar la falla de `vision.py` sobre parpadeos de luz.
- Hacer que el lint del repo revise los `.js` del recorrido.
