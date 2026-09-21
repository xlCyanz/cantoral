# Registro de cambios

Todos los cambios relevantes de Cantoral se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).

Secciones posibles: `Añadido`, `Cambiado`, `Obsoleto`, `Eliminado`, `Corregido`, `Seguridad`.

## [Sin publicar]

### Añadido

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
- **`cargo audit`** en CI: falla ante vulnerabilidades conocidas en las
  dependencias de Rust.
- **CodeQL** (`.github/workflows/codeql.yml`) sobre la interfaz y el núcleo, en
  cada push, cada pull request y semanalmente.

### Cambiado

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

[Sin publicar]: https://github.com/xlCyanz/cantoral/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/xlCyanz/cantoral/releases/tag/v0.1.0
