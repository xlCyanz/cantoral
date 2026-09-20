# Contribuir a Cantoral

Gracias por querer ayudar. Cantoral es una herramienta para ministerios de alabanza
reales, así que cada arreglo aterriza en el PC de una iglesia: se agradece tanto un
pull request como un reporte bien escrito.

Este proyecto se rige por el [Código de Conducta](CODE_OF_CONDUCT.md).

## Contenido

- [Por dónde empezar](#por-dónde-empezar)
- [Preparar el entorno](#preparar-el-entorno)
- [Cómo está organizado el código](#cómo-está-organizado-el-código)
- [Flujo de trabajo](#flujo-de-trabajo)
- [Convención de commits](#convención-de-commits)
- [Antes de abrir el pull request](#antes-de-abrir-el-pull-request)
- [Estilo de código](#estilo-de-código)
- [Pruebas](#pruebas)
- [Reportar un bug](#reportar-un-bug)
- [Proponer una función](#proponer-una-función)
- [Seguridad](#seguridad)

## Por dónde empezar

- 🌱 **[Buen primer issue](https://github.com/xlCyanz/cantoral/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)** — cambios acotados, con el archivo y la línea ya identificados.
- 🐛 **[Bugs](https://github.com/xlCyanz/cantoral/issues?q=is%3Aissue+is%3Aopen+label%3Abug)** — cada uno explica cómo falla y dónde.
- ✨ **[Funciones](https://github.com/xlCyanz/cantoral/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement)** — propuestas con el plan técnico esbozado.

Antes de ponerte con algo grande, comenta en el issue para que no coincidamos dos
personas en el mismo archivo. Si lo que quieres hacer no tiene issue, ábrelo primero:
así se acuerda el enfoque antes de que escribas código.

## Preparar el entorno

| | Versión | Notas |
|---|---|---|
| **Node** | 22+ | pnpm 12 exige Node ≥ 22.13 |
| **pnpm** | 12+ | `corepack enable` |
| **Rust** | stable | [rustup](https://rustup.rs) |
| **Xcode CLT** | — | solo macOS: `xcode-select --install` |

En Linux hacen falta además las dependencias de sistema de Tauri
(`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libsoup-3.0-dev`, `librsvg2-dev`,
`libayatana-appindicator3-dev`). La lista completa y al día está en
**[Tauri — Prerequisites](https://tauri.app/start/prerequisites/)**.

```bash
git clone https://github.com/xlCyanz/cantoral.git
cd cantoral
pnpm install

pnpm dev          # solo interfaz, datos de ejemplo, sin compilar Rust
pnpm tauri dev    # app completa
```

> [!TIP]
> Para trabajar en la interfaz, `pnpm dev` es mucho más rápido: `src/lib/api.ts`
> detecta que no hay runtime de Tauri y el store carga el catálogo de ejemplo de
> `src/lib/seed.ts`. Solo necesitas `pnpm tauri dev` cuando toques Rust, SQLite,
> el escaneo, los diálogos nativos o la reproducción de archivos reales.

## Cómo está organizado el código

**La regla principal: la interfaz nunca llama a `invoke` directamente.** Todo pasa
por `src/lib/api.ts`, que es la única costura con Tauri y la que hace posible el
modo navegador. Si añades un comando de Rust, añade también su envoltorio ahí.

| Capa | Dónde | Responsabilidad |
|---|---|---|
| Vistas | `src/components/` | Solo presentación; leen del store y llaman acciones |
| Estado | `src/store.ts` | Estado global (Zustand), acciones y selectores derivados puros |
| Costura | `src/lib/api.ts` | Único punto que habla con Tauri; degrada a mock en el navegador |
| Tipos | `src/lib/types.ts` | Espejo del esquema SQLite y de los modelos de vista |
| Comandos | `src-tauri/src/commands.rs` | Handlers IPC; no contienen SQL |
| Datos | `src-tauri/src/db.rs` | Esquema, migraciones y todas las consultas |
| Escaneo | `src-tauri/src/scanner.rs` | Recorrido del disco, `lofty`, eventos de progreso |

Otras convenciones que conviene respetar:

- **Los selectores de `store.ts` son funciones puras** sobre un snapshot del estado
  (`applyFilters`, `buildGroups`, `ocasiones`, `playQueue`…). Son las que se prueban
  en `src/lib/__tests__/selectors.test.ts`; mantenlas sin efectos.
- **Las migraciones son aditivas**: `db::open_and_migrate` usa `ALTER TABLE … ADD COLUMN`
  tolerante a fallos. Nunca cambies ni borres una columna existente sin una ruta de
  migración: hay bases en producción en PCs de iglesias.
- **Los campos que edita el usuario** (`tono`, `bpm`, `ocasion`, `fav`, etiquetas)
  **no se pisan al re-escanear**. Hay una prueba que lo garantiza
  (`upsert_preserves_user_edited_fields_on_rescan`); si tocas `upsert_track`, no la rompas.
- **Los textos visibles van en español**; el código, los comentarios y los mensajes
  de commit, en inglés.
- **Nada de red.** La app es local por diseño: sin telemetría, sin cuentas, sin llamadas externas.

## Flujo de trabajo

1. Haz fork y crea una rama desde `main`:

   ```bash
   git switch -c fix/detalle-ruta-del-archivo
   ```

   Prefijos de rama: `feat/`, `fix/`, `perf/`, `refactor/`, `docs/`, `test/`, `chore/`.

2. Haz commits pequeños y con sentido propio.
3. Corre las comprobaciones locales (abajo).
4. Abre el pull request contra `main`, rellenando la plantilla.

## Convención de commits

El proyecto usa [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):

```
<tipo>(<ámbito opcional>): <resumen en imperativo, minúscula, sin punto final>

[cuerpo opcional: el porqué, no el qué]

[pie opcional: Closes #12]
```

| Tipo | Cuándo |
|---|---|
| `feat` | Función nueva |
| `fix` | Corrección de un fallo |
| `perf` | Mejora de rendimiento sin cambiar el comportamiento |
| `refactor` | Reorganización sin cambio funcional |
| `test` | Añadir o mejorar pruebas |
| `docs` | Solo documentación |
| `build` / `ci` | Compilación, dependencias, workflows |
| `chore` | Mantenimiento que no encaja arriba |

Ejemplos reales del repositorio:

```
fix: derive the occasion filter from the catalogue, drop dead constants
perf: scan off the main mutex, plus tests, shortcuts and a11y
test: cover the scanner against real files, decoupling it from AppHandle
```

El resumen va en **inglés** y por debajo de 72 caracteres. Usa el cuerpo para
explicar *por qué*, que es lo que no se deduce del diff.

## Antes de abrir el pull request

Estos seis comandos son exactamente los que corre la CI. Si pasan en local, pasan
en GitHub:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo audit --file src-tauri/Cargo.lock
```

Si solo tocaste la interfaz, los de `cargo` son rápidos igualmente gracias a la
caché; córrelos de todos modos. `cargo audit` se instala una vez con
`cargo install cargo-audit --locked`.

CodeQL corre aparte, solo en GitHub, y publica en **Security → Code scanning alerts**.

> [!NOTE]
> `cargo fmt --check` **no** está en la CI: el núcleo está formateado a mano y
> rustfmt no lo reproduce con ninguna configuración, así que activarlo hoy
> reformatearía todo el archivo. Si tocas Rust, imita el estilo de alrededor en vez
> de correr `cargo fmt` sobre un archivo entero — un `cargo fmt` suelto convierte un
> PR de tres líneas en uno de trescientas. La decisión está abierta en
> [#28](https://github.com/xlCyanz/cantoral/issues/28).

Además:

- [ ] El PR hace **una** cosa. Si arreglas un bug y de paso reformateas medio archivo, sepáralos.
- [ ] Hay pruebas para lo que cambiaste, si es comportamiento probable.
- [ ] Probaste en la app real (`pnpm tauri dev`), no solo en el navegador, si tocaste el backend.
- [ ] Actualizaste el `README.md` si cambió algo que ahí se describe.
- [ ] Añadiste una línea a `CHANGELOG.md` bajo `Unreleased`.
- [ ] El PR referencia su issue (`Closes #N`).

No hace falta que el PR esté perfecto para abrirlo: márcalo como **borrador** si
quieres comentarios a medio camino.

## Estilo de código

**TypeScript / React**

- El proyecto no usa CSS en archivos: los estilos van en línea con objetos
  `CSSProperties`, y los colores **siempre** por variable CSS (`var(--primary)`,
  `var(--text-2)`), nunca un valor fijo. Los tokens están en `src/styles/global.css`
  y existen en claro y oscuro: un color fijo rompe uno de los dos temas.
- Iconos: `lucide-react`. Los SVG en línea que hay son del diseño de referencia y no
  se amplían.
- Suscríbete al store con selectores (`useStore(s => s.playing)`), no con `useStore()`
  a secas. Varios componentes antiguos lo hacen mal y por eso existe el
  [#5](https://github.com/xlCyanz/cantoral/issues/5); no añadas más.
- Nada de `any`: ESLint lo rechaza. Si el tipo es incómodo, ese suele ser el aviso
  de que el modelo necesita un ajuste.
- Toda promesa se maneja: `@typescript-eslint/no-floating-promises` está en error,
  porque una promesa rechazada sin `.catch` es como desaparece en silencio una
  llamada fallida al backend ([#8](https://github.com/xlCyanz/cantoral/issues/8)).
- No siembres estado con `useEffect` + `setState`. Si un componente necesita
  reiniciar su estado al abrirse o al cambiar de sujeto, móntalo bajo un `key` y
  deja que los inicializadores de `useState` hagan el trabajo — así está resuelto
  `NewListDialog`.

**Rust**

- Clippy corre con `-D warnings` en CI; no se admiten avisos nuevos.
- Imita el estilo del código de alrededor. No corras `cargo fmt` sobre archivos
  enteros mientras [#28](https://github.com/xlCyanz/cantoral/issues/28) siga abierto.
- Los errores que llegan al frontend pasan por el helper `e()` de `commands.rs`, que
  los registra en el log rotativo de camino.
- Los mensajes de error que ve el usuario van en español y dicen qué hacer, no solo
  qué pasó.
- El SQL vive en `db.rs`. `commands.rs` orquesta; no escribe consultas.

## Pruebas

**Frontend** — `src/lib/__tests__/`, con Vitest. Lo que se prueba son los selectores
puros del store y el generador de la hoja imprimible: lógica sin React, rápida y
estable. Si añades filtros, ordenamientos o agrupaciones, ahí va la prueba.

**Backend** — módulos `#[cfg(test)]` dentro de cada archivo de `src-tauri/src/`.
`db.rs` prueba contra una base en memoria con el esquema real; `scanner.rs` crea un
árbol temporal con archivos WAV de verdad y lo recorre. Fíjate en cómo `scan_folder`
recibe `on_progress` como callback en vez de un `AppHandle`: así se puede probar sin
una app de Tauri corriendo. Mantén esa propiedad al tocarlo.

```bash
pnpm test:watch                                          # vitest interactivo
cargo test --manifest-path src-tauri/Cargo.toml db::     # solo las pruebas de db
```

## Reportar un bug

Usa la **[plantilla de bug](https://github.com/xlCyanz/cantoral/issues/new?template=bug_report.yml)**.
Lo que más ayuda:

- versión de Cantoral (Configuración, al pie) y sistema operativo;
- pasos exactos para reproducirlo;
- qué esperabas y qué pasó;
- el log, si el fallo dejó rastro:
  - macOS: `~/Library/Logs/com.cantoral.desktop/`
  - Windows: `%APPDATA%\com.cantoral.desktop\logs\`

> [!CAUTION]
> Antes de experimentar con un fallo que toque la base de datos, haz una copia desde
> **Configuración → Base de datos → Crear copia**. Restaurar y quitar carpetas son
> operaciones destructivas sin confirmación todavía
> ([#1](https://github.com/xlCyanz/cantoral/issues/1), [#2](https://github.com/xlCyanz/cantoral/issues/2)).

## Proponer una función

Usa la **[plantilla de propuesta](https://github.com/xlCyanz/cantoral/issues/new?template=feature_request.yml)**.
Cuenta el problema del ministerio antes que la solución técnica: «necesito los
acordes en el atril» dice más que «añadan un campo de texto».

Lo que encaja en Cantoral: cosas que sirvan a un equipo de alabanza, que funcionen
sin internet y que no muevan los archivos del usuario. Lo que no: integraciones en la
nube, cuentas, telemetría, o cualquier cosa que modifique los archivos de audio.

## Seguridad

No abras un issue público para una vulnerabilidad. Sigue [SECURITY.md](SECURITY.md).
