# Registro de cambios

Todos los cambios relevantes de Cantoral se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).

Secciones posibles: `Añadido`, `Cambiado`, `Obsoleto`, `Eliminado`, `Corregido`, `Seguridad`.

## [Sin publicar]

### Añadido

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

- **El pie del panel de detalle decía «Guardado automático», y no lo había.**
  Nada se guardaba hasta pulsar el botón. Ahora indica el estado de verdad: «Sin
  guardar» mientras haya cambios pendientes, «Al día» cuando no.
- **Guardar una pista ya no se anuncia antes de saber si funcionó.** El comando se
  lanzaba sin escuchar el resultado y el aviso «Cambios guardados» salía igual. Si
  falla, los valores anteriores vuelven, el borrador se conserva para no perder lo
  escrito y se avisa del error.

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
