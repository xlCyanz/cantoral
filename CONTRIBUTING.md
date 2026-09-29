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

Los issues están repartidos en
[milestones](https://github.com/xlCyanz/cantoral/milestones). Las cinco fases con las
que arrancó el proyecto están cerradas (el README cuenta qué resolvió cada una); los
milestones abiertos son los de ahora: la fiabilidad en vivo, la deuda técnica, la UX
y la accesibilidad, la documentación, y las propuestas que todavía hay que decidir.
Si dudas por dónde entrar, el milestone abierto de número más bajo es la respuesta;
los de «Propuestas por decidir» esperan una decisión antes que código.

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
> Para trabajar en la interfaz, `pnpm dev` es mucho más rápido: sin runtime de
> Tauri, el store habla con el backend en memoria (`src/lib/backend/memoria.ts`),
> que arranca con el catálogo de ejemplo de `src/lib/seed.ts`. Solo necesitas
> `pnpm tauri dev` cuando toques Rust, SQLite, el escaneo real, los diálogos
> nativos o la reproducción de archivos reales.

## Cómo está organizado el código

**La regla principal: la interfaz nunca llama a `invoke` directamente.** Todo pasa
por `src/lib/api.ts`, que es la única costura con Tauri. Si añades un comando de
Rust, añade también su envoltorio ahí.

**El store tiene un solo camino.** Lo que cambia entre la app y el navegador vive
detrás de la interfaz `Backend` (`src/lib/backend/`): `tauri.ts` delega en `api.ts`
y `memoria.ts` hace lo mismo sobre una base en memoria, con las mismas reglas que
SQLite (sin repetidos, borrado en cascada…). El store llama a `backend()` y aplica
lo que le contestan; no pregunta `isTauri()`. Una operación de datos nueva se añade
a la interfaz y a las dos implementaciones, con su prueba en `memoria.test.ts`. Lo
que el navegador no sabe hacer contesta `NoDisponible`, que el store enseña como
aviso. Los servicios de plataforma (ventana, proyección, actualizador, tema,
registro) siguen en `api.ts`, que ya no hace nada fuera de Tauri.

| Capa | Dónde | Responsabilidad |
|---|---|---|
| Vistas | `src/components/` | Solo presentación; leen del store y llaman acciones |
| Estado | `src/store/` | Estado global (Zustand) partido en slices por dominio, y los selectores puros |
| Backend | `src/lib/backend/` | Interfaz `Backend`: Tauri (`tauri.ts`) o en memoria (`memoria.ts`) |
| Costura | `src/lib/api.ts` | Único punto que habla con Tauri |
| Tipos | `src/lib/types.ts` | Espejo del esquema SQLite y de los modelos de vista |
| Comandos | `src-tauri/src/commands.rs` | Handlers IPC; no contienen SQL |
| Datos | `src-tauri/src/db.rs` | Esquema, migraciones y todas las consultas |
| Escaneo | `src-tauri/src/scanner.rs` | Recorrido del disco, `lofty`, eventos de progreso |

Otras convenciones que conviene respetar:

- **El store está partido por dominios** (`src/store/`). Cada slice —`biblioteca`, `cultos`,
  `reproductor`, `proyeccion`, `hojas`, `detalle`, `escaneo`, `duplicados`,
  `actualizaciones`, `interfaz`— tiene su parte del estado, su tipo (`BibliotecaSlice`…)
  y sus acciones; `index.ts` solo los junta y `CantoralState` es la suma. Lo que
  comparten varios slices (avisar, aplicar lo que contesta el backend, los guardados con
  retardo y sus temporizadores) vive en `contexto.ts`; las reglas puras de la proyección,
  en `src/lib/proyeccion.ts`. Una acción nueva va al slice de su dominio; si ninguno
  encaja, pregúntate antes si no es un dominio nuevo. Ningún archivo debería pasar de
  ~600 líneas. Los componentes siguen importando de `../store` como siempre.
- **Los selectores de `src/store/selectores.ts` son funciones puras** sobre un snapshot del estado
  (`applyFilters`, `buildGroups`, `ocasiones`, `playQueue`…). Son las que se prueban
  en `src/lib/__tests__/selectors.test.ts`; mantenlas sin efectos.
- **Las migraciones son aditivas y numeradas**: la base guarda su versión de esquema en
  `PRAGMA user_version`, y `db::open_and_migrate` aplica, cada una en su transacción, solo
  las entradas de `db::MIGRATIONS` que le faltan. Nunca cambies ni borres una columna
  existente sin una ruta de migración: hay bases en producción en PCs de iglesias. Para
  añadir una migración:
  1. Añade al final de `MIGRATIONS` la entrada `(N + 1, "…")`. No edites, reordenes ni
     borres las que ya se publicaron: una base que ya las corrió no las vuelve a ver.
  2. Un `ALTER TABLE … ADD COLUMN` va solo en su entrada. Las bases anteriores a la
     versión de esquema están en 0 pero ya tienen columnas, así que el error «duplicate
     column name» cuenta como «ya aplicada»; cualquier otro error detiene la apertura.
  3. Refleja el cambio también en `SCHEMA`: una base nueva se crea desde ahí y queda
     directamente en `SCHEMA_VERSION`, sin pasar por las migraciones.
  4. Añade una prueba en `db.rs` que abra una base anterior al cambio (hay un fixture de
     la 0.1.0, `SCHEMA_0_1_0`) y compruebe el resultado.

  Un respaldo con una versión mayor que `SCHEMA_VERSION` (de una Cantoral más nueva) se
  rechaza antes de tocar la biblioteca (`db::validate_backup`).
- **Lo que escribe el usuario no se pisa al re-escanear**: `ocasion`, `fav`, la letra
  y los acordes, y el `artista` cuando se corrigió a mano (lo marca `artista_manual`;
  si no, manda lo que diga el archivo). La columna `bpm` sigue en la base aunque la app
  ya no la lee ni la muestra, y lo que tenga no se toca (ver
  [#141](https://github.com/xlCyanz/cantoral/issues/141)).
  Hay una prueba que lo garantiza (`upsert_preserves_user_edited_fields_on_rescan`);
  si tocas `upsert_track`, no la rompas.
- **Los textos visibles van en español**; el código, los comentarios y los mensajes
  de commit, en inglés.
- **Ninguna llamada de red nueva.** La app es local por diseño: sin telemetría, sin
  cuentas. La única petición que hace por su cuenta es la comprobación de
  actualizaciones al abrir (`src-tauri/src/updates.rs`), que se puede apagar en
  Configuración y está descrita en el README (**Actualizaciones automáticas**) y en
  [SECURITY.md](SECURITY.md). Cualquier otra necesita su issue, y cambiar lo que
  dicen esos dos documentos.

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

Estos siete comandos son exactamente los que corre la CI. Si pasan en local, pasan
en GitHub:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo audit --file src-tauri/Cargo.lock
```

Si solo tocaste la interfaz, los de `cargo` son rápidos igualmente gracias a la
caché; córrelos de todos modos. `cargo audit` se instala una vez con
`cargo install cargo-audit --locked`.

CodeQL corre aparte, solo en GitHub, y publica en **Security → Code scanning alerts**.

> [!IMPORTANT]
> **TypeScript está fijado en `~6.0.3` a propósito.** `typescript-eslint` soporta
> `>=4.8.4 <6.1.0` y aborta con un error duro fuera de ese rango, así que subir a
> TS 7 deja el linter inservible aunque `tsc` siga compilando. Dependabot tiene
> instrucción de no proponer el bump; se levanta cuando se cierre
> [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940).

> [!NOTE]
> `cargo fmt` es ahora la autoridad sobre el formato de Rust, con la configuración
> de `src-tauri/rustfmt.toml` (ancho 100 y `use_small_heuristics = "Max"`, que deja
> en una línea los structs y llamadas cortos). Córrelo antes de abrir el PR y no
> discutas formato en las revisiones: lo que diga rustfmt.
>
> El commit que reformateó el núcleo está en `.git-blame-ignore-revs`. Para que
> `git blame` lo salte:
>
> ```bash
> git config blame.ignoreRevsFile .git-blame-ignore-revs
> ```

Además:

- [ ] El PR hace **una** cosa. Si arreglas un bug y de paso reformateas medio archivo, sepáralos.
- [ ] Hay pruebas para lo que cambiaste, si es comportamiento probable.
- [ ] Probaste en la app real (`pnpm tauri dev`), no solo en el navegador, si tocaste el backend.
- [ ] Actualizaste `README.md`, `SECURITY.md` o este `CONTRIBUTING.md` si cambió algo
      que ahí se describe (qué hace la app, qué toca la red, cómo se contribuye).
- [ ] Añadiste una línea a `CHANGELOG.md` bajo `Unreleased`.
- [ ] El PR referencia su issue (`Closes #N`).

No hace falta que el PR esté perfecto para abrirlo: márcalo como **borrador** si
quieres comentarios a medio camino.

## Subir de versión

La versión se escribe en **dos** archivos y los dos tienen que decir lo mismo:

| Archivo | Por qué |
|---|---|
| `package.json` | La fuente. De aquí salen el número del pie de Configuración y el de los instaladores — `src-tauri/tauri.conf.json` lo lee con `"version": "../package.json"` y no lleva número propio. |
| `src-tauri/Cargo.toml` | La versión del *crate*. Cargo no sabe leer `package.json`, así que esta se cambia a mano. |

El workflow de publicación lo comprueba antes de compilar nada: falla si
`tauri.conf.json` vuelve a llevar un número escrito a mano, si `Cargo.toml` no
coincide con `package.json`, o si la etiqueta `vX.Y.Z` no corresponde a esa
versión. Es más barato descubrirlo ahí que en un release ya publicado.

## Estilo de código

**TypeScript / React**

- El proyecto no usa CSS en archivos: los estilos van en línea con objetos
  `CSSProperties`, y los colores **siempre** por variable CSS (`var(--primary)`,
  `var(--text-2)`), nunca un valor fijo. Los tokens están en `src/styles/global.css`
  y existen en claro y oscuro: un color fijo rompe uno de los dos temas.
- Iconos: `lucide-react`. Los SVG en línea que hay son del diseño de referencia y no
  se amplían.
- Suscríbete al store con selectores (`useStore(s => s.playing)`), no con `useStore()`
  a secas: suscribirse al store entero fue lo que hacía re-renderizarse la tabla varias
  veces por segundo ([#5](https://github.com/xlCyanz/cantoral/issues/5)).
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
- `cargo fmt` decide el formato. Córrelo sobre lo que tocaste; la CI lo comprueba.
  Lo que rustfmt no decide —nombres, comentarios, cómo se parte una función— sigue
  el estilo del código de alrededor.
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
> **Configuración → Base de datos → Crear copia**. Restaurar reemplaza la biblioteca
> entera y quitar una carpeta borra sus pistas de los cultos: los dos piden
> confirmación, pero lo que confirmas no se deshace. Si copias `cantoral.db` a mano,
> cierra antes la app: con ella abierta, lo último escrito puede estar aún en
> `cantoral.db-wal`.

## Proponer una función

Usa la **[plantilla de propuesta](https://github.com/xlCyanz/cantoral/issues/new?template=feature_request.yml)**.
Cuenta el problema del ministerio antes que la solución técnica: «necesito los
acordes en el atril» dice más que «añadan un campo de texto».

Lo que encaja en Cantoral: cosas que sirvan a un equipo de alabanza, que funcionen
sin internet y que no muevan los archivos del usuario. Lo que no: integraciones en la
nube, cuentas, telemetría, o cualquier cosa que modifique los archivos de audio.

## Seguridad

No abras un issue público para una vulnerabilidad. Sigue [SECURITY.md](SECURITY.md).
