# Registro de cambios

Todos los cambios relevantes de Cantoral se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).

Secciones posibles: `Añadido`, `Cambiado`, `Obsoleto`, `Eliminado`, `Corregido`, `Seguridad`.

## [Sin publicar]

## [0.3.0] - 2026-09-23

**El rediseño, y una app que proyecta el culto entero.** Cantoral estrena piel
de punta a punta, suena todo por dentro —sin pasarle nada a otro programa— y
saca el culto por el proyector en su propia ventana: video, letra y portada,
pasando sola de un elemento al siguiente. Los cultos pasan a ser listas
preparadas, sin fecha, y la app se aligera de lo que nadie terminaba de llenar:
las etiquetas y el tono.

**Lo escrito no se borra.** Las etiquetas, los tonos y las fechas que hubiera
en tu base se quedan donde están; esta versión deja de leerlos.

### Añadido

- **La proyección sale por su propia ventana.** Primera parte de la etapa 7.
  Una ventana aparte a pantalla completa en la pantalla que elijas: negra, sin
  controles, sin barra de título y sin cursor. No muestra nada de la ventana
  donde trabajas, que es justo lo que se le pide a una pantalla que cuelga
  delante de una congregación.

  Por defecto sale por la pantalla que **no** es la del operador. Si se
  equivocara en eso, lo primero que vería la iglesia un domingo sería el
  escritorio de quien opera.

  Se llega desde «Proyectar», en la fila de acciones del culto abierto: se
  proyecta el culto que quien opera acaba de repasar.

  La ventana se crea desde el núcleo, no desde la interfaz: hacerlo desde el
  webview obligaría a darle permiso de crear ventanas, y con él el de fabricar
  cualquier otra. Y la de proyección tiene su propio archivo de permisos, con
  mucho menos que la principal — solo escucha eventos: no abre diálogos, no
  abre URLs, no toca ventanas y no habla con la base de datos.

  Todavía no reproduce video: eso es lo siguiente. Esta parte es la ventana,
  elegir pantalla y sacarla en negro o con un título.

- **La proyección reproduce el culto.** Segunda parte de la etapa 7. La cola
  del culto abierto está a la izquierda de la pantalla de Proyección: pulsa un
  elemento para sacarlo, «Siguiente» para pasar al de después y «Pantalla en
  negro» para cortar la imagen sin perder el sitio. Con teclado, `→` y `B`; y
  `Esc` corta la salida entera.

  **El siguiente va cargado y en pausa.** Mientras suena uno, el que viene
  detrás ya se está leyendo del disco en un segundo reproductor que no se ve.
  Pasar de uno a otro es enseñarlo y darle al play, sin el negro que tardaría
  el disco en responder — que en un pendrive, que es de donde sale la música en
  muchas iglesias, son varios segundos delante de la congregación.

  **Lo que sigue en pantalla es lo que se empezó.** Abrir otro culto a mitad
  para buscar algo no cambia lo que está en el aire ni a dónde va «Siguiente».

  **Una pista que no se pueda reproducir sale como su título sobre el negro**,
  no como un negro a secas: esa canción se canta igual. El motivo —falta el
  archivo, no está indexado, o el formato no lo entiende ningún reproductor— se
  queda en la ventana de mandos, marcado en su fila de la cola. A la
  congregación no le importa que falte un archivo.

  Se avisa de `.mkv`, `.avi`, `.wmv` y `.wma` antes de intentarlo, porque no
  los decodifica ningún motor. De `.mov`, `.ogg`, `.opus` o `.aiff` no se
  avisa: dependen del sistema, y decir que no sirven donde sí sirven sería
  peor. Si alguno falla de verdad, el fallo aparece en la cola con lo que dijo
  el reproductor.

  **Cuando un elemento se acaba, el proyector se pone en negro** y ahí se
  queda. No pasa solo al siguiente: un video se termina mientras alguien está
  hablando, y arrancar la canción de después por su cuenta delante de la
  congregación no lo puede decidir la app. Lo siguiente queda cargado y en
  pausa, a un botón de distancia.

  Debajo del título, el tiempo real de lo que está sonando: lo cuenta la
  ventana de salida y se lo devuelve a la de mandos.

- **Todo se reproduce dentro de Cantoral.** El video se ve en el panel de
  detalle mientras preparas el domingo, y por el proyector desde Proyección. Al
  llegar a un video —dándole a reproducir o porque le tocó en la cola del
  culto— el panel se abre solo, que es donde está la única pantalla de video de
  esa ventana.

  Y proyectar calla el reproductor del portátil: hay una sola salida de audio, y
  dos cosas a la vez por los altavoces del culto no las quiere nadie.

- **Proyectar un culto entero sin nadie al ratón.** Al acabarse un elemento, la
  proyección pasa sola al siguiente: un culto es una lista que se le da y corre
  entera. Viene así de fábrica; en Proyección, «Cuando un elemento se acaba»,
  está *Negro y esperar* para quien prefiera parar entre uno y otro.

  El avance automático lleva la transición que tengas puesta, igual que pulsar
  «Siguiente» a mano. Al final del culto no avanza: no hay adónde, y que la
  última canción arranque otra vez sola delante de todos es lo que no puede
  pasar. Recorrer la letra sigue siendo manual — nadie sabe a qué velocidad
  canta la congregación.

- **La biblioteca tiene dos densidades.** Un par de botones en la fila de
  herramientas: «cómoda», que es la de siempre, y «compacta», que baja la fila
  de 56 a 34 px y casi duplica cuántas pistas caben en pantalla. Son dos
  situaciones distintas y no un gradiente: preparar el culto el jueves con
  sitio para respirar, y sostener el atril el domingo sin tener que
  desplazarse a media alabanza. Se elige una vez y se recuerda.

  En la fila compacta el título y el artista comparten línea, con el título
  quedándose el espacio: recortar «Cristo Ya Resucit…» para que quepa entero
  «Voces de Gracia» es al revés. Y si la fila lleva aviso —sin archivo, video—
  el artista se va del todo: que falte el archivo importa más que quién la
  canta.

- **Los grupos se pliegan.** Un clic en el encabezado esconde su contenido y
  deja el encabezado, que sigue diciendo cuántas pistas tiene. Es para el
  minuto en que estás armando un culto con una carpeta y las otras tres
  estorban, así que vive en la sesión: la próxima vez que abras Cantoral está
  todo desplegado otra vez. Cambiar el eje de agrupación también lo olvida.

- **La letra por el proyector.** Tercera y última parte de la etapa 7. Con una
  pista de solo audio, la pantalla grande deja de enseñar el título y pasa a
  enseñar lo que la congregación está cantando, una estrofa cada vez.

  Se elige en Proyección, en **«Si la pista es solo audio»**: *Solo la letra*
  sobre el negro, *Portada y letra* con la carátula de fondo —apagada y
  desenfocada, para que la letra se lea encima—, o *Negro* si lo que se quiere
  mientras suena la ofrenda es una pantalla apagada. Se recuerda entre
  sesiones: una iglesia lo elige una vez, no cada domingo antes de empezar.

  La letra se parte donde ya la partió quien escribió la hoja: por las líneas
  en blanco y por los encabezados de sección (`{coro}`), que además salen
  rotulados en la pantalla. Una estrofa muy larga se parte en trozos de ocho
  líneas — una hoja escrita de corrido saldría entera en un tamaño que no se
  lee desde la última fila. Los acordes no salen: por el proyector va la letra,
  y los acordes son para el atril.

  **«Siguiente» recorre la letra antes de cambiar de canción**, con el mismo
  botón y la misma tecla `→`. Desde el atril no se quiere elegir entre dos
  cosas: se quiere pasar a lo que viene, sea la estrofa de abajo o la canción
  de después. Los mandos dicen por cuál se va y a cuál se pasa.

- **Qué pasa entre un elemento y el siguiente.** También en Proyección, en
  **«Entre un elemento y otro»**: medio segundo de negro, o una cuenta atrás de
  tres segundos en la pantalla grande. La lleva la ventana de salida, que es la
  que tiene el fotograma delante, y mientras corre no se ve ni lo que se va ni
  lo que viene. Pasar de estrofa o cortar a negro no la llevan: serían medio
  segundo de negro en mitad de una canción.

- **El artista se puede corregir.** En el panel de detalle, junto a la
  ocasión. En una biblioteca de iglesia media viene mal en las etiquetas del
  archivo —«Track 03», «Unknown Artist»— y hasta ahora se leía y no había
  dónde arreglarlo sin tocar el MP3.

  La corrección **sobrevive a los escaneos**: la pista queda marcada y el
  escáner deja de pisarle el artista con lo que diga el archivo. Sin eso se
  arreglaría el domingo y estaría mal otra vez el jueves.

- **Fijar el panel de detalle.** Fijado, `Esc` deja de cerrarlo. Repasando
  pista por pista, que se cierre al pulsar Esc para salir de un campo es perder
  el sitio.

### Cambiado

- **Logo nuevo.** Un libro abierto: la página izquierda con una corchea calada
  y la derecha con cuatro líneas de letra, en el índigo de la app. Está en el
  icono de la app de macOS y de Windows, en la barra de título —símbolo y
  nombre en Bricolage Grotesque—, en el pie de Configuración, en el favicon y
  en el banner del README.

  El icono de macOS lleva el margen de la plantilla de Apple, y los tamaños
  chicos usan las versiones simplificadas del manual: tres líneas a 32 y 48 px,
  dos y sin nota a 16 y 24, donde la corchea sería una mancha. En modo oscuro
  el símbolo pasa al gris frío claro de la marca.

- **Los cultos ya no tienen fecha.** Un culto es una lista preparada: se arma
  una vez, se le da a proyectar y corre entero. La fecha lo convertía en otra
  cosa —un evento del calendario— y era lo que decidía el orden, las secciones
  «Próximos», «Anteriores» y «Sin fecha», y qué culto era «el anterior».

  Ahora sale arriba **el último que abriste o cambiaste**: abrirlo, agregarle
  pistas, reordenarlo o cambiarle el nombre lo sube. Lo que se está preparando
  queda arriba sin que nadie escriba nada para decirlo. El mismo orden en la
  barra lateral, en la vista de listas y en «Agregar a un culto».

  Fuera el campo de fecha del diálogo, la fecha de la cabecera del culto, la
  de la hoja imprimible y la del formato compartido. Un `.cantoral.json`
  exportado con fecha se sigue abriendo; la fecha se ignora.

  **Lo escrito no se borra**: la columna `fecha` se queda en las bases que ya
  la tengan. La primera vez que abras con esta versión, los cultos salen del
  más nuevo al más viejo según se crearon.

- **La fila de filtros se recorre con el ratón, sin barra.** La barra
  horizontal que salía debajo de los chips se comía tres píxeles de la fila y
  tapaba el borde de los botones — y en Windows sale siempre, no se esconde
  sola como en macOS, así que era una raya gris permanente cruzando la
  interfaz.

  Ahora la fila se recorre girando la rueda encima o arrastrándola. Un clic
  sigue siendo un clic: hasta que el ratón no se mueve cuatro píxeles no cuenta
  como arrastre, y el clic que viene detrás de un arrastre no filtra por el
  chip que quedara debajo al soltar.

- **La biblioteca dice cómo se llama y cuánto estás viendo.** Era la única
  vista sin título: su sitio en la barra lo ocupa el buscador. Pero es donde
  más falta hacía, porque «Biblioteca», «Favoritas» y «Archivos faltantes» son
  la misma tabla filtrada y desde la tabla no se distinguen — la única pista
  era cuál de los botones de la barra lateral estaba encendido.

  Debajo, el recuento: «4 de 19 pistas · agrupadas por carpeta». El «19
  canciones» de antes no decía si eran todas o si un filtro se estaba comiendo
  la mitad. Y en «Archivos faltantes» no va un número sino qué hacer con ellos,
  que es a lo que se entra ahí.

- **El aviso de la esquina dice dos cosas.** Pasa de una píldora centrada con
  una línea a una tarjeta abajo a la derecha con **titular y detalle**, y con
  una ✕ para quitarla.

  Antes, como solo cabía una línea, los avisos metían dos cosas dentro: «3
  pistas agregadas a "Domingo de alabanza"». Ahora el titular dice **a dónde
  fueron** y el detalle **cuántas**, y se lee de un vistazo.

  Lo mismo con el escaneo, la importación de una lista, quitar pistas, fusionar
  duplicadas, reapuntar una carpeta y localizar una pista perdida: el titular
  es lo que pasó y debajo va lo que significa —«Los archivos siguen en el
  disco», «Conserva su favorito y su sitio en los cultos»—. Los avisos que solo dicen
  una cosa se quedan con el titular: no se les inventa un detalle.

  Y la píldora se cruzaba por delante de la barra del reproductor; la tarjeta
  se aparta y, si estorba, se cierra.

- **El menú contextual dice sobre qué pista se abrió**, y ofrece tres cosas
  más: **Ver el detalle**, **Letra y acordes** y **Mostrar en el Finder**. Con
  el menú abierto encima de una tabla de veinte filas, lo primero que hay que
  poder comprobar es cuál se pulsó. Se van los iconos: seis dibujos en columna
  a la izquierda de seis palabras no añadían nada y le daban al menú el ancho
  de un panel.

  Con varias pistas elegidas solo salen las que tienen sentido en plural: «ver
  el detalle» de doce pistas no quiere decir nada.

  Y se van las dos de favoritas: el corazón está en cada fila y en la barra de
  selección, que es la que sale al elegir varias. Una tercera puerta a lo mismo
  solo alargaba el menú.

- **Quitar pistas dice de qué cultos se van, por su nombre.** Antes decía
  cuántas estaban en alguna lista. Un número no deja decidir: quitar una pista
  del culto del domingo que viene no es lo mismo que quitarla de una plantilla
  de hace un año.

  Y lo que **no** pasa —«los archivos no se tocan»— pasa a su propia caja en
  vez de ir en gris pequeño al pie. Es justo lo que está buscando quien duda.

- **La vista previa de impresión, en una sola fila de acciones.** «Imprimir o
  guardar PDF» y «Cerrar» arriba, y debajo qué lleva la hoja. Antes estaba
  repartido entre una cabecera con su icono y un pie con tres botones más, y
  había que recorrer el diálogo entero para encontrar «Imprimir».


- **Configuración, en tarjetas.** Cada cosa en la suya en vez de una sucesión
  de títulos sueltos con 30 px de aire entre ellos. Se mira entera de una
  sentada —qué carpetas hay, si hay duplicadas, cuándo fue la última copia— y
  ahora entra sin tener que recorrerla.

  Los botones de cada carpeta pasan a llevar su nombre —**Reescanear**,
  **Reapuntar…**, **Quitar…**— en vez de tres iconos seguidos. «Reapuntar» no
  tiene dibujo que se entienda solo, y equivocarse de botón ahí quita una
  carpeta.

  Y debajo de cada ruta se dice **cuántos archivos no se encuentran en esa
  carpeta**. El total estaba en la barra lateral, pero cuando un disco externo
  se queda sin enchufar lo que hace falta saber es *qué* carpeta se ha quedado
  a oscuras.


- **La barra del reproductor baja de 88 px a 60.** Es la medida del rediseño, y
  el sitio que suelta se lo queda la lista que tiene encima — que es donde se
  arma el culto. Entran dos filas más de biblioteca sin tocar nada.

  A la derecha dice ahora **de dónde sale lo que suena**: «Cola: culto» o
  «Cola: biblioteca». Poner una canción suelta en mitad de un culto deja el
  transporte siguiendo la biblioteca, y sin decirlo nadie se enteraba hasta que
  sonaba lo que no tocaba.

- **El panel de detalle, más apretado.** De 360 px a 300, y a 272 cuando la
  ventana se queda corta. La carátula va al lado del título en vez de encima
  —apilados se comían un tercio del panel antes del primer dato editable—, y
  «Reproducir» y «Agregar a culto…» comparten fila. El bloque del archivo deja
  de ser una ficha técnica: formato, álbum y ruta, que es lo que hace falta
  para encontrarlo; el álbum y la duración ya están en la tabla de al lado.


- **La biblioteca solo indexa lo que se puede reproducir.** Salen `.wma`,
  `.mkv`, `.avi` y `.wmv`, que no decodifica ningún motor de los que usa la
  app. Al escanear se dice cuántos archivos se quedaron fuera por eso —
  saltárselos en silencio sería peor: quien ve que faltan tres canciones no
  tendría forma de saber si es por el formato o porque el escaneo se rompió.

  `.ogg`, `.opus`, `.aiff` y `.mov` **sí** se siguen indexando aunque dependan
  del sistema. El catálogo viaja entre máquinas y una lista de formatos
  distinta en cada una haría que la misma biblioteca cambiara al pasarla del
  Mac al PC; lo que falle, falla al abrirlo y lo dice con el formato de que se
  trata.

  Lo que ya estuviera indexado se queda donde está: quitarlo sacaría pistas de
  tus cultos sin avisar. El panel de detalle marca las que no se pueden abrir,
  con el motivo.



- **Una sola forma de agregar a un culto.** Había tres, y cada una era un
  desplegable distinto: el del panel de detalle agregaba **una** pista, el de
  la barra de selección y el del menú contextual agregaban **la selección**.
  Tres implementaciones del mismo menú, dos comportamientos y ninguna forma de
  saber cuál te iba a tocar. Ahora los tres abren el mismo diálogo, que antes
  de que elijas a dónde dice cuántas pistas va a mover y en qué cultos ya
  estaban. Se abre también con la tecla `A`, que es lo que más se repite
  armando un domingo.

  De paso, agregar algo que ya estaba deja de decir «0 pistas agregadas»
  —que se lee como que algo falló— y dice que ya estaban.

- **Las pantallas de estado dicen lo que hace falta.** La biblioteca vacía
  dejaba la promesa —«sin mover ni copiar tus archivos»— al final de un párrafo
  largo. Ahora es la frase, enumerada y en negrita: **no mueve, no renombra y
  no borra ningún archivo**. Quien administra la música de una iglesia lleva
  años ordenándola a mano, y eso es lo que necesita saber antes de dejar entrar
  a un programa.

  El escaneo a pantalla completa dice «Leyendo tus carpetas» y añade que se
  puede seguir usando la app, que las pistas irán apareciendo solas. El error
  de carpeta añade que las pistas y los cultos siguen donde estaban: quien ve
  un error sobre su biblioteca asume lo peor. Y la búsqueda sin resultados dice
  **dónde** buscó —título, artista, álbum y ocasión—, que es
  la respuesta a lo que uno se pregunta al verla.

  Las marcas de arriba bajan de 96 px a 54 y pierden el relleno. Una
  ilustración ocupando el centro de la primera pantalla es decoración; lo que
  hay que leer es la frase de debajo.

- **La tarjeta de escaneo de la esquina se puede esconder.** Esconderla no
  cancela nada, y cancelar sigue teniendo su botón: son dos cosas distintas
  —seguir trabajando sin la tarjeta delante, y parar el escaneo— y un solo
  botón para las dos haría que quien quisiera lo primero perdiera el escaneo.
  Vuelve a salir en el siguiente.

- **El fondo de la ventana nativa deja la paleta vieja.** Era `#FAF7F2`, el
  papel cálido: lo que se veía un instante en cada arranque, antes de que la
  interfaz pintara. Ahora es el gris del tema claro.

- **Las tarjetas de lista llevan su inicial.** Veinte tarjetas con el mismo
  icono no se distinguen de un vistazo; la inicial del nombre sí, y la ocasión
  pasa a un sobrescrito sobre la portada en vez de una pastilla encima. La
  cabecera de una lista abierta hace lo mismo: el sobrescrito dice la ocasión
  —«Reunión juvenil»— y no «Lista para culto», que ya se sabe por estar ahí.

- **Los títulos de página usan la tipografía de títulos.** Quedaba por
  aplicarla desde la primera etapa del rediseño.

- **La barra de selección entra en la fila de herramientas.** Flotaba sobre la
  tabla, cerca del reproductor, encima justamente de las filas sobre las que
  actúa: lo último que se veía antes de pulsar «Quitar» era una barra tapando
  la prueba. Ahora ocupa la fila de herramientas mientras hay algo elegido —los
  chips y los controles de agrupación se apartan, porque con tres pistas
  elegidas lo que toca es actuar sobre ellas y no volver a filtrar—. Sus menús
  se abren hacia abajo, y «Cancelar» dice que `Esc` hace lo mismo, que ya era
  verdad y nadie tenía forma de saberlo.

- **Agrupar por carpeta usa la carpeta del disco.** Hasta ahora usaba la
  carpeta *indexada*, la raíz que alguien eligió en Configuración: las 128
  pistas de `C:\Música\Iglesia\Himnos` caían todas en un montón, aunque en el
  disco estuvieran repartidas en «Clásicos», «Coritos» y «Especiales». Ese
  reparto es trabajo que alguien ya hizo, y la app lo estaba tirando. Ahora
  cada grupo es una carpeta de verdad, con su ruta debajo del nombre para
  saber de qué «Himnos» se trata cuando hay dos discos con uno.

  No hubo que tocar el núcleo ni volver a escanear: el catálogo ya viaja con
  la ruta de cada pista y la raíz de cada carpeta, así que la resta se hace en
  la interfaz.

- **Cantoral estrena piel.** Primera etapa del rediseño: las tipografías y los
  colores. La interfaz pasa a **Public Sans**, los títulos a **Bricolage
  Grotesque**, y la paleta cálida de papel deja paso a grises fríos con acento
  índigo, en los dos temas. Las carátulas que Cantoral genera para las pistas
  sin arte incrustado dejan de ser ocho gradientes de colores distintos y pasan
  a seis tonos de la misma familia azul: en una biblioteca de iglesia casi
  ninguna pista trae carátula, y ocho colores compitiendo hacían ruido en vez
  de ayudar a distinguir. La hoja impresa y el PDF cambian con ella, para que
  lo que sale por la impresora no contradiga lo que se ve en pantalla.

  Ningún comportamiento cambia: solo el valor de los tokens, la familia
  tipográfica y los colores que estaban escritos a mano en cuatro sitios. Las
  dos familias nuevas son SIL OFL 1.1 y viajan dentro del paquete, como las
  anteriores: la CSP declara `font-src 'self'` y la app no habla con la red.

- **La barra lateral, en dos zonas.** Segunda etapa del rediseño. Arriba, a
  dónde se va, con los filtros sangrados bajo Biblioteca y las listas
  sangradas bajo Listas para cultos —la sangría dice de quién es cada fila, que
  es lo que una columna de botones iguales no podía decir—. Abajo, Configuración
  y una línea con lo que Cantoral tiene indexado.

  Las carpetas indexadas se van de la barra lateral: una carpeta se elige una
  vez, no es un sitio al que se navega, y ya se administran en Configuración,
  que es donde se agregan, se vuelven a escanear y se quitan.

  Las listas dejan de aparecer solo mientras arrastras algo y están siempre:
  un destino que aparece a mitad del arrastre es un destino al que no se puede
  apuntar. Solo aceptan lo que salió de la biblioteca, así que arrastrar una
  carpeta del escritorio hasta ahí ya no agrega lo que estuviera seleccionado.

### Eliminado

- **«Repetir el culto anterior».** Buscaba el último culto ya celebrado de cada
  ocasión, y sin fechas no hay forma de saber cuál fue. Para partir de un culto
  que ya existe quedan duplicarlo y las plantillas, que hacen lo mismo sin
  adivinar.

- **Las etiquetas.** Eran un segundo eje de clasificación encima de la ocasión:
  el campo del panel de detalle, «Etiquetar…» en la barra de selección, los
  chips de filtro de la biblioteca, la tarjeta de Configuración que las
  renombraba y unía, y las columnas por las que buscaba el buscador.

  **Lo que ya esté escrito no se borra.** Las tablas `tags` y `track_tags` se
  quedan intactas en tu `cantoral.db`; la app deja de leerlas y de escribirlas,
  nada más. Una base de datos nueva ya no las crea.

- **El tono.** El campo de la pista, la columna «Tono» de la biblioteca y del
  culto, la columna de la hoja imprimible y el tono que encabezaba cada hoja de
  acordes. Desde que dejó de editarse en el panel de detalle no había forma de
  rellenarlo —el escáner nunca lo ha escrito—, así que era una columna vacía en
  todas partes.

  La columna `tono` tampoco se toca en las bases que ya la tengan.

- **La transposición del modo culto.** Con el tono fuera, los botones `+` / `−`
  y sus atajos se quedaban sin la referencia que decidía la armadura: subir dos
  semitonos desde un tono que nadie sabe cuál es no es transponer, es adivinar.
  La hoja de acordes se sigue leyendo en el atril, con los acordes tal como los
  escribió quien la escribió.

  Con ella se van `transponerAcorde`, `transponerTono`, `transponerHoja` y
  `usaBemoles`. Lo que queda de `chords.ts` solo necesita saber **si** algo
  entre corchetes es un acorde, así que `parseAcorde` pasa a ser `esAcorde`.

- **Los comandos `tag_tracks`, `rename_tag` y `delete_tag`**, y los parámetros
  `tono` y `tags` de `update_track`. Un `.cantoral.json` compartido ya no lleva
  esos dos campos; uno exportado por una versión anterior se sigue abriendo, y
  esos campos se ignoran.

- **El botón de tema de la barra superior.** Alternaba entre claro y oscuro, y
  ahí quedaba: no podía volver a «Seguir al sistema», que es el tercer modo y
  el que viene puesto. Elegir el tema se hace en Configuración › Apariencia,
  con los tres, y es una decisión de una vez, no un botón que convenga tener
  al lado de «Agregar carpeta».

- **El desvío al reproductor del sistema.** Cantoral ya no le pasa ningún
  archivo a otro programa. Se van el botón «macOS»/«Windows» de la barra del
  reproductor, el ajuste «Abrir siempre en el reproductor del sistema» de
  Configuración, «Abrir en el sistema» del menú contextual y los botones de
  abrir fuera de la biblioteca y del panel de detalle.

  En mitad de un culto, que una pista saltara a Apple Music o al Reproductor de
  Windows significaba otra ventana encima de la proyección, otro volumen, otra
  cola — y la lista del culto quedándose atrás.

  El comando del núcleo que abría archivos se estrecha con él: ahora solo puede
  abrir la hoja que la propia app acaba de exportar para imprimir, y rechaza
  cualquier otra cosa. Un comando que puede abrir menos vale menos para lo que
  consiga llamarlo.

- **El tempo sale del panel de detalle.** El bloque «Datos del culto» queda con
  Artista y Ocasión, como el rediseño. El panel era el único sitio desde el que
  se escribía —el escáner no lo lee del archivo—, así que las pistas nuevas
  llegan sin tempo. El que ya estaba escrito se conserva y sigue saliendo en la
  hoja imprimible.

- **La baldosa de puntos «Crear nueva lista»** al final de la rejilla de
  listas. «Nueva lista» está en la cabecera y en la pantalla vacía; tres
  sitios para lo mismo es uno bueno y dos que estorban.

### Corregido

- **«Seguir al sistema» ahora sigue al sistema.** Era el modo que viene puesto
  y dentro de la app no funcionaba en todas partes: se resolvía con
  `prefers-color-scheme`, que un webview no contesta de forma fiable. En
  Windows, WebView2 lo resuelve contra el tema de la *ventana* y dice «claro»
  aunque Windows esté en oscuro, así que quien no tocaba nada se quedaba en
  claro para siempre.

  Ahora se le pregunta a la ventana nativa, que sí lo sabe, y se queda
  escuchando: cambiar el tema del sistema con Cantoral abierto lo cambia en el
  acto. Elegir Claro u Oscuro a mano sigue mandando sobre el sistema.


- **«Todas» en la barra lateral no hacía nada.** Estando ya en la biblioteca
  con un filtro puesto —Favoritas, una ocasión o una búsqueda—,
  pulsarlo no encendía el botón ni cambiaba la tabla: solo cambiaba de vista, y
  la vista ya era esa.

  Ahora suelta todo lo que estreche la biblioteca, que es lo que «todas»
  quiere decir. Y el botón se apaga mientras haya cualquier filtro puesto:
  antes se quedaba encendido con una búsqueda activa, diciendo
  que se estaban viendo todas cuando no.

  De paso, volver a la biblioteca desde un filtro ya no finge que hay contenido
  cuando no hay nada indexado: enseñaba una tabla vacía en vez de la pantalla
  que explica cómo empezar.

## [0.2.1] - 2026-09-21

**Sin cambios funcionales.** Publicada para ejercer el actualizador de punta a
punta: la 0.2.0 fue el primer release, así que no había ninguna instalación
anterior a la que ofrecerle nada, y el camino completo —detectar, descargar,
verificar la firma, reemplazar la app y reiniciar— no se puede probar con una
sola versión publicada.

## [0.2.0] - 2026-09-21

### Añadido

- **Cantoral se actualiza sola.** Hasta ahora, actualizar significaba entrar a
  GitHub, encontrar el release, descargar el instalador y ejecutarlo —y en macOS
  acordarse del `xattr`—. En un PC de iglesia compartido y sin nadie técnico
  cerca, eso quiere decir que la instalación se queda en la versión con la que
  nació y los arreglos no llegan nunca.

  Ahora **mira al abrirse, sin interrumpir**: si hay algo, aparece en
  **Configuración → Actualizaciones** con el número de versión y las novedades,
  y se instala con un botón. Si no hay nada, no dice nada — una app que
  interrumpe cada vez que se abre para decir que no pasa nada es una app que se
  aprende a ignorar. También se puede comprobar a mano cuando se quiera.

  Las actualizaciones van **firmadas con una clave propia del actualizador**,
  independiente de la firma de código de Apple y Microsoft, así que quedan
  verificadas aunque los instaladores sigan sin firmar. En macOS la app
  actualizada vuelve a quedar en cuarentena mientras no exista el certificado, y
  el aviso lo dice antes de instalar, con el comando exacto.

  Una compilación hecha sin la clave —un fork, por ejemplo— **lo dice** en vez
  de fingir que está al día.

- **Imprimir deja de pasar por el navegador.** «Exportar» escribía un `.html`
  en el disco, lo abría en el navegador predeterminado y esperaba a que alguien
  pulsara `Cmd/Ctrl + P`: el pie de la propia hoja tenía que explicarlo, y por
  el camino quedaba un archivo que nadie quería guardar.

  Ahora **«Imprimir»** abre la hoja dentro de la app, tal como va a salir, y de
  ahí va al diálogo del sistema —donde está tu impresora y también «Guardar
  como PDF»—. Se elige entre **solo el repertorio**, que es lo que lee quien
  dirige, y **con letras y acordes**, que es lo que va al atril; la elección se
  recuerda. Si ninguna pista de la lista tiene nada escrito, la segunda opción
  no se ofrece en vez de dar la misma hoja dos veces.

  **Guardar el `.html` sigue estando**, dentro de la vista previa: mandar la
  hoja por correo o WhatsApp es otro recado.

- **Una lista se puede mandar a otra instalación.** «Exportar» hacía una hoja
  para imprimir: sirve para el equipo, no para la otra copia de Cantoral. El
  director armaba el repertorio en su portátil y en el PC de la iglesia había
  que volver a armarlo pista por pista.

  Ahora el menú `⋮` de una lista tiene **«Enviar a otra instalación»**, que
  escribe un `.cantoral.json`, y «Listas para cultos» tiene **«Importar
  lista»**, que lo abre. **El archivo no lleva audio** —es justo lo que la app
  promete no mover— **ni la ruta del disco de quien exporta**: solo el nombre
  del archivo, que es lo que hace falta para volver a encontrar cada pista y no
  le cuenta a nadie cómo tiene organizada la música.

  **Importar enseña antes de hacer.** Una pantalla dice qué se encontró y qué
  no, y solo entonces se crea la lista. Lo ausente se nombra, no se cuenta: se
  puede añadir a mano, o indexar esa carpeta y volver a importar. Las pistas se
  emparejan por el nombre del archivo o por título, artista y una duración
  parecida; una versión de nueve minutos de algo que dura tres **no** entra al
  culto sin que nadie lo haya pedido.

- **Una lista se puede duplicar, y guardarse como plantilla.** Los cultos se
  repiten y cada lista se armaba desde cero. El menú `⋮` duplica la lista
  —mismo orden, misma ocasión, sin fecha, porque una copia es el culto que
  *viene*— y puede guardarla como **plantilla**, de la que «Nueva lista» parte
  con un clic. Arriba de las listas hay además un atajo para **repetir el culto
  anterior** de cada ocasión, que dice cuál copiaría y de cuándo es.

- **Armar un culto deja de ser de una pista en una.** Era la función central de
  la app y el camino más largo posible: abrir el panel de detalle, «Elegir
  lista…», la lista, repetir. Ocho canciones eran veinticuatro clics.

  Ahora se eligen varias —<kbd>Mayús</kbd> para un tramo, <kbd>⌘</kbd>/<kbd>Ctrl</kbd>
  para sumar o restar, <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>A</kbd> para todo lo que
  muestra el filtro— y sobre lo elegido se puede **agregar a una lista,
  marcar o quitar favoritas, poner o quitar una etiqueta, y quitarlas de la
  biblioteca**, todo de una vez.

  También se pueden **arrastrar a una lista**: mientras arrastras, la barra
  lateral abre sus listas como zonas donde soltar, para no tener que salir de
  la biblioteca a buscar una.

  Y el **clic derecho** por fin hace algo: la app suprimía el menú del navegador
  desde antes de que existiera uno propio.

  Agregar veinte pistas es ahora **una** ida y vuelta al núcleo en una sola
  transacción, no veinte con veinte copias enteras del catálogo. Las que ya
  estaban en la lista se saltan, así que agregar una selección que se solapa la
  completa en vez de duplicarla.

- **Las etiquetas dejan de estar a medias.** Se podían poner y ahí se acababa:
  no había forma de filtrar por ellas, ni de ver cuáles existían, ni de
  corregir una mal escrita sin abrir cada pista.

  Ahora **filtras con chips propios**, junto a los de ocasión. Elegir dos acota
  a las pistas que llevan las dos, no a las que llevan cualquiera — que es lo
  único que hace útil elegir la segunda. Antes las etiquetas solo entraban en
  la búsqueda de texto libre, donde `lento` también encontraba un álbum llamado
  «Lento».

  El campo del panel de detalle **autocompleta** con las que ya existen, sin
  ofrecer las que la pista ya lleva.

  En Configuración hay una sección **«Etiquetas»** con todas y cuántas pistas
  llevan cada una. Cambiar el nombre lo corrige en todas a la vez; ponerle el
  nombre de otra que ya existe las **une en una**, previa confirmación, porque
  eso no se deshace renombrando de vuelta.

  Y el par no llega a formarse: `tags.name` distingue mayúsculas, así que
  escribir `Lento` donde ya existe `lento` usaba dos filas que nadie veía que
  eran dos. Ahora se acopla a la que ya está y lo dice.

- **Letra y acordes por pista, con modo culto y transposición.** Cantoral ya
  sabía el tono de cada canción; lo único que no podía guardar era lo que el
  equipo necesita ver mientras toca. Eso vivía fuera de la app —un PDF suelto,
  un cuaderno, un grupo de WhatsApp—.

  Se escriben desde el panel de detalle en formato **ChordPro**
  (`[Sol]Sublime [Do]gracia`), con vista previa al lado, porque lo que importa
  es sobre qué sílaba cae cada acorde y eso el texto fuente no lo enseña.

  El **modo culto** se abre desde cualquier lista: pantalla completa, letra
  grande, los acordes encima de su sílaba, las flechas para pasar de canción y
  el tamaño de letra a gusto del atril. Arranca en la canción que esté sonando,
  si es de esa lista.

  **Transponer** sube o baja medio tono y reescribe la hoja entera, eligiendo la
  armadura del tono de destino: en un tono con bemoles verás `Lab` y no `Sol#`,
  que es la traducción que el músico tendría que hacer de cabeza. Al cambiar de
  canción se olvida, porque pertenecía a la anterior.

  La hoja imprimible lleva ahora las letras del repertorio detrás de la tabla,
  una canción por página.

  Las hojas **no viajan con el catálogo**: se piden cuando alguien va a leerlas.
  El catálogo solo lleva si una pista tiene hoja o no, para que una biblioteca
  de miles de canciones no arrastre megabytes de texto en cada refresco.

- **La interfaz recuerda cómo la dejaste.** Hasta ahora solo sobrevivían al
  cierre el tema y la preferencia de reproductor externo; el volumen volvía a
  0.72 en cada arranque, que en un ensayo significa abrir la app a todo lo que
  dé el equipo de sonido. Ahora también se guardan silencio, aleatorio,
  repetir, el orden y la agrupación de la tabla, y en qué vista —o en qué lista
  para culto— estabas.

  Va todo en una sola clave con un JSON, no una por campo, y se escribe con un
  respiro de 400 ms para que arrastrar la barra de volumen no sea una escritura
  por píxel. Al arrancar, cada campo se valida por separado: la base es un
  archivo que se pudo restaurar desde otra versión, así que lo que no se
  sostiene se descarta y esa preferencia queda en su valor por defecto en vez
  de estropear el resto. Una lista que ya no existe abre la biblioteca.

  Los filtros —búsqueda, favoritas, ocasión— **no** se guardan, a propósito.

- **Detectar y fusionar pistas duplicadas**, en Configuración. Una biblioteca de
  iglesia acumula la misma canción varias veces —el MP3 y el WAV, la que bajó
  cada quien en su carpeta— y hasta ahora Cantoral las indexaba todas por igual
  sin forma de verlo. Ahora las agrupa por dos caminos: mismo tamaño y misma
  duración (el mismo archivo en dos sitios) y mismo título y artista con
  duración parecida (la misma canción en formatos distintos), comparando sin
  acentos, sin mayúsculas y sin lo que va entre paréntesis.

  Para cada grupo se elige cuál se queda —viene sugerida la de mejor formato, y
  nunca una cuyo archivo falte— y **la fusión le pasa todo lo demás**: las
  etiquetas de todas las copias, el favorito si alguna lo era, los campos de
  tono, tempo y ocasión que ella no tuviera, y su sitio en cada lista para
  culto. Eso es lo que hasta ahora se perdía al borrar la sobrante a mano. Los
  archivos de audio no se tocan.

  Un grupo también se puede marcar como «no son duplicadas» para que deje de
  aparecer, y esos descartes se pueden revisar de nuevo cuando se quiera.

- **Editar tono, tempo y ocasión** desde el panel de detalle. El backend ya sabía
  guardarlos desde el principio; faltaban los tres campos. Con ellos se encienden
  cosas que estaban apagadas por falta de datos: el filtro por ocasión, el agrupar
  por ocasión, la columna Tono de la biblioteca y tres columnas de la hoja
  imprimible. El tono sugiere la notación latina que ya usa el resto de la app
  (Do, Solm, Sib…) y la ocasión sugiere las que tu catálogo ya tiene.

- **Localizar una pista cuyo archivo se movió**, conservando sus etiquetas,
  favorito, tono, tempo y ocasión — y **quitarla de la biblioteca** una por una,
  sin borrar el audio. El panel de detalle ya cumple lo que su propio aviso
  prometía desde el principio.
- **Mover una carpeta indexada a su nueva ubicación** desde Configuración,
  reescribiendo la ruta de todas sus pistas de una vez. Es el caso que de verdad
  ocurre —la música cambió de disco, o Windows le dio otra letra— y hasta ahora
  obligaba a quitar la carpeta y volver a agregarla, perdiendo todo el trabajo.
- **Confirmación en las tres acciones que no se pueden deshacer**: quitar una
  carpeta indexada, eliminar una lista para culto y restaurar un respaldo. El
  diálogo dice con números reales qué se pierde —«se borrarán 128 pistas junto con
  sus etiquetas, favoritos, tono y ocasión»— y recuerda qué **no** se toca. Al
  restaurar, compara la biblioteca actual con la del respaldo antes de reemplazarla.
  «Cancelar» arranca con el foco, así que pulsar Enter por inercia no destruye nada.
- **ESLint** con configuración plana (typescript-eslint, react-hooks), ejecutado en
  CI con `--max-warnings 0`. Reglas en error: `no-explicit-any`,
  `no-floating-promises` y `no-unused-vars`.
- **`cargo fmt --check`** en CI, con `src-tauri/rustfmt.toml`: ancho 100 y
  `use_small_heuristics = "Max"`, que deja en una línea los structs y las llamadas
  cortos —el núcleo se escribió así a mano y se lee mejor—. Era la configuración
  que menos movía el código existente. El commit que lo reformateó entero está en
  `.git-blame-ignore-revs`.
- **`cargo audit`** en CI: falla ante vulnerabilidades conocidas en las
  dependencias de Rust.
- **CodeQL** (`.github/workflows/codeql.yml`) sobre la interfaz y el núcleo, en
  cada push, cada pull request y semanalmente.

### Corregido

- **La fecha volvía a la hoja impresa en crudo.** Desde que se guarda en un
  formato que se puede ordenar, imprimirla sin traducir dejaba «2026-09-25» en
  el papel que se reparte en el culto. Ahora se escribe como se lee.

### Cambiado

- **La fecha de una lista deja de ser texto libre.** Cada quien la escribía a su
  manera —`13/7/25`, `Domingo 13`, `julio 13`— y ninguna era comparable con
  otra, así que las listas salían en orden de creación: el culto del próximo
  domingo podía estar en cualquier sitio de la rejilla. El icono de calendario
  prometía una semántica que el dato no tenía.

  Ahora se elige en un calendario y se guarda en un formato que se puede
  ordenar. La vista de listas las separa en **«Próximos»** —el culto más
  cercano arriba— **«Anteriores»** y **«Sin fecha»**, y la fecha se muestra
  escrita en español.

  **Lo que ya estaba escrito no se pierde.** Al abrir la base, las fechas que
  se pueden interpretar se convierten solas —incluida «Domingo 13 de julio,
  2025», que era el ejemplo que la propia app sugería— y **lo que no se puede
  leer se conserva tal cual**, en su propio grupo. Un «el domingo después de
  Pascua» sigue diciendo algo aunque nada pueda ordenarlo.

  La fecha sigue siendo opcional: hay listas que no son de un culto concreto.

- **La biblioteca sigue usable mientras se escanea.** La tarjeta de escaneo
  decía «puedes seguir usando la app mientras tanto» y hacía exactamente lo
  contrario: tapaba la tabla entera, así que durante todo el escaneo no se podía
  buscar, ni abrir una lista para culto, ni mirar el catálogo ya indexado. Ahora
  el progreso vive en una tarjeta en la esquina —porcentaje, archivo actual y
  «Cancelar»— y la biblioteca se queda donde estaba. La tarjeta a pantalla
  completa se reserva para el primer escaneo, cuando de verdad no hay nada
  detrás que mostrar, y cede el sitio en cuanto llegan las primeras pistas.
- **Volver a escanear una carpeta ya no saca al usuario de Configuración.**
- **Las pistas aparecen mientras el escaneo avanza**, sin esperar al final. El
  núcleo ya estaba hecho para esto: el escaneo corre en su propia conexión y
  confirma por lotes de 200, así que lo que ya indexó se puede leer. Lo que
  faltaba era que la interfaz lo pidiera.

- **La biblioteca ya no se vuelve a dibujar entera varias veces por segundo.**
  Ocho componentes leían el store completo, así que cualquier cambio de estado
  —incluido el segundero del reproductor— repintaba la tabla entera, fila por
  fila. Ahora cada uno se suscribe solo a los campos que muestra, y las filas se
  saltan el repintado cuando su pista no cambió. Con una canción sonando, una
  tabla visible ya no se redibuja ni una vez.
- **Filtrar, ordenar y agrupar la biblioteca se hace una sola vez por cambio.**
  `applyFilters` recorría el catálogo entero en cada render y se llamaba dos
  veces por render, desde la barra superior y desde la tabla. Ahora recuerda su
  último resultado mientras no cambie nada de lo que lee.
- **La tabla de la biblioteca solo monta las filas que se ven** a partir de 120
  pistas: con 5.000, el DOM pasa de 5.000 filas a unas dos docenas. Por debajo de
  ese umbral se monta completa, para que ⌘F, el tabulador y los lectores de
  pantalla sigan alcanzando cada fila.

- TypeScript fijado en `~6.0.3`, bajando desde el `7.0.2` que había entrado por
  Dependabot: `typescript-eslint` soporta `>=4.8.4 <6.1.0` y falla en seco fuera
  de ese rango. `tsc` compila igual con TS 7, así que nada lo delataba hasta que
  hubo un linter. Dependabot ya no propone el bump.

- Integración continua (`ci.yml`): tipos, Vitest, `cargo clippy` y `cargo test` en
  cada push y cada pull request.
- Plantillas de issue (bug y propuesta) y de pull request.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` y este `CHANGELOG.md`.
- Dependabot para npm, Cargo y GitHub Actions.
- Actualizadas las acciones de GitHub, varias versiones mayores por detrás
  (`checkout`, `setup-node`, `upload-artifact`, `download-artifact` y
  `pnpm/action-setup`).
- README reescrito: contenido navegable, atajos de teclado, formatos soportados,
  problemas frecuentes, hoja de ruta y guía de publicación.
- `build.yml` ahora verifica que la etiqueta coincida con la versión de
  `package.json`, corre las pruebas antes de compilar y toma las notas del release
  de este archivo.

### Corregido

- **La versión deja de estar escrita en dos sitios que nada sincronizaba.**
  `package.json` alimentaba el número del pie de Configuración y
  `tauri.conf.json` el de los instaladores; en cuanto se subiera uno y se
  olvidara el otro, la app y su instalador anunciarían versiones distintas —
  justo el dato que se pide en un reporte de fallo desde un PC de la iglesia.
  Ahora `tauri.conf.json` toma la versión de `package.json` y no lleva número
  propio.

  Queda una tercera copia que el issue no mencionaba, `src-tauri/Cargo.toml`,
  porque Cargo no sabe leer `package.json`. El workflow de publicación la
  compara antes de compilar nada, y también comprueba que `tauri.conf.json`
  siga delegando en vez de volver a llevar un número a mano.

- **Los diálogos ya no dejan el teclado fuera.** Decían
  `aria-modal="true"` —que le promete a un lector de pantalla que lo de detrás
  está inerte— mientras el DOM decía lo contrario: al abrirse el foco se
  quedaba en el botón de atrás, `Tab` se paseaba por la página tapada por la
  superposición, y al cerrarse el foco se perdía. Ahora el foco entra al abrir,
  `Tab` y `Mayús+Tab` dan la vuelta dentro, y al cerrar vuelve al control que
  abrió el diálogo. Los cinco comparten la misma carcasa, así que no hay uno
  que se quede atrás.

  La confirmación sigue arrancando en «Cancelar», a propósito.

- **Reordenar una lista para culto ya no exige un ratón.** Era la función
  central de esa vista y solo funcionaba arrastrando. Ahora las filas se
  enfocan con el tabulador y se mueven con <kbd>Alt</kbd> +
  <kbd>↑</kbd>/<kbd>↓</kbd>, cada fila tiene botones de subir y bajar, y cada
  movimiento se anuncia —«Alma, Bendice al Señor, posición 1 de 6»— porque si
  no, mover una fila con el teclado es mudo.

- **Dos escaneos ya no se pisan.** La bandera de cancelación era un único
  `AtomicBool` global que cada escaneo bajaba al arrancar, así que lanzar uno
  nuevo **des-cancelaba** al que estaba terminando su archivo actual y lo dejaba
  correr hasta el final. Y nada impedía que dos escaneos corrieran a la vez:
  escribían por dos conexiones, mezclaban sus eventos de progreso en el mismo
  canal —la barra saltaba entre ambos— y cada uno terminaba tomando una foto de
  la biblioteca por encima del trabajo a medias del otro. Ahora cada escaneo
  lleva su propia bandera y solo uno puede correr a la vez; el segundo se
  rechaza con un mensaje claro. Cancelar sin nada en curso ya no deja nada
  levantado para el siguiente.
- Los botones de escanear y de agregar carpeta se apagan mientras hay un
  escaneo en curso, en lugar de dejar pulsar algo que el núcleo va a rechazar.

- **Un escaneo que falla ya no deja la carpeta a medias.** La fila se insertaba
  antes de empezar a recorrer el disco, así que una unidad desconectada o una
  carpeta ilegible dejaban una entrada con cero pistas en Configuración, a limpiar
  a mano. Si el escaneo falla y la carpeta era nueva, se retira; si era un
  re-escaneo, se conserva.
- **Las carátulas dejan de acumularse.** Se guardan como `{id}.{extensión}`, así
  que una pista cuyo arte incrustado cambiaba de formato escribía la nueva y
  abandonaba la anterior en el disco, sin nada que la referenciara. Ahora se borra
  al reemplazarla.
- **El diálogo de agregar carpeta ya no recuerda la vez anterior.** Su estado vivía
  en un componente que seguía montado con el diálogo cerrado, así que al reabrirlo
  aparecían la ruta ya elegida y el botón activo —un clic de más y se re-escaneaba
  algo que nadie pidió—, y la casilla de subcarpetas conservaba lo último marcado.

- **El panel de detalle muestra la ruta real del archivo.** La fabricaba juntando
  el nombre de la carpeta, el **título de la etiqueta ID3** y el formato, con una
  barra invertida fija. Así que una pista cuyo tag no coincidía con su nombre de
  archivo —lo normal— anunciaba una ruta que no existía, la barra estaba al revés
  en macOS, y con subcarpetas activadas señalaba la carpeta raíz en vez de la que
  de verdad la contiene. El backend siempre mandó la ruta buena; solo había que
  usarla. De paso, un botón para abrir el archivo en el Finder o el Explorador.

- **Una etiqueta con coma ya no se parte en dos.** Las etiquetas viajaban de la
  base a la interfaz como una cadena unida por comas, así que «lento, meditativo»
  volvía como dos etiquetas, la segunda con un espacio delante. Ahora se leen como
  filas y se agrupan en Rust, lo que además les da un orden estable. Al guardar se
  recortan los espacios sobrantes, de modo que «  lento   suave » y «lento suave»
  son la misma y no dos.
- **Las etiquetas sin dueño se borran.** Corregir una falta de ortografía dejaba la
  versión vieja en la tabla para siempre; lo mismo al quitar una pista o una
  carpeta. Invisible hoy, pero habría aparecido en cuanto exista un gestor de
  etiquetas.
- **El orden de una lista para culto se guarda entero o no se guarda.** El borrado
  previo se confirmaba por su cuenta, así que un `INSERT` que fallara a mitad
  —basta con que una pista desaparezca entre el arrastre y el guardado— dejaba el
  repertorio cortado por donde hubiera llegado. Y como la interfaz lanzaba la
  escritura sin escuchar el resultado, el fallo no se veía: la pantalla mostraba un
  orden que la base nunca recibió, y el culto aparecía revertido al siguiente
  arranque. Ahora es una transacción, y si falla la interfaz devuelve el orden
  anterior y lo avisa.
- **Reconciliar la biblioteca al arrancar deja de escribir sin motivo.** Era un
  `UPDATE` por pista, cada uno confirmándose solo: unos miles de pistas eran unos
  miles de `fsync`, y se reescribían todas aunque ninguna hubiera cambiado. Ahora
  va en una transacción por carpeta y solo toca las filas que de verdad cambiaron,
  que en el caso normal son ninguna.
- **Las ediciones del panel de detalle se guardan solas, y dejan de filtrarse.**
  Los cambios vivían en un borrador aparte que se superponía a la biblioteca, al
  reproductor, a los chips de ocasión, a las listas y a la hoja imprimible —así
  que algo sin guardar se veía igual que algo guardado, y **la hoja que te llevabas
  al atril podía llevar datos que la base nunca tuvo**. Al cerrar el panel el
  borrador seguía ahí, sin escribirse, hasta perderse al reiniciar.

  Ahora cada cambio entra directo al catálogo y se escribe solo, agrupando las
  ráfagas de tecleo. Lo pendiente se vuelca al cerrar el panel, al saltar a otra
  pista y al cerrar la ventana. El pie informa del estado real —«Guardando…»,
  «Guardado», «No se pudo guardar»— y el botón «Guardar cambios» desaparece porque
  ya no hay nada que pulsar. Si la escritura falla, lo tecleado se conserva y se
  avisa, en vez de aparentar que se guardó.

- `NewListDialog` sembraba sus campos desde un `useEffect` que llamaba `setState`,
  el anti-patrón que React desaconseja explícitamente. Ahora el formulario es un
  componente aparte montado bajo un `key`, así que los inicializadores de
  `useState` hacen el trabajo. Comportamiento idéntico, sin renders en cascada.

- El pipeline de compilación emparejaba **pnpm 11 con Node 20**, y pnpm 11 exige
  Node ≥ 22.13: cualquier intento de publicar una versión habría fallado nada más
  instalar dependencias. Como `build.yml` solo se disparaba con etiquetas, el fallo
  nunca llegó a verse. Ahora ambos workflows usan Node 22 y pnpm 12, y los
  requisitos del README y de CONTRIBUTING dicen lo mismo.

### Seguridad

- **Las tipografías dejan de venir de Google en cada arranque.** `global.css`
  las pedía a `fonts.googleapis.com`, así que cada vez que alguien abría
  Cantoral salía una petición con su IP hacia un tercero — en una app cuyo
  README promete «sin nube, sin cuentas, sin telemetría»—, la tipografía
  dependía de que hubiera red, y la CSP tenía que dejar abiertos dos orígenes
  solo para eso.

  Ahora van dentro del paquete (99 KB, solo los subconjuntos `latin` y
  `latin-ext`; el cirílico y el vietnamita sobraban en una app en español).
  Ambas son SIL Open Font License y su texto viaja junto a los archivos. La
  política se queda en `style-src 'self' 'unsafe-inline'; font-src 'self'`, sin
  un solo origen externo.

- **La webview ya no puede pedirle al sistema que abra cualquier archivo.**
  Tenía el permiso `opener:allow-open-path` con alcance `**`, y `open_path`
  abre el archivo con la aplicación predeterminada: un ejecutable incluido.
  Ahora ese permiso no está, y abrir un archivo pasa por un comando del núcleo
  que comprueba la extensión contra **la misma lista que indexa el escáner**,
  más el `.html` de la hoja exportada. El alcance de las URL vuelve al que trae
  `opener:default` —http, https, mailto y tel— en vez del `*` que había encima.

- **Content Security Policy, donde antes había `null`.** `csp: null` la
  desactiva entera: la webview podía cargar scripts, estilos y conexiones de
  cualquier origen. Ahora hay una política restrictiva, con su variante de
  desarrollo para que el recargado en caliente siga funcionando.

- **El protocolo `asset` ya no alcanza todo el disco.** Su ámbito era `**`, así
  que cualquier `asset://` dentro de la webview podía leer cualquier archivo
  del usuario. Ahora arranca vacío y se abre en tiempo de ejecución a lo que la
  app de verdad lee: su propio directorio de datos —donde viven las carátulas—
  y las carpetas que tú indexaste, según se agregan o se mueven.

  Hoy no había una ruta de explotación conocida; lo que faltaba era la defensa
  en profundidad de una app que lee archivos arbitrarios del usuario.

- **Restaurar un respaldo ya no puede destruir la biblioteca.** El archivo se abre
  en solo lectura y se comprueba que sea una base de Cantoral **antes** de tocar
  nada en disco, y la base anterior se aparta en vez de borrarse: si la copia o la
  apertura fallan, se devuelve a su sitio y la biblioteca queda exactamente como
  estaba. Antes se borraba el WAL y se sobrescribía el archivo antes de validar,
  así que elegir un `.db` equivocado —o una copia que fallara a medias— se llevaba
  el catálogo, las etiquetas, los favoritos y todas las listas, sin vuelta atrás.

## [0.1.0] — sin publicar

Primera versión. Todavía sin etiquetar ni publicar.

### Añadido

- **Biblioteca** — tabla ordenable y agrupable por ocasión, álbum o carpeta,
  búsqueda instantánea, favoritos y aviso de archivos faltantes.
- **Escaneo sin mover archivos** — indexado recursivo u opcionalmente plano, con
  lectura de metadatos vía `lofty` y extracción de carátulas incrustadas. Los
  re-escaneos son incrementales: solo se relee lo que cambió de tamaño o fecha.
- **Etiquetas** por pista, que sobreviven a los re-escaneos igual que los favoritos.
- **Listas para cultos** — crear, renombrar, fechar, reordenar arrastrando,
  reproducir completas y eliminar.
- **Hoja imprimible** de la lista, autocontenida, que se abre en el navegador para
  guardarla como PDF.
- **Reproductor integrado** con cola que sigue el orden del culto; los videos de
  proyección se abren en el reproductor del sistema.
- **Respaldo y restauración** de la base local desde Configuración.
- **Temas claro y oscuro**, con seguimiento del tema del sistema.
- **Atajos de teclado** y etiquetas de accesibilidad en las vistas principales.
- **Barra de título multiplataforma**: semáforo nativo en macOS, controles propios
  en Windows.
- **Pipeline de compilación** en matriz macOS + Windows, con firma opcional y
  publicación del GitHub Release.

[Sin publicar]: https://github.com/xlCyanz/cantoral/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/xlCyanz/cantoral/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/xlCyanz/cantoral/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/xlCyanz/cantoral/releases/tag/v0.2.0
