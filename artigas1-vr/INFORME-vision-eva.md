# Artigas-1 · Ojo izquierdo, luz de la caminata espacial y vista vertical (13/11/2026)

Alcance: el simulador WebXR del portal (`web-dashboard/public/artigas1/`). Unity no se tocó.

**Cómo leer los estados.** «Verificado» quiere decir comprobado con pruebas automáticas en Chrome sin interfaz, que dibujan cada ojo por separado con las mismas capas que usa WebXR. Nada se volvió a probar en el Quest 2 después de los cambios.

## A. Diagnóstico

### Ojo izquierdo tapado

En la grabación (3 min 05 s), desde que se aprieta «SALIR AL EXTERIOR» (segundo 96) hasta el final, el video no muestra el exterior. Se ven superficies beige y azul grisáceo que llenan toda la imagen.

**Causa: el traje de la vista en tercera persona se dibujaba solo en el ojo izquierdo.**

- El traje completo (casco, mochila, torso, botas) existe para verse desde afuera con la tecla V en la compu. Va pegado a la cámara y estaba en la capa 1, con la idea de que la cámara del astronauta no lo dibujara.
- En WebXR, three.js dibuja el ojo izquierdo con la capa 1 habilitada y el derecho con la capa 2. Entonces, apenas se salía al exterior:
  - el **ojo izquierdo** quedaba adentro del casco y del torso del traje, iluminados por el sol del atardecer. Eso es lo beige y azul del video;
  - el **ojo derecho** veía bien.
- El Quest graba la imagen del ojo izquierdo, por eso el video quedó así.
- **En las pruebas anteriores no apareció** porque la cámara de la compu solo dibuja la capa 0. Las capturas de la caminata que mandé antes eran de esa cámara: no mostraban lo que veía cada ojo.

No era un problema de viewports, del framebuffer, de OpenXR ni de la grabación. La app no tiene una cámara de captura propia: el Quest graba el ojo izquierdo.

La prueba nueva reproduce el defecto sobre la versión anterior: el traje aparece solo en el ojo izquierdo, y en la vista hacia los paneles el 45 % del centro de la imagen difiere entre los dos ojos.

### Luz que marea en la caminata

1. **Causa principal (verificada): la misma de arriba.** Con un ojo dentro del casco y el otro viendo el espacio, cada ojo recibe una imagen distinta. Esa superficie se movía con la cabeza y cambiaba de brillo según la orientación respecto del sol. Es una causa conocida de mareo y malestar.
2. **Reflejo del sol (verificado).** El brillo especular del exterior usaba un exponente 48, es decir, una mancha chica y casi blanca (231 de 255) que se deslizaba por las caras de los cascos al mover la cabeza. En las mantas térmicas, que son mates, no corresponde.
3. **Balizas.** Se prendían y apagaban de golpe (destello on/off). Las pruebas no llegaron a medir ese destello porque las balizas ocupan menos de un píxel a la resolución de la prueba.
4. **Grilla de las celdas solares.** Sin antialias, las líneas finas pueden titilar al girar el panel. Se corrigió, pero la prueba de parpadeos no mostró diferencia contra la versión anterior.
5. **Túnel y borde del casco.** Eran planos a 12 cm medidos desde el centro de la cabeza. Para cada ojo quedaban corridos 3 cm: en el ojo izquierdo el hueco del túnel aparecía descentrado (la prueba lo detecta en la versión anterior).

No se encontraron sombras proyectadas (no hay), z-fighting medible, exposición automática ni diferencias entre ojos en el shader de la Tierra.

### Orientación vertical

- El sistema de mirar arriba y abajo con el stick ya existía: en saltos de 20° con parpadeo, o suave.
- Desde la corrección del mareo venía **apagado de fábrica**, así que en el visor no respondía.
- Además, con giro suave inclinaba alrededor del eje derecho de la cabeza, con su roll incluido. Combinado con giros a los costados, la vista podía quedar rolada.
- No tenía límite de inclinación ni zona muerta configurable.

## B. Correcciones

| Tema | Cambio |
|---|---|
| Estéreo | El traje pasa a la capa 3, que no dibuja ningún ojo ni la cámara de la compu; solo la cámara externa de la tecla V. Se dejó un comentario sobre las capas 1 y 2 de WebXR. |
| Estéreo | Túnel y borde del casco se calculan por ángulo desde el eje de cada ojo (`crearMascaraOcular` en `js/confort.js`): quedan centrados e iguales en los dos ojos. |
| Captura vertical | Sin cambios en la app: el Quest graba el ojo izquierdo, que ahora muestra lo mismo que el derecho. No se agregó una cámara de captura, para no tocar lo que ve el usuario. |
| Luz exterior | Especular ancho y débil: exponente 12, intensidad 0,04 en las mantas y 0,16 en las celdas. El reflejo pasó de 231/255 a menos de 50. |
| Luz exterior | Terminador suave en el casco, un poco más de luz de la Tierra en las caras en sombra. |
| Luz exterior | Balizas con un pulso suave cada 3,6 s en lugar de un destello on/off. |
| Luz exterior | Grilla de celdas solares con antialias (`fwidth`) que se funde en su color promedio cuando las celdas quedan chicas en pantalla. |
| Vista vertical | Encendida de fábrica: el stick derecho arriba o abajo inclina 20° por empujón con el mismo parpadeo a negro que el giro de 30°. Quien tenía ajustes guardados de la versión anterior la recibe encendida. |
| Vista vertical | Se inclina alrededor del eje horizontal derecho de la **mirada** y se gira alrededor del «arriba» de la estación. Con esos dos ejes la vista nunca se rola, por más giros que se combinen. |
| Vista vertical | Límite de inclinación de fábrica 80°, configurable en 45°, 60° o 80°, o apagado. En el tope no parpadea: da un toque de vibración. |
| Vista vertical | Zona muerta configurable (10 a 40 %, de fábrica 20 %). |
| Giro suave (opcional) | Curva cuadrática del stick, velocidad máxima de 95°/s a los costados y 55°/s arriba y abajo, aceleración suave, mismo límite. |
| Seguimiento de cabeza | Sin cambios: el stick mueve el cuerpo (rig) alrededor de la cabeza y la cámara la maneja solo el visor. |

## C. Archivos modificados

| Ruta | Componente | Función |
|---|---|---|
| `web-dashboard/public/artigas1/js/eva.js` | `EVAController`, `CAPA_TERCERA_PERSONA` | Traje fuera de las capas de los ojos; borde del casco por ojo |
| `web-dashboard/public/artigas1/js/confort.js` | `crearMascaraOcular`, `Confort` | Túnel y casco centrados en cada ojo |
| `web-dashboard/public/artigas1/js/exterior.js` | `crearMaterial` | Especular, terminador, balizas, grilla con antialias |
| `web-dashboard/public/artigas1/recorrido.js` | `entradaXR`, `ejeInclinacion`, `inclinacionPermitida`, `respuestaStick` | Vista vertical, límite, zona muerta, sin roll; ajustes versión 3 |
| `web-dashboard/public/artigas1/js/tablet.js` | `LogisticsTablet._ajustes` | Vista vertical con límite y zona muerta |
| `web-dashboard/public/artigas1/index.html` | Ayuda | Controles |
| `artigas1-vr/Tools/pruebas-web/vision.py` | Nuevo | Dos ojos por separado y estabilidad de la luz |
| `artigas1-vr/Tools/pruebas-web/juego.py` | Pruebas | Vista vertical, límite, zona muerta, giro suave, ajustes |

## D. Verificación

| Conjunto | Ahora | Versión anterior |
|---|---|---|
| `vision.py` | 11 de 11 | 5 de 11 |
| `juego.py` | 188 de 188 | — |
| `fisica.py` | 41 de 41 | — |
| Vitest | 85 de 85 | — |
| Lint | Limpio | — |

**Qué mide `vision.py`.** Dibuja la caminata espacial con dos cámaras como las de WebXR: el ojo izquierdo con la capa 1, el derecho con la 2, separados 64 mm y con MSAA. Comprueba:

- que ningún objeto se dibuje en un solo ojo;
- que el centro de las dos imágenes coincida, salvo la disparidad, en tres vistas exteriores;
- que no haya zonas que se prendan y apaguen durante 4 s con paneles y antenas en movimiento;
- que el reflejo del sol en el casco no sea una mancha blanca;
- que el túnel quede centrado en cada ojo.

Sobre la versión anterior falla en el traje, en la coincidencia y el brillo entre los dos ojos, en el reflejo y en el túnel.

**Qué miden las pruebas de la vista vertical (`juego.py`).** Que sube y baja 20° con parpadeo, sin verse la inclinación. Que la cámara (el seguimiento de la cabeza) no cambia. Que no hay roll después de 12 giros combinados con la cabeza girada. Que se detiene en el límite, que la zona muerta funciona, y en suave, que la respuesta es progresiva y con tope de velocidad.

**Limitaciones**

- Las pruebas no corren en el visor: no ven el compositor del Quest (reproyección, foveación) ni la grabación real.
- El campo visual de los ojos de prueba es simétrico (47°); el del Quest es más ancho hacia afuera.
- Que la luz ya no maree solo se sabe probándolo. Lo único demostrado es que se fue la causa más fuerte (la imagen distinta en cada ojo) y que el reflejo dejó de ser una mancha blanca.

**Pendiente en el Quest 2**

1. Grabar de nuevo la caminata espacial: el video tiene que mostrar el exterior.
2. Salir con la esclusa y mirar hacia el sol, los paneles y el casco: confirmar que no hay destellos ni malestar.
3. Mirar arriba y abajo con el stick derecho: confirmar que el parpadeo vertical resulta tan cómodo como el horizontal.
4. Probar el límite de 80° y la zona muerta en la tablet.
