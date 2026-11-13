# Informe: exterior de la estación, tablet del mapa y guantes

Este informe cubre tres pedidos: el mapa como tablet en la mano izquierda, la mejora integral del exterior de Artigas-1 y las manos con guante de astronauta. Todo está en el recorrido WebXR (`web-dashboard/public/artigas1/`). El proyecto Unity no cambió.

No se tocaron la locomoción (`js/locomocion.js`), el sistema contra el mareo (`js/confort.js`, giro por pasos con parpadeo) ni la configuración de la cámara VR. En `recorrido.js` cambiaron solo tres cosas: la lectura del gatillo izquierdo, la carga del guante y dos datos más para las pruebas.

## Archivos

| Archivo | Cambio |
|---|---|
| `web-dashboard/public/artigas1/js/mapa.js` | Tablet del mapa: cuerpo físico, anclaje a la mano izquierda, modo flotante de respaldo |
| `web-dashboard/public/artigas1/js/manos.js` | Pose `tableta`, mano ocupada, carga del guante y huesos movidos por la cinemática |
| `web-dashboard/public/artigas1/js/guante.js` | Nuevo: geometría, material por zonas y malla con piel del guante |
| `web-dashboard/public/artigas1/js/paneles.js` | La mano que sostiene la tablet no apunta a los paneles |
| `web-dashboard/public/artigas1/js/exterior.js` | Exterior reescrito: geometría de detalle, materiales procedurales y atlas de señales |
| `web-dashboard/public/artigas1/recorrido.js` | Gatillo izquierdo: sostener mientras se aprieta; carga del guante |
| `web-dashboard/public/artigas1/guante.bin`, `guante.json` | Guante generado (189 kB) |
| `artigas1-vr/Blender/guante.py` | Nuevo: genera el guante con bpy (malla, pesos, zonas) en 1 s |
| `artigas1-vr/Tools/pruebas-web/juego.py` | Pruebas nuevas del mapa en la mano, el guante y el exterior; de 188 a 204 |
| `artigas1-vr/Tools/pruebas-web/vision.py` | Prueba del reflejo del sol: mide solo la parte especular (ver «Probado») |
| `artigas1-vr/README.md`, `artigas1-vr/Blender/README.md` | Módulos, comandos y conteo de pruebas |

## 1. Tablet del mapa en la mano izquierda

**Uso.** Apretás el gatillo izquierdo y la tablet aparece en esa mano. Mientras lo mantenés apretado la ves, y elegís con el rayo de la mano derecha. Cuando lo soltás, se guarda en 0,18 s (se achica). Una presión leve no la abre. Si la mano izquierda lleva una herramienta, el gatillo sigue siendo de la herramienta.

**Anclaje.** La tablet es un grupo con `matrixAutoUpdate = false`. Cada cuadro, después de leer los controles, su matriz se calcula como:

`mano.objeto.matrixWorld × poseEnMano × escala de apertura`

Se calcula en el mismo cuadro que la mano, sin filtro ni interpolación:

- no tiene retraso respecto del control (la prueba mide menos de 2 mm de diferencia en el mismo cuadro);
- no agrega temblor propio: si el control está quieto, la tablet está quieta.

`poseEnMano` (`poseTabletEnMano()`) inclina la pantalla 1,2 rad sobre el eje de la mano y apoya el borde izquierdo en la palma, a 1,8 cm de la orilla. El ángulo se eligió midiendo tres posturas de brazo (natural, alta y baja): la pantalla mira a los ojos con un coseno de 1,0, 0,93 y 0,98, a 44–49 cm de los ojos.

**Mano.** Mientras la sostiene, la mano izquierda:

- toma la pose `tableta`: dedos curvados alrededor del borde y pulgar sobre el frente;
- queda `ocupada`: no agarra, no se cierra en puño y no apunta a paneles.

Al guardarla queda libre otra vez.

**Aspecto.** Mide 33 × 22,2 × 1,4 cm:

- marco de bordes redondeados, gris industrial, con bisel de 2,5 mm;
- bisel negro alrededor de la pantalla;
- gomas de agarre en los dos costados;
- franja amarilla de identificación;
- tres LED (verde, celeste, amarillo);
- tapa trasera y correa de mano.

La pantalla es el mismo panel del mapa de antes (módulos, ubicación actual, orientación, actividades, «guiarme» e «ir»), escalado a 30 × 18,75 cm. Es una malla para el cuerpo y otra para la pantalla.

**Respaldo flotante.** El mapa flotante de antes sigue disponible:

- con la tecla M en la compu;
- con el botón «ABRIR EL MAPA» de la tablet de muñeca.

Hace falta cuando la mano derecha lleva una herramienta: así una mano libre puede tocar los botones.

## 2. Exterior

Antes, el exterior tenía 5.947 triángulos en 8 mallas, con un shader de luz estable (medido con el `exterior.js` de `main`). Ahora sigue siendo una sola malla fija, más dos alas y dos antenas que se mueven y comparten el mismo material: 34.072 triángulos en 7 mallas. Las alas, las antenas, sus animaciones y las colisiones son las de antes. La placa del nombre, que era una malla aparte, ahora entra en la malla fija: hay una llamada de dibujo menos.

**Geometría nueva**

- **Cascos.** Son paneles de manta térmica (MLI) separados por aros con bulones cada 32 cm. Cada circunferencia se reparte en un número entero de paneles de ~0,55 m, así la costura no se corta donde cierra el cilindro.
- **Sobre los cascos:**
  - 11 paneles de protección contra micrometeoritos, separados del casco, con marco, separadores y bulones;
  - 5 placas de mantenimiento con manija;
  - 4 conductos con abrazaderas y cajas de conexión;
  - 2 accesorios de captura para el brazo robótico, con perno, levas, blanco de alineación y luz verde.
- **Esclusa:**
  - vestíbulo con manta;
  - puerta de aluminio con aro interior, bisagras, manija y barra de cierre;
  - luz verde (y una ámbar apagada).
- **Viga dorsal:** largueros laterales, costillas, abrazaderas de la bandeja de cables, GPS y rastreador de estrellas con su lente.
- **Alas solares:**
  - mástil reticulado de tres largueros con triángulos y diagonales;
  - junta giratoria con aro abulonado y motor;
  - bisagras en cada unión del marco;
  - cables tensores y cajas de conexión;
  - cajas de guardado de las mantas;
  - dorso de kapton.

  El giro hacia el sol se mantiene.
- **Radiadores:** marcos, cantos, bisagras entre hojas, colector de fluido y luz ámbar en cada conector.
- **Antenas:**
  - platos más finos, con aro de borde y nervios en el dorso;
  - bocina de alimentación y subreflector;
  - horquilla de elevación y guía de ondas.
- **Cámaras:** tres, con base de giro, carcasa, parasol, lente de vidrio y luz roja.
- **Otros:**
  - domos de sensores;
  - toberas en los motores del carguero;
  - puerto de acople en la proa;
  - baliza ámbar;
  - pie en cada apoyo de los pasamanos.

**Materiales.** Un solo shader con un tipo por vértice:

- **Manta (MLI).** Costuras, acolchado cada 11 cm, tono propio por panel y manchas suaves de desgaste.
- **Metal.** Más brillo y desgaste suave.
- **Radiador.** Nervios de los tubos cada 6 cm.
- **Vidrio.** Brillo más concentrado y un reflejo del azul de la Tierra en el borde.
- **Celdas solares.** Barras colectoras plateadas y leve variación de tono entre celdas.
- **Señales.** Muestreadas del atlas.
- **Luces fijas y balizas.** La baliza tiene un pulso suave, sin destellos on/off.

Los patrones son procedurales y se calculan sobre coordenadas fijas a la pieza, no a la cámara. Sus bordes se suavizan según el tamaño del píxel (`fwidth`) y se funden a su color promedio cuando quedan más chicos que un píxel. La luz es la misma de antes: sol más resplandor de la Tierra, especular ancho y débil.

**Señalética.** Un atlas de 2048 × 1024 dibujado una vez en un canvas, con mipmaps y filtrado anisotrópico. Incluye:

- **Identidad:**
  - el nombre ARTIGAS-1 con la bandera y el Sol de Mayo, en una placa elevada sobre Rivera;
  - el nombre y el código de cada módulo (TCB-01, NMV-00, RIV-02, COL-03, CRG-04), en el centro de un tramo para no pisar los aros;
  - la bandera en el carguero.
- **Esclusa:** «ESCLUSA EV-1».
- **Advertencias:** radiofrecuencia en la base de la antena, amoníaco en el radiador y «NO PISAR» en la viga.
- **Ubicación:**
  - anclajes numerados A1–A6 con argolla;
  - el blanco del accesorio de captura;
  - la marca del ala solar.

## 3. Guantes

**Modelo.** `guante.py` arma el guante en Blender a partir de la misma cinemática que usa el recorrido (largos, bases y radios de cada dedo):

- dedos con modificador Skin;
- pulgar de tres segmentos;
- palma redondeada con eminencias tenar e hipotenar;
- muñeca integrada, placa de nudillos, almohadillas en las falanges y puño.

Después se unen, se rehace la malla en vóxeles de 1,4 mm, se suaviza y se reduce a 4.200 vértices (8.400 triángulos).

**Materiales por zona** (atributo de vértice, sin texturas):

- tela técnica blanca;
- goma en la palma;
- yemas;
- refuerzos de nudillos con algo de metal;
- puño.

Tienen además costuras oscurecidas en los bordes entre zonas y a los lados de los dedos, rugosidad distinta por zona y un tramado de tela que se apaga a la distancia. El guante presurizado de la caminata es la misma malla inflada 2,2 mm.

**Deformación.** La malla tiene piel con 16 huesos: palma, 12 falanges y 3 del pulgar. Cada hueso copia la matriz de una pieza de la cinemática de siempre. Por eso las poses son las mismas que antes:

- abierta, relajada, puño, señalar y pistola;
- las de agarre de cada herramienta;
- la nueva de la tablet.

Los puntos de agarre de las herramientas tampoco cambian. Las poses ya eran progresivas, porque siguen el valor analógico del grip y del gatillo con suavizado.

Los pesos se calculan por cadena (cada dedo con su tramo de palma), con transiciones suaves de ±4 a ±9 mm en cada articulación. Además:

- vuelven de a poco a la palma lejos de los dedos;
- se mezclan entre dedos vecinos en la membrana.

Con los pesos anteriores, de corte duro, un triángulo llegaba a estirarse 11,8 veces en el puño. Con estos, el peor estiramiento local es 5,5 veces, en el pliegue de la palma al cerrar el puño, y en las poses abierta y relajada es 1,5–1,7 veces.

**Respaldo.** Si `guante.bin` no carga, se ven las manos de cápsulas de antes.

## Optimizaciones para Quest 2

- **Exterior.** 7 mallas en total: dibujado, gasta de 2 a 5 llamadas según hacia dónde se mire. No usa luces de escena ni sombras. Se dibuja solo en la caminata y desde la Cúpula. Los 34.072 triángulos están dentro de lo razonable para el Quest 2, pero no se midió en el visor.
- **Guante.** Una llamada por mano visible: 8.400 triángulos y 16 huesos, sin texturas. La mano que no está conectada esconde su guante. Las cápsulas de las manos se apagan (matriz en cero) cuando el guante está cargado; puño, brazos y cuerpo siguen en su malla instanciada de una llamada.
- **Tablet.** Dos llamadas mientras está abierta y ninguna guardada. El panel se redibuja solo cuando cambia.
- **Atlas.** Una sola textura para todas las señales del exterior: unos 11 MB de memoria de GPU con los mipmaps. Si hiciera falta, se puede bajar a 2048 × 512 reacomodando las señales.

Los 72 fps son el objetivo y **no se midieron**: todas las pruebas corren en Chrome sin GPU (SwiftShader).

## Implementado y probado

Las pruebas corren en esta PC, con Chrome sin GPU y los controles simulados:

- `juego.py`: **204 de 204** (antes 188). Las nuevas cubren:
  - **Tablet en la mano:**
    - aparece en la mano al apretar el gatillo, a menos de 25 cm del control y a 47 cm de los ojos;
    - mira a los ojos (coseno 1,0) y mide 33,5 × 22,7 × 2,3 cm;
    - sigue al control en el mismo cuadro (menos de 2 mm) y mantiene la misma pose al girar la muñeca;
    - con la tablet, la mano izquierda queda ocupada y no apunta;
    - se guarda al soltar el gatillo y la mano queda libre;
    - al trasladarse, no se reabre sola con el gatillo todavía apretado.
  - **Mapa flotante de respaldo:** delante y mirando al usuario.
  - **Guante:**
    - carga, con 16 huesos y una llamada por mano;
    - huesos alineados con la cinemática (0,0007 mm);
    - cinco zonas de material;
    - deformación medida en cinco poses: estiramiento máximo 5,5, ningún vértice a más de 16 cm de la palma.
  - **Exterior:**
    - presupuesto de triángulos;
    - los nueve tipos de material presentes;
    - atlas con mipmaps;
    - seis anclajes numerados;
    - alas con detalle.

  Las pruebas anteriores del mapa se adaptaron a sostenerlo con el gatillo. El inicio del inventario desde el mapa usa el mapa flotante, porque la mano derecha lleva la pistola lectora.
- `fisica.py`: **41 de 41**.
- `vision.py`: **11 de 11**, con los dos ojos por separado. Incluye:
  - sin parpadeos en 4 s de caminata (peor cuadro: 3 píxeles);
  - 6 cm de movimiento de cabeza mirando el reflejo del sol cambian el brillo 0,1/255;
  - el especular suma 4/255 al mismo casco visto de costado.

  Una aclaración sobre esta prueba: antes medía en z = 3,6 m, que ahora cae sobre un aro abulonado. Ahí el paralaje de los bulones movía la muestra 18/255 aunque la luz no cambiaba. Por eso se movió al centro de un tramo y ahora mide la parte especular directamente, comparando con el mismo punto visto de costado.
- `npm test` (85), `npm run lint` y el build del sitio estático: en verde.
- Revisión visual con capturas de la compu: nueve vistas del exterior, el guante aislado en tres poses y desde tres lados, y la tablet en tres posturas de brazo.

## Implementado sin probar en el visor

- Fps reales en el Quest 2 durante la caminata, con el exterior nuevo y los guantes.
- Cómo se siente sostener la tablet: peso visual, ángulo con muñecas reales, cansancio del brazo.
- Que la tablet no atraviese los dedos ni el antebrazo en todas las posturas. Está ubicada en la palma y la pose de la mano la rodea, pero el cruce entre la malla del guante y la tablet no se midió numéricamente.
- Legibilidad de la pantalla de 30 cm a 45 cm, con la resolución del Quest 2.
- Aliasing de las costuras y de los bulones a la distancia con el MSAA del visor (en la compu se ven estables).

## Limitaciones conocidas

- El guante se ve algo hinchado en el pliegue de la palma al cerrar el puño: es un límite de la piel lineal. Se puede mejorar con huesos de ayuda en los nudillos o con formas correctivas.
- Las manchas oscuras de las costuras en el dorso de los dedos pueden verse sucias de cerca; se ajusta desde `ZONAS_GUANTE` y `guante.py`.
- Con una herramienta en la mano derecha, la tablet en la mano izquierda no tiene con qué tocarse: para eso queda el mapa flotante.
