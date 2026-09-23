# Rediseño de Cantoral — brief

> Pega esto completo en Claude Design. Describe la app tal como es hoy, con todo
> lo que hace, y termina pidiendo el rediseño.

---

## 1. Qué es y para quién

Cantoral es una aplicación de escritorio (macOS y Windows) para **gestionar la
música de una iglesia**: la biblioteca de pistas, el repertorio de cada culto, y
las letras y acordes que la banda lee desde el atril.

Quien la usa no es un músico profesional ni alguien técnico. Es la persona
encargada de la alabanza en una iglesia pequeña, que arma el repertorio el sábado
por la noche y lo reproduce el domingo desde un **PC compartido**, a menudo con
prisa y con gente esperando. Muchas veces nadie técnico está cerca.

Eso manda sobre todo lo demás:

- **Nada puede fallar en silencio.** Si algo no se pudo hacer, tiene que decirlo
  con palabras que esa persona entienda y con qué hacer al respecto.
- **Nada destructivo sin avisar antes**, diciendo con números reales qué se
  pierde.
- **El domingo no hay tiempo de aprender.** Lo que se usa en vivo tiene que estar
  a un clic y funcionar con el teclado.
- **Todo en español.** Toda la interfaz, todos los mensajes de error.

---

## 2. Promesas que el rediseño no puede romper

1. **Los archivos de audio nunca se tocan.** Cantoral indexa, no mueve, no
   renombra, no convierte, no borra. Quitar una pista de la biblioteca deja el
   archivo en el disco. Esto se dice explícitamente en los diálogos y hay que
   seguir diciéndolo.
2. **Todo es local.** No hay nube, no hay cuenta, no hay red salvo para buscar
   actualizaciones. La biblioteca es SQLite en el disco del usuario.
3. **Funciona sin conexión**, siempre.
4. **Accesible con teclado.** Diálogos con trampa de foco, `Esc` para cerrar,
   listas navegables, reordenar el culto con `Alt` + flechas. Ninguna función
   central puede depender de apuntar con precisión con el ratón.

---

## 3. Plataforma y marco de ventana

- Ventana **sin decoración del sistema** (`decorations: false`): la app dibuja su
  propia barra de título, con los botones de ventana a la izquierda en macOS y a
  la derecha en Windows. Arrastrar la barra mueve la ventana.
- Tamaño por defecto 1200×800, mínimo 940×640. **No hay diseño móvil**; sí tiene
  que aguantar 940 de ancho sin romperse.
- Tema **claro y oscuro**, más «seguir al sistema».

---

## 4. Sistema visual actual

Es el punto de partida, no una jaula. La identidad es **cálida y de papel** —
terracota sobre crema—, deliberadamente no la de una app de música de consumo.

```
Claro                                Texto
--bg        #faf7f2                  --text    #221d18
--bg-2      #f1ebe1                  --text-2  #6b6155
--surface   #ffffff                  --text-3  #9e9384
--surface-2 #f6f1ea
--surface-3 #eee7dc                  Estados
--border    #e8e0d4                  --success #3d7b54
--border-2  #d9cebe                  --warning #8f6413
                                     --danger  #b8412f
Primario
--primary      #a9502e
--primary-soft #f4e7df
```

Tipografías: **Hanken Grotesk** (interfaz) e **Instrument Serif** (títulos
grandes). Ambas van empaquetadas, no se piden a Google.

Todos los colores son variables CSS que se redefinen para el tema oscuro. Los
estilos hoy son objetos `CSSProperties` en línea dentro de cada componente.

---

## 5. Mapa de pantallas

```
Barra de título (propia)
├─ Barra lateral          Biblioteca · Listas para cultos
│                         Filtros: Favoritas · Recién agregadas · Archivos faltantes
│                         Carpetas indexadas (con su cuenta)
│                         Configuración
├─ Zona principal         una de cuatro vistas
│  ├─ Biblioteca          tabla de pistas
│  ├─ Listas para cultos  rejilla de listas
│  ├─ Lista               una lista abierta
│  └─ Configuración
├─ Panel de detalle       lateral derecho, sobre la vista
└─ Barra del reproductor  siempre visible, abajo

Encima de todo: Modo culto (pantalla completa) · diálogos · avisos (toasts)
```

---

## 6. Funcionalidad completa

### 6.1 Biblioteca

Tabla con columnas **# · Título · Álbum · Ocasión · Tono · BPM · Duración**, más
carátula, favorito y un acceso por fila.

- **Indexar carpetas.** Se elige una carpeta; opción de incluir subcarpetas. El
  escaneo corre en segundo plano con progreso y se puede cancelar; la biblioteca
  sigue usándose mientras tanto y se va llenando sola.
- **Formatos**: audio `mp3 flac wav m4a aac ogg opus wma aiff aif`, video `mp4
  mov mkv avi webm m4v wmv`.
- **Metadatos**: título, artista, álbum, duración y **carátula embebida** se leen
  del archivo. Sin etiquetas, cae al nombre del archivo.
- **Ordenar** por cualquier columna, ascendente o descendente.
- **Agrupar** por ocasión, álbum o carpeta.
- **Buscar** por título, artista, tono o etiqueta, instantáneo.
- **Filtros rápidos**: favoritas, recién agregadas, archivos faltantes.
- **Chips de ocasión** y **chips de etiqueta**, que salen del propio catálogo.
  Elegir dos etiquetas acota a las que llevan las dos.
- **Virtualizada**: tiene que aguantar miles de pistas sin ir lenta.
- **Selección múltiple**: `Mayús` para un tramo, `⌘`/`Ctrl` para sumar,
  `⌘`/`Ctrl`+`A` para todo lo que muestra el filtro. Sobre lo elegido: agregar a
  una lista, marcar favoritas, etiquetar, quitar de la biblioteca.
- **Arrastrar** la selección a una lista de la barra lateral.
- **Clic derecho** sobre una fila: menú contextual propio.
- **Archivos que se movieron**: una pista marcada como faltante se puede
  reapuntar a su nueva ubicación sin perder etiquetas ni favorito, o se puede
  reapuntar la carpeta entera.

### 6.2 Panel de detalle de una pista

Se abre al hacer clic en una fila. Carátula grande, título, artista.

- **Reproducir** · abrir en el reproductor del sistema *(este botón va a
  desaparecer, ver §8)*.
- **Agregar a una lista** con un desplegable.
- **Datos del culto**, editables y que **se guardan solos**: tono (con
  sugerencias en notación latina: Do, Re, Mi… La, Si, y menores), tempo en BPM,
  ocasión (autocompleta con las ya usadas en el catálogo).
- **Etiquetas**: se añaden escribiendo y `Enter`, se quitan con una ×.
- **Letra y acordes**: abre el editor. Marca si la pista ya tiene hoja escrita.
- **Información del archivo**: formato, tamaño, ruta, carpeta.
- **Mostrar en el Finder / el Explorador**.

### 6.3 Letra y acordes

Editor con dos paneles: **acordes en formato ChordPro**
(`[Sol]Sublime [Do]gracia`) y **letra sola** para proyectar. Debajo, una vista
previa en vivo de cómo se verá, con **los acordes colocados encima de la sílaba
exacta** donde caen. Se guarda solo mientras se escribe.

### 6.4 Listas para cultos

Rejilla de tarjetas, cada una con su portada de color, ocasión, nombre, fecha,
número de pistas y duración total.

- **Separadas por fecha**: «Próximos» (el culto más cercano arriba),
  «Anteriores» (el más reciente arriba), «Sin fecha» y «Plantillas».
- **Repetir el culto anterior**: un botón por ocasión, arriba, que dice qué culto
  copiaría y de cuándo es.
- **Crear una lista**: nombre, fecha (calendario) y ocasión, con sugerencias.
  Puede **partir de una plantilla**.
- **Duplicar** una lista con todo su orden.
- **Guardar como plantilla**.
- **Importar** una lista enviada desde otra instalación.

### 6.5 Una lista abierta

Cabecera con portada, nombre, fecha escrita en español, número de pistas y
duración. Debajo, las pistas en el orden del culto.

- **Reordenar**: arrastrando, con botones de subir/bajar en cada fila, o con
  `Alt` + flechas. Cada movimiento se anuncia para lectores de pantalla.
- **Reproducir todo**, siguiendo el orden del culto.
- **Modo culto** (ver §6.6).
- **Imprimir** (ver §6.7).
- Menú `⋮`: editar, duplicar, **enviar a otra instalación**, guardar como
  plantilla, eliminar.

### 6.6 Modo culto

Pantalla completa, para el atril. Muestra la hoja de la canción actual con los
acordes sobre las sílabas.

- **Transponer** medio tono arriba o abajo. Reescribe la hoja entera con la
  **armadura correcta**: en un tono con bemoles se ve `Lab`, no `Sol#`. Indica
  desde qué tono y cuántos semitonos.
- **Tamaño de letra** ajustable.
- **Pasar de canción** con las flechas, siguiendo el orden del culto.
- Salir con `Esc`.

### 6.7 Imprimir

Vista previa dentro de la app: la hoja tal como va a salir, sobre papel blanco.

- Conmutador **«solo el repertorio»** (la tabla que lee quien dirige) o **«con
  letras y acordes»** (lo que va al atril, una canción por página). La elección
  se recuerda. Si ninguna pista tiene hoja escrita, la segunda opción no se
  ofrece.
- **Imprimir o guardar PDF** por el diálogo del sistema.
- **Guardar como archivo `.html`**, para mandar la hoja por correo.

### 6.8 Compartir listas entre instalaciones

- **Enviar**: escribe un `.cantoral.json` con la lista y lo justo de cada pista
  para reencontrarla. **No lleva audio ni rutas del disco.**
- **Importar**: antes de crear nada, una pantalla dice **qué se encontró y qué
  no**, con el nombre de cada pista ausente. Lo encontrado indica si fue por el
  mismo archivo o por título y duración.

### 6.9 Reproductor

Barra fija abajo: carátula, título, artista, favorito, anterior / reproducir /
siguiente, aleatorio, repetir, barra de progreso con tiempo transcurrido y total,
volumen y silencio. La cola sigue el orden del culto cuando se reproduce desde
una lista.

### 6.10 Configuración

- **Apariencia**: claro, oscuro, seguir al sistema, con vista previa.
- **Carpetas indexadas**: ruta, cuenta, última actualización; reescanear,
  reapuntar o quitar.
- **Etiquetas**: todas, con cuántas pistas llevan; renombrar (dos etiquetas con
  el mismo nombre se funden en una) y borrar.
- **Pistas duplicadas**: las busca por archivo idéntico o por título y artista.
  Cada grupo muestra formato, duración, tamaño y ruta de cada copia, y sugiere
  cuál conservar. Al fusionar, la que queda hereda etiquetas, favorito y el sitio
  en las listas. **Los archivos no se borran del disco.** Un grupo se puede
  descartar como «no son duplicadas».
- **Base de datos**: crear copia de seguridad y restaurar. Restaurar avisa
  comparando la biblioteca actual con la del respaldo, con números reales.
- **Ayuda**: repaso de cómo funciona.
- **Actualizaciones**: comprueba al abrir, sin interrumpir; si hay algo, aparece
  aquí con la versión y las novedades, y se instala con un botón.

### 6.11 Estados que hay que diseñar

- **Biblioteca vacía**, sin ninguna carpeta indexada.
- **Escaneando**: a pantalla completa si no hay nada todavía; en una tarjeta de
  esquina si ya hay catálogo que mostrar.
- **Error al cargar**, con forma de reintentar.
- **Lista vacía**, sin pistas.
- **Sin listas** todavía.
- **Archivos faltantes**: pistas cuyo archivo desapareció del disco.
- **Búsqueda o filtro sin resultados.**
- **Confirmaciones destructivas**: siempre con «Cancelar» enfocado por defecto,
  el número real de lo que se pierde, y qué **no** se toca.
- **Avisos (toasts)**: éxito, error, información.

---

## 7. Lo que ya duele

Encontrado usando la app de verdad, con una biblioteca real de 32 pistas:

1. **«Agrupar: Carpeta» no sirve.** Mete todo en un solo grupo, el de la carpeta
   *indexada*, aunque los archivos estén repartidos en `Himnos/`, `Coros/`,
   `Pistas 2025/`. Que es justo como los organiza una iglesia.
2. **La barra de selección múltiple flota sobre los diálogos** y tapa sus
   botones: con pistas seleccionadas, el «Cerrar» de la vista previa de
   impresión queda debajo y no se puede pulsar.
3. **Hay dos formas de llegar a lo mismo** (agregar a lista desde el panel de
   detalle, desde la selección múltiple, arrastrando y desde el clic derecho) sin
   que nada explique cuándo conviene cada una.
4. **La barra lateral mezcla** navegación (Biblioteca, Listas), filtros
   (Favoritas, Recién agregadas, Faltantes) y datos (Carpetas indexadas) en una
   sola columna sin jerarquía clara.
5. **El panel de detalle tapa la tabla** en ventanas estrechas y obliga a
   cerrarlo para seguir trabajando.
6. La densidad de la tabla está pensada para leer, no para **trabajar rápido un
   sábado** armando un repertorio de veinte canciones.

---

## 8. Cambios ya decididos, tenlos en cuenta

- **Desaparece el botón «macOS» / «Windows»** de la barra del reproductor y el
  ajuste «abrir siempre en el reproductor del sistema». Todo se reproduce dentro
  de la app.
- **Entra un reproductor de video integrado**, pensado para **proyectar en el
  culto**: sale en la segunda pantalla a pantalla completa, sin controles ni
  barra de título encima, negro entre un elemento y otro, siguiendo el orden del
  culto y con el siguiente video ya cargado en pausa. Esto es una pantalla nueva
  que hoy no existe y hay que diseñarla.

---

## 9. Lo que te pido

Rediseña Cantoral partiendo de todo lo anterior. Concretamente:

1. **Repensar la estructura**, no solo repintarla. La barra lateral, dónde vive
   cada cosa, y cómo se llega a lo que se usa en vivo.
2. **Resolver los seis puntos del §7.**
3. **Diseñar la vista de proyección de video** del §8.
4. **Dos densidades**: una para armar el repertorio con calma, otra para el
   domingo.
5. **Claro y oscuro**, los dos, con el mismo cuidado. El oscuro es el que se usa
   en un templo con las luces bajas.
6. **Conservar la identidad cálida de papel.** Esto no es Spotify: es el
   cancionero de una iglesia.
7. **Mostrar los estados vacíos, de carga y de error** del §6.11, no solo las
   pantallas llenas.

Entrega pantallas a 1200×800 y una comprobación a 940 de ancho.
