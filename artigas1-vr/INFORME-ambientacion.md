# Artigas-1 · Informe de la segunda iteración: Tierra al atardecer e interior habitado (12/11/2026)

Alcance: el recorrido WebXR del portal (`web-dashboard/public/artigas1/`) y el kit 3D de Blender. El proyecto Unity recibe los modelos, las texturas y un componente nuevo, pero sigue sin compilarse.

**Cómo leer «verificado»:** pruebas automáticas y capturas en Chrome sin interfaz, en una PC sin GPU. **Nada se midió en un Quest 2.** Los 72 fps siguen siendo un objetivo.

## 1. Auditoría

| Defecto | Causa encontrada |
|---|---|
| Sombra «hexagonal» en la Tierra | La Tierra era un casquete con triángulos de unos 65 m, visto desde 63 m. La normal, el terminador y la bruma se interpolaban entre vértices: con triángulos más grandes que la distancia a la cámara, el borde de la sombra seguía las aristas de la malla. No era una sombra proyectada ni una escala no uniforme. |
| Silueta facetada | La misma malla: el limbo era el borde de los triángulos. |
| Uruguay genérico | La textura salía de una máscara de costas de baja resolución: no tenía ríos interiores ni embalses, y la Laguna Merín era una mancha. |
| Sin ciudades | No había mapa nocturno. |
| Interior de maqueta | Las paredes solo tenían placas y barandas. Los mamparos de Tacuarembó, Nodo y Colonia y la bodega del carguero eran los más vacíos. No había nada suelto. |

## 2. Correcciones

**Tierra** (`js/entorno.js`)
- La malla ya no define la forma. Es un casquete liviano que solo marca qué píxeles calcular; en cada píxel el shader cruza el rayo de la cámara con una **esfera matemática**. La silueta es un círculo exacto con el borde suavizado, y la normal y el terminador se calculan por píxel, así que la línea día/noche sigue la curvatura real.
- La atmósfera sale del mismo rayo: azul de día, franja anaranjada en el terminador y resplandor hacia el sol. No hay segunda esfera transparente.
- Tierra y atmósfera: **1 llamada de dibujo**. Sin sombras proyectadas.

**Atardecer**
- Sol 2,5° bajo el horizonte del Río de la Plata, hacia el oeste-suroeste (atardecer de noviembre). Desde 400 km la estación todavía lo ve, sobre el limbo.
- El oeste queda de día, con luz cálida; el nadir, en crepúsculo; el este, de noche. El agua refleja el cielo en el crepúsculo, por eso los ríos y embalses se destacan.
- La luz que entra a la Cúpula tiene la misma dirección y el mismo color.
- Estrellas: 4.200 puntos de 1 a 2,6 píxeles a 2.300 m, un tercio en una banda tipo Vía Láctea. 1 llamada de dibujo.
- El terreno deriva 0,3° por minuto y se detiene a los 6°, para que Uruguay no se vaya de la vista.

**Interior** (`Blender/ambientacion.py`, nuevo)
- Cables y mangueras sobre las paredes con abrazaderas, bandejas portacables con cajas de paso, pasamuros entre módulos, tomas, ductos de ventilación. Cada cable sale de un equipo y termina en otro o en una bandeja.
- Paneles de control con interruptores, pulsadores, selectores e indicadores; cajas eléctricas, módulos de comunicación, consolas, medidores, laptops.
- Nueve pantallas con datos de la estación: PRESIÓN INTERNA, ESTADO ELÉCTRICO, OXÍGENO, TEMPERATURA, INVENTARIO, CARGA, ESTADO DE MÓDULOS, COMUNICACIONES, CONTROL AMBIENTAL. Son imagen fija, sin interacción.
- Almacenamiento: bolsas de pared, redes elásticas con bultos adentro, bolsillos modulares.
- Estructura: rejillas, paneles desmontables con tornillos, costillas, mecanismos de escotilla con válvula, extintores.
- Cada módulo tiene un armado propio (`tacuarembo`, `nodo`, `rivera`, `colonia`); las piezas son funciones reutilizables.

## 3. Geografía y luces urbanas

Las texturas se generan con `Blender/tierra.py` a partir de datos abiertos. **Nada se dibuja a mano:** si un río no está en los datos, no aparece.

| Capa | Fuente |
|---|---|
| Costas, lagos y embalses | GSHHG, resolución completa |
| Ríos | WDBII; nombres y jerarquía de Natural Earth 1:10m |
| Color del terreno y del agua | NASA Blue Marble Next Generation |
| Manchas urbanas, localidades y rutas | Natural Earth 1:10m |

- Proyección azimutal de Lambert centrada en el nadir (35,2° S, 55,9° O). El shader la invierte sin trigonometría por píxel.
- Dos capas: **base**, 30° alrededor del nadir, y **detalle**, 5,5° (unos 610 km) a 0,6 km por píxel, que cubre Uruguay entero, Buenos Aires y la Laguna Merín.
- **Río Negro:** sale del trazado de WDBII con su ancho real (0,55 km) y los embalses de GSHHG (Rincón del Bonete, Baygorria, Palmar) como polígonos; desemboca en el Uruguay cerca de Mercedes. A 0,6 km por píxel el cauce ocupa cerca de un píxel: lo que se reconoce desde la Cúpula son los embalses y la franja de monte ribereño.
- En la vista de control se marcaron Montevideo, Buenos Aires, Rivera, Salto, Paso de los Toros, Mercedes, Punta del Este, Rosario y Porto Alegre: caen donde corresponde y el este queda a la derecha con el norte arriba.
- **Luces:** la forma es la mancha urbana real de Natural Earth; la intensidad sube hacia el centro según la población; un ruido de 1,6 km y otro de 9 km dan barrios y zonas; las rutas cerca de las ciudades se encienden a manchones (corredores); las localidades chicas son puntos tenues; el campo queda oscuro.
- Las luces usan las mismas coordenadas que el terreno, así que no se desplazan ni parpadean. Se encienden de forma gradual cuando el sol baja de 2° sobre el horizonte local a 5° por debajo.
- Canales de la textura de noche: rojo, luces; verde, máscara de agua.

## 4. Objetos flotantes (`js/flotantes.js`)

29 objetos de 16 tipos (guantes, portapapeles, lapiceras, paquetes, manuales, linternas, cinta, tableta, escáner, llave, destornillador y otros), repartidos: 7 en Tacuarembó, 5 en el Nodo, 6 en Rivera, 9 entre Colonia y el carguero, 2 en la Cúpula.

- Sin motor de física. Cada objeto es una esfera con posición, velocidad y giro propios.
- Arrancan a 1,2 cm/s con giro de 0,06 a 0,32 rad/s. Un arrastre mínimo y una brisa errática de ventilación evitan que queden clavados como una foto.
- Rebotan contra la estación con el mismo sistema de colisiones del astronauta (restitución 0,5).
- El cuerpo y las manos los empujan. Con el grip cerrado se toman, y al soltar salen con la velocidad de la mano. Con un objeto en la mano no se agarra una baranda con esa mano.
- No tapan el paso: la ventilación los aparta de un cilindro de 0,42 m alrededor del eje de cada módulo, y una «correa» blanda los devuelve si se alejan más de 0,45 m de su zona. Un objeto lanzado queda libre hasta frenarse.
- Los que están a más de 7 m de la cabeza no se calculan ni se dibujan.
- Asegurado y suelto se distinguen a la vista: lo asegurado lleva correa, red o bolsillo y está contra la pared; lo suelto gira despegado.

## 5. Archivos

| Ruta | Cambio |
|---|---|
| `web-dashboard/public/artigas1/js/entorno.js` | Reescrito: Tierra por píxel, atardecer, luces, estrellas, sol |
| `…/js/flotantes.js` | Nuevo |
| `…/js/estacion.js`, `locomocion.js`, `manos.js`, `materiales.js`, `recorrido.js` | Ambientación, bultos con colisión, agarre de objetos, material de pantallas, luz de atardecer |
| `…/tierra_base_dia.webp`, `tierra_base_noche.webp`, `tierra_detalle_dia.webp`, `tierra_detalle_noche.webp` | Nuevas (2048², la base de noche 1024²; 560 kB en total) |
| `…/estacion.glb` | Regenerado; se borró `tierra.glb` |
| `web-dashboard/src/artigas1/flotantes.test.js` | Nuevo: 8 pruebas |
| `artigas1-vr/Tools/pruebas-web/fisica.py` | +15 pruebas (flotantes y Tierra) |
| `artigas1-vr/Blender/ambientacion.py` | Nuevo: equipamiento, pantallas, flotantes |
| `artigas1-vr/Blender/tierra.py` | Reescrito: geografía y luces desde datos abiertos |
| `artigas1-vr/Blender/cupula.py`, `kitlib.py`, `run_all2.py`, `export_web.py`, `export_all2.py` | Casquetes con UV de Lambert, colores nuevos, exportación |
| `artigas1-vr/Assets/Artigas1/Modelos/Ambientacion/` | Nuevo: un FBX por módulo y los flotantes sueltos |
| `artigas1-vr/Assets/Artigas1/Texturas/T_Tierra_*`, `T_Artigas_Sistemas.png` | Nuevas; se borraron las tres texturas viejas de la Tierra |
| `artigas1-vr/Assets/…/Runtime/ObjetoFlotante.cs` | Nuevo |
| `artigas1-vr/Assets/…/Editor/ArtigasMenu.cs` | Materiales de la Tierra con emisión; instancia la ambientación |

## 6. Optimización

| Llamadas de dibujo (Chrome, 1280×720) | Antes | Ahora |
|---|---|---|
| Tacuarembó | 30 | 45 |
| Nodo | 23 | 26 |
| Cúpula | 19 | 22 |
| Rivera | 18 | 26 |
| Colonia | 12 | 19 |
| Carguero | 10 | 11 |

- Triángulos en la peor vista: de 101.000 a 129.000.
- El equipamiento fijo de cada módulo es **una malla** con la paleta del kit: se fusiona con el resto del módulo y no suma llamadas. Las pantallas de cada módulo son otra malla con un atlas de 1024².
- Lo que suma llamadas son los flotantes: una por objeto visible. Con 29 objetos no justificaba instanciar; es lo primero a agrupar si hace falta.
- Cables: tubos de 5 lados con codos redondeados, sin tapas donde no se ven.
- Flotantes: 0,05 ms por cuadro con los 29 activos, en esta PC.
- Tierra: 4 lecturas de textura por píxel y ninguna geometría pesada (casquete de 72×18).
- Sin luces nuevas: pantallas e indicadores son emisivos.
- **No hecho:** iluminación horneada, LOD, texturas comprimidas para GPU (KTX2; hoy son WebP, que pesan poco al bajar pero se descomprimen en memoria: unos 75 MB entre las cuatro de la Tierra con mipmaps). Es lo primero a revisar si el Quest 2 se queda corto de memoria.

## 7. Ejecución y verificación

- Compu: `cd web-dashboard && npm run dev`, abrir `/artigas1/`. Quest 2: el portal en el navegador del visor, «Enter VR».
- Los objetos sueltos se toman con el grip, igual que las barandas.
- Pruebas: `cd web-dashboard && npm test` (70, de las cuales 18 son de física y flotantes) y `python3 artigas1-vr/Tools/pruebas-web/fisica.py` (41) con el sitio servido en el puerto 8765.
- Regenerar: `pip install basemap basemap-data-hires global-land-mask scipy`, después `tierra.py`, `run_all2.py`, `export_web.py`, `export_all2.py` (ver `Blender/README.md`). Los datos de Natural Earth se bajan solos a `Blender/geo/`, que no se sube.

## 8. Criterios de aceptación

V = implementado y verificado en navegador. H = implementado, sin verificar en hardware. P = pendiente.

| Criterio | Estado | Nota |
|---|---|---|
| Silueta esférica | V | Círculo calculado por píxel |
| Sombra sin bordes rectos | V | Captura; el terminador ya no depende de la malla |
| Terminador curvo | V | |
| Halo atmosférico | V | Captura del limbo |
| Uruguay reconocible | V | Vista de control con ciudades marcadas |
| Río Negro visible y bien ubicado | V en la textura, H en el visor | Embalses claros; el cauce mide un píxel. Hay que ver cuánto se distingue con la resolución del Quest 2 |
| Río Uruguay | V | |
| Río de la Plata | V | |
| Mancha urbana de Buenos Aires | V | La más grande e intensa |
| Montevideo y Canelones | V | Montevideo, Ciudad de la Costa y el corredor hacia el este; las localidades de Canelones son puntos tenues, según los datos |
| Luces según la geografía | V | Manchas de Natural Earth |
| Transición día/noche | V | |
| Luces en el lado nocturno | V | Encendido gradual |
| Tonos cálidos y azules | V | |
| Sol coherente | V | Misma dirección en Tierra, atmósfera, disco y Cúpula |
| Cables y conexiones | V | |
| Paneles de control | V | Sin interacción |
| Objetos flotantes | V | 29 |
| Redes, correas y compartimentos | V | |
| Más detalle estructural | V | |
| Flotantes respetan la microgravedad | V en pruebas, H con controles | Deriva, rebote, empuje y agarre probados con manos simuladas |
| Distribución funcional | H | El eje de paso queda libre (probado); el juicio visual hay que hacerlo en el visor |
| Optimizaciones anteriores conservadas | V | Las 26 pruebas anteriores siguen en verde |
| Sin dependencias nuevas en ejecución | V | Las de Python son solo para generar texturas |
| Geometrías y texturas nuevas optimizadas | H | Ver sección 6; la memoria de texturas no se midió |
| 72 fps en Quest 2 | H | **No medido.** Tacuarembó pasó de 30 a 45 llamadas |

**Unity:** la Tierra usa dos casquetes con la textura de día y las luces como emisión, iluminados por la luz direccional del sol. **No tiene el cálculo por píxel de la versión web**, así que ahí la silueta sigue dependiendo de la malla (64×128 segmentos, más fina que antes). `ObjetoFlotante` usa la física de Unity sin gravedad. Todo pasó solo un chequeo de sintaxis: estado H.
