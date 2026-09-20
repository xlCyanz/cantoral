# Registro de cambios

Todos los cambios relevantes de Cantoral se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).

Secciones posibles: `Añadido`, `Cambiado`, `Obsoleto`, `Eliminado`, `Corregido`, `Seguridad`.

## [Sin publicar]

### Añadido

- **ESLint** con configuración plana (typescript-eslint, react-hooks), ejecutado en
  CI con `--max-warnings 0`. Reglas en error: `no-explicit-any`,
  `no-floating-promises` y `no-unused-vars`.
- **`cargo audit`** en CI: falla ante vulnerabilidades conocidas en las
  dependencias de Rust.
- **CodeQL** (`.github/workflows/codeql.yml`) sobre la interfaz y el núcleo, en
  cada push, cada pull request y semanalmente.

- Integración continua (`ci.yml`): tipos, Vitest, `cargo clippy` y `cargo test` en
  cada push y cada pull request.
- Plantillas de issue (bug y propuesta) y de pull request.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` y este `CHANGELOG.md`.
- Dependabot para npm, Cargo y GitHub Actions.

### Corregido

- `NewListDialog` sembraba sus campos desde un `useEffect` que llamaba `setState`,
  el anti-patrón que React desaconseja explícitamente. Ahora el formulario es un
  componente aparte montado bajo un `key`, así que los inicializadores de
  `useState` hacen el trabajo. Comportamiento idéntico, sin renders en cascada.

- El pipeline de compilación emparejaba **pnpm 11 con Node 20**, y pnpm 11 exige
  Node ≥ 22.13: cualquier intento de publicar una versión habría fallado nada más
  instalar dependencias. Como `build.yml` solo se disparaba con etiquetas, el fallo
  nunca llegó a verse. Ahora ambos workflows usan Node 22 y pnpm 12, y los
  requisitos del README y de CONTRIBUTING dicen lo mismo.

### Cambiado

- Actualizadas las acciones de GitHub, varias versiones mayores por detrás
  (`checkout`, `setup-node`, `upload-artifact`, `download-artifact` y
  `pnpm/action-setup`).
- README reescrito: contenido navegable, atajos de teclado, formatos soportados,
  problemas frecuentes, hoja de ruta y guía de publicación.
- `build.yml` ahora verifica que la etiqueta coincida con la versión de
  `package.json`, corre las pruebas antes de compilar y toma las notas del release
  de este archivo.

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
