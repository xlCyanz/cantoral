<div align="center">

<img src="assets/banner.png" alt="Cantoral — Música de la iglesia" width="840" />

<p>
  <a href="https://github.com/xlCyanz/cantoral/actions/workflows/ci.yml"><img src="https://github.com/xlCyanz/cantoral/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/xlCyanz/cantoral/actions/workflows/build.yml"><img src="https://github.com/xlCyanz/cantoral/actions/workflows/build.yml/badge.svg" alt="Build" /></a>
  <a href="https://github.com/xlCyanz/cantoral/releases/latest"><img src="https://img.shields.io/github/v/release/xlCyanz/cantoral?display_name=tag&sort=semver&label=versión&color=A9502E" alt="Última versión" /></a>
  <a href="https://github.com/xlCyanz/cantoral/releases"><img src="https://img.shields.io/github/downloads/xlCyanz/cantoral/total?label=descargas&color=A9502E" alt="Descargas" /></a>
</p>
<p>
  <img src="https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white" alt="macOS" />
  <img src="https://img.shields.io/badge/Windows-0078D4?logo=windows11&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white" alt="Rust" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-A9502E" alt="MIT" /></a>
</p>

</div>

**Cantoral** es una aplicación de escritorio para **organizar y catalogar la música
de la iglesia**: carpetas, pistas, listas para cultos, letras y acordes, y los
metadatos del archivo. Corre en **macOS y Windows**, funciona
**100% local** y **nunca mueve ni copia** tus archivos de audio: solo los indexa.

Pensada para el ministerio de alabanza: cálida, tranquila y legible para listas largas.

<div align="center">

**[⬇️ Descargar](#️-instalación) · [🚀 Desarrollo](#-desarrollo) · [🤝 Contribuir](CONTRIBUTING.md) · [🗺️ Hoja de ruta](#️-hoja-de-ruta) · [📋 Cambios](CHANGELOG.md)**

</div>

---

## 📖 Contenido

- [✨ Funciones](#-funciones)
- [⬇️ Instalación](#️-instalación)
- [⚠️ Limitaciones conocidas](#️-limitaciones-conocidas)
- [🔄 Actualizaciones automáticas](#-actualizaciones-automáticas)
- [🧱 Stack](#-stack)
- [🚀 Desarrollo](#-desarrollo)
- [🧪 Pruebas](#-pruebas)
- [🖥️ Multiplataforma](#️-multiplataforma)
- [📦 Compilar](#-compilar)
- [🏷️ Publicar una versión](#️-publicar-una-versión)
- [🔏 Firma de código](#-firma-de-código)
- [🗂️ Estructura](#️-estructura)
- [💾 Datos](#-datos)
- [❓ Problemas frecuentes](#-problemas-frecuentes)
- [🗺️ Hoja de ruta](#️-hoja-de-ruta)
- [🤝 Contribuir](#-contribuir)
- [📄 Licencia](#-licencia)

## ✨ Funciones

- ✅ **Selección múltiple** — <kbd>Mayús</kbd> para un tramo, <kbd>⌘</kbd>/<kbd>Ctrl</kbd> para sumar, <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>A</kbd> para todo lo que muestra el filtro. Sobre lo elegido: agregar a una lista, marcar favoritas o quitarlas de la biblioteca, de una vez.
- 🎵 **Biblioteca** — tabla ordenable y agrupable (ocasión / álbum / carpeta), búsqueda instantánea, favoritos y aviso de archivos faltantes. Los chips de ocasión salen del propio catálogo, no de una lista fija.
- 🎼 **Artista y ocasión** — corrígelos desde el panel de detalle, con sugerencias de las ocasiones ya usadas en tu catálogo. De ahí salen el filtro por ocasión, el agrupar por ocasión y la hoja imprimible. El artista corregido a mano sobrevive a los re-escaneos, que si no lo pisarían con lo que diga el archivo.
- 📋 **Cultos** — un culto es una lista preparada: se arma una vez, se le da a proyectar y corre entero, pasando solo de un elemento al siguiente. No llevan fecha; arriba sale el último que abriste o cambiaste, que es el que estás preparando. Añade pistas de varias en varias: elígelas con <kbd>Mayús</kbd> o <kbd>⌘</kbd>/<kbd>Ctrl</kbd>, arrástralas a la lista, o usa el clic derecho. Reordena arrastrando, con los botones de cada fila o con <kbd>Alt</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd>: ninguna función central de la app depende de poder apuntar con precisión.
- 🔁 **Duplicar y plantillas** — duplica un culto con su orden, o guárdalo como plantilla para partir de él.
- 📤 **Compartir una lista** — mándala a otra instalación de Cantoral en un `.cantoral.json` y ábrela allí. No viaja el audio ni la ruta de tu disco, solo lo justo para volver a encontrar cada pista; al importar, una pantalla dice qué se encontró y qué falta antes de crear nada.
- 🎸 **Letra y acordes** — escríbelos por pista en formato ChordPro (`[Sol]Sublime [Do]gracia`) y léelos en **modo culto**: pantalla completa, letra grande, los acordes sobre la sílaba donde caen, y las flechas para pasar de canción desde el atril.
- 🖨️ **Imprimir** — la hoja de la lista (título, artista, ocasión, BPM, duración) se ve dentro de la app tal como va a salir y de ahí pasa al diálogo del sistema, donde está tu impresora y también «Guardar como PDF». Eliges entre solo el repertorio o con las letras y acordes detrás, una canción por página; y puedes guardar el `.html` si prefieres mandarla por correo.
- ▶️ **Reproducción** — todo suena dentro de la app, con una cola que sigue el orden del culto. Un video se ve en el panel de detalle mientras preparas, y por el proyector desde **Proyección**. Nada se le pasa a otro programa: en mitad de un culto, otra ventana encima de la proyección es lo último que quieres.
- 🧭 **Archivos que se movieron** — localiza una pista perdida sin perder lo que lleva escrito, o apunta la carpeta entera a su nueva ubicación cuando el disco cambia de letra.
- 📂 **Escaneo sin mover archivos** — indexa carpetas con lectura de metadatos (`lofty`), con o sin subcarpetas; tus archivos permanecen donde están.
- 🖥️ **Multiplataforma** — controles de ventana completos: semáforo nativo en macOS, barra de título propia en Windows.
- 🔒 **Privado por diseño** — base de datos SQLite local; sin nube, sin cuentas, sin telemetría. Cantoral **no hace ni una petición de red**: hasta las tipografías van dentro del paquete, así que funciona igual en un equipo sin conexión.
- 🎨 **Claro y oscuro** — sistema de diseño cálido propio; sigue el tema del sistema o se fija a mano.
- ⌨️ **Teclado** — ver la tabla de atajos abajo.

### Atajos de teclado

| Atajo | Acción |
|-------|--------|
| <kbd>Espacio</kbd> | Reproducir o pausar |
| <kbd>←</kbd> / <kbd>→</kbd> | Pista anterior / siguiente |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>F</kbd> | Buscar en la biblioteca |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>N</kbd> | Nueva lista para culto |
| <kbd>Enter</kbd> | Abrir el detalle de la pista enfocada |
| <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd> | Reproducir la pista enfocada |
| <kbd>Esc</kbd> | Cerrar diálogo o panel |
| <kbd>?</kbd> | Mostrar la ayuda |

### Formatos soportados

| | Extensiones |
|---|---|
| **Audio** | `mp3` `flac` `wav` `m4a` `aac` `ogg` `opus` `wma` `aiff` `aif` |
| **Video** (se abre fuera de la app) | `mp4` `mov` `mkv` `avi` `webm` `m4v` `wmv` |

## ⬇️ Instalación

Descarga el instalador desde la **[última versión](https://github.com/xlCyanz/cantoral/releases/latest)**.

**Windows** — usa el instalador `-setup.exe` (NSIS) o el `.msi`. Ambos instalan el
runtime **WebView2** si falta, así que funcionan también en **Windows 10**.
El `Cantoral.exe` portable **no** instala WebView2: úsalo solo en equipos que ya lo
tengan (Windows 11 lo trae de fábrica).

**macOS** — abre el `.dmg` y arrastra Cantoral a Aplicaciones. Si la compilación no
está firmada (ver [Firma de código](#-firma-de-código)), macOS dirá que la app
«está dañada»; para abrirla igual:

```bash
xattr -dr com.apple.quarantine /Applications/Cantoral.app
```

## ⚠️ Limitaciones conocidas

Cada una tiene su issue abierto; los enlaces llevan al detalle y al plan.

- **Sin firma de código** mientras no haya certificados (ver
  [Firma de código](#-firma-de-código)). Las actualizaciones automáticas van
  firmadas con su propia clave y no dependen de eso, pero en macOS la app
  actualizada vuelve a quedar en cuarentena hasta que exista el certificado; la
  app lo avisa antes de instalar.
- **Las actualizaciones automáticas solo alcanzan a Apple Silicon y a Windows
  x86-64.** Cada instalador se compila en el runner de su sistema, y los de
  macOS son ARM, así que un Mac Intel seguirá actualizándose a mano hasta que la
  compilación use `--target universal-apple-darwin`.
- **Una compilación sin la clave de firma del actualizador no se actualiza
  sola**, y lo dice en Configuración en vez de fingir que está al día. Es lo que
  pasa en un fork, y también aquí hasta que el secret exista (ver
  [Actualizaciones automáticas](#-actualizaciones-automáticas)).
- Los filtros de la biblioteca (búsqueda, favoritas, ocasión) no se conservan
  entre sesiones, a propósito: abrir la app con la biblioteca filtrada sin
  recordar por qué desconcierta más de lo que ayuda. El resto —volumen,
  silencio, aleatorio, repetir, orden, agrupación y dónde estabas— sí.

## 🧱 Stack

| Capa | Tecnología |
|------|------------|
| Interfaz | React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · lucide-react |
| Tipografías | Public Sans (interfaz) · Bricolage Grotesque (títulos) — SIL OFL 1.1, incluidas en `src/assets/fonts/` |
| Núcleo | Tauri v2 (Rust) · SQLite (`rusqlite`, bundled) · `walkdir` · `lofty` |
| Plugins | `opener` (abrir en app externa) · `dialog` (selector de carpeta) · `log` · `updater` |
| Pruebas | Vitest (frontend) · `cargo test` (backend) |
| Calidad | ESLint · `cargo clippy` · `cargo audit` · CodeQL |

## 🚀 Desarrollo

### Requisitos

| | Versión | Notas |
|---|---|---|
| **Node** | 22+ | pnpm 12 exige Node ≥ 22.13 |
| **pnpm** | 12+ | `corepack enable` lo instala |
| **Rust** | stable | via [rustup](https://rustup.rs) |
| **WebView2** | — | Windows 11 lo trae; en Windows 10 lo instalan los instaladores |
| **Xcode CLT** | — | solo macOS: `xcode-select --install` |

Guía oficial de dependencias del sistema: **[Tauri — Prerequisites](https://tauri.app/start/prerequisites/)**.

### Arrancar

```bash
git clone https://github.com/xlCyanz/cantoral.git
cd cantoral
pnpm install
```

Hay dos modos, y conviene conocer la diferencia:

```bash
# 1) Solo interfaz en el navegador (datos de ejemplo, sin Rust) — iteración rápida
pnpm dev            # http://localhost:1420

# 2) App de escritorio completa (interfaz + backend Rust)
pnpm tauri dev
```

En el navegador, `src/lib/api.ts` detecta que no hay runtime de Tauri y la app usa
los datos de ejemplo de `src/lib/seed.ts`, así que toda la UI es explorable sin
compilar Rust. Dentro de Tauri no se carga ningún dato de ejemplo: la misma capa
llama a los comandos de Rust y opera sobre la base local.

> [!TIP]
> El puerto 1420 es fijo (`strictPort`) porque Tauri lo espera. Si algo más lo
> ocupa, `pnpm dev` falla en vez de saltar al 1421: libera el puerto antes de
> arrancar.

### Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Interfaz sola en el navegador, con datos de ejemplo |
| `pnpm tauri dev` | App completa con el backend Rust |
| `pnpm build` | `tsc` + build de producción de la interfaz |
| `pnpm tauri build` | Instaladores para el sistema actual |
| `pnpm test` | Pruebas del frontend (Vitest) |
| `pnpm test:watch` | Vitest en modo interactivo |
| `pnpm lint` | ESLint sobre `src/` y los archivos de configuración |

## 🧪 Pruebas

```bash
pnpm lint                                         # ESLint (0 errores y 0 avisos)
pnpm exec tsc --noEmit                            # tipos
pnpm test                                         # selectores del store y hoja de exportación
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml   # esquema, consultas SQLite y escáner
cargo audit --file src-tauri/Cargo.lock           # vulnerabilidades en dependencias
```

Esos siete comandos son exactamente los que corre la CI en cada push y cada pull
request (`.github/workflows/ci.yml`), así que si pasan en local, pasan en GitHub.
`cargo audit` necesita instalarse una vez: `cargo install cargo-audit --locked`.

Además corre **CodeQL** (`.github/workflows/codeql.yml`), el análisis estático de
seguridad de GitHub, sobre la interfaz y el núcleo. Sus hallazgos aparecen en
**Security → Code scanning alerts**, no en la salida del job.

El formato de Rust lo decide `cargo fmt`, con la configuración de
`src-tauri/rustfmt.toml`: ancho 100 y `use_small_heuristics = "Max"`, que deja en
una línea los structs y las llamadas que quepan —el núcleo se escribió así a mano y
se lee mejor—. El commit que lo reformateó entero está en `.git-blame-ignore-revs`;
`git config blame.ignoreRevsFile .git-blame-ignore-revs` hace que `git blame` lo
salte.

## 🖥️ Multiplataforma

Cantoral corre en **macOS y Windows** con controles de ventana completos (maximizar,
minimizar, cerrar, redimensionar). La barra de título se adapta al sistema:

- **macOS** — controles nativos (semáforo) vía `titleBarStyle: Overlay`; doble clic en la barra maximiza.
- **Windows / Linux** — ventana sin marco con botones propios minimizar / maximizar (con icono restaurar) / cerrar, arrastre y doble clic para maximizar.

La detección es en tiempo de ejecución (`isMacOS()`), así que la misma compilación se adapta.

## 📦 Compilar

Los bundles de escritorio de Tauri **no son cross-compilables**: cada instalador se
genera en su runner nativo. `.github/workflows/build.yml` compila **macOS + Windows**
en matriz (tag `v*` o disparo manual). Localmente, en cada sistema:

```bash
pnpm tauri build
```

Produce, según el sistema:

- **Windows** — `bundle/nsis/*-setup.exe` y `bundle/msi/*.msi` (instaladores), más
  `Cantoral.exe` suelto (portable).
- **macOS** — `bundle/macos/Cantoral.app` y `bundle/dmg/*.dmg`.

## 🏷️ Publicar una versión

1. Anota los cambios en [`CHANGELOG.md`](CHANGELOG.md), moviendo lo de `Unreleased`
   a una sección con la versión y la fecha.
2. Sube el número en `package.json` **y** en `src-tauri/tauri.conf.json`
   (hoy hay que tocar los dos: [#11](https://github.com/xlCyanz/cantoral/issues/11)).
3. Haz commit y etiqueta:

   ```bash
   git commit -am "chore(release): v0.2.0"
   git tag v0.2.0
   git push origin main --tags
   ```

El workflow `build.yml` verifica que la etiqueta coincida con `package.json`, corre
las pruebas, compila macOS + Windows en paralelo y **crea el GitHub Release**
adjuntando los `.dmg`, `.msi` y `.exe`, con las notas tomadas del `CHANGELOG.md`.

## 🔄 Actualizaciones automáticas

Cantoral mira si hay una versión nueva **al abrirse, sin interrumpir**: si la
hay, aparece en **Configuración → Actualizaciones**, con el número de versión y
las novedades. También hay un botón para comprobarlo cuando se quiera. Instalar
descarga, verifica la firma, reemplaza la app y la reinicia.

La firma del actualizador es **independiente** de la de Apple y Microsoft: con
ella, una actualización queda verificada criptográficamente aunque el instalador
siga sin firmar.

### Poner la clave (una vez)

La clave privada firma lo que se instalará en los equipos de la iglesia, así que
la genera y la guarda quien mantiene el repositorio:

```bash
# 1. Generar el par. Guarda la privada donde no la vea nadie.
pnpm tauri signer generate -w ~/.tauri/cantoral.key

# 2. Subir la privada como secret del repositorio.
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/cantoral.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD   # la contraseña del paso 1

# 3. Poner la pública en la configuración y commitearla.
cat ~/.tauri/cantoral.key.pub
```

La pública va en `src-tauri/tauri.conf.json`, en `plugins.updater.pubkey`. Hasta
que esté, el campo queda vacío a propósito: la app compila y funciona igual, y
Configuración dice que esta compilación no trae actualizaciones automáticas en
vez de fallar con un error que nadie puede arreglar.

**Si la clave privada se pierde, se pierde la capacidad de actualizar las
instalaciones existentes**: generar otra obliga a reinstalar a mano en cada
equipo, porque las apps instaladas solo confían en la pública con la que se
compilaron.

### Qué publica cada release

El workflow de `build.yml` adjunta, además de los instaladores, un `latest.json`
armado por `.github/scripts/latest-json.mjs` con la firma y la URL de cada
plataforma. El endpoint que consulta la app es
`releases/latest/download/latest.json`, que GitHub resuelve siempre al último
release publicado. Sin el secret no se genera, y el release sale como siempre
—solo que sin actualizar a nadie—.

## 🔏 Firma de código

Sin firmar, macOS bloquea la app con «está dañada» y Windows muestra el aviso de
SmartScreen. El workflow firma **si** existen los secrets; si no, compila igual y
produce bundles sin firmar.

Secrets en **Settings → Secrets and variables → Actions**:

| Secret | Plataforma | Qué es |
|--------|-----------|--------|
| `APPLE_CERTIFICATE` | macOS | Certificado *Developer ID Application* `.p12` en base64 |
| `APPLE_CERTIFICATE_PASSWORD` | macOS | Contraseña del `.p12` |
| `APPLE_SIGNING_IDENTITY` | macOS | Ej. `Developer ID Application: Nombre (TEAMID)` |
| `KEYCHAIN_PASSWORD` | macOS | Contraseña del llavero temporal del runner (cualquier valor) |
| `APPLE_ID` | macOS | Apple ID para notarizar |
| `APPLE_PASSWORD` | macOS | Contraseña específica de app (appleid.apple.com) |
| `APPLE_TEAM_ID` | macOS | Team ID de la cuenta de desarrollador |
| `WINDOWS_CERTIFICATE` | Windows | Certificado de firma `.pfx` en base64 |
| `WINDOWS_CERTIFICATE_PASSWORD` | Windows | Contraseña del `.pfx` |

Ambas plataformas requieren certificados de pago (Apple Developer Program, ~99 USD/año;
un certificado Authenticode con proveedor comercial para Windows). Mientras no existan,
los instaladores salen sin firmar y hay que usar el rodeo de `xattr` de arriba.

Para pasar un `.p12`/`.pfx` a base64:

```bash
base64 -i certificado.p12 | pbcopy
```

## 🗂️ Estructura

```
cantoral/
├── .github/
│   ├── ISSUE_TEMPLATE/     # Plantillas de bug y de propuesta
│   ├── workflows/          # ci.yml (lint, pruebas, auditoría) · codeql.yml
│   │                       # (seguridad) · build.yml (instaladores + release)
│   └── PULL_REQUEST_TEMPLATE.md
├── assets/                 # Logo, icono y banner
├── design/                 # Diseño de referencia (Cantoral.dc.html)
├── src/                    # Interfaz (React)
│   ├── components/         # TitleBar, Sidebar, TopBar, LibraryView, DetailPanel,
│   │                       # PlayerBar, Collections/Playlist, Config, diálogos, …
│   ├── lib/                # types · seed (mock) · covers · styles · exportSheet
│   │                       # · shortcuts · api (seam Tauri) · __tests__/
│   ├── store.ts            # Estado global (Zustand) + selectores derivados
│   └── styles/global.css   # Tokens de diseño (claro/oscuro), fuentes, keyframes
└── src-tauri/src/          # Núcleo (Rust)
    ├── models.rs           # Structs (Track, Folder, Playlist)
    ├── db.rs               # Esquema/migraciones y consultas SQLite
    ├── scanner.rs          # Escaneo recursivo + lofty + eventos de progreso
    ├── commands.rs         # Comandos IPC (biblioteca, listas, ajustes, respaldo)
    └── lib.rs              # Plugins, estado y handlers
```

## 💾 Datos

La base local `cantoral.db` (SQLite) se crea en el directorio de datos del app:

| Sistema | Ruta |
|---|---|
| macOS | `~/Library/Application Support/com.cantoral.desktop/` |
| Windows | `%APPDATA%\com.cantoral.desktop\` |

El esquema se migra solo al abrir. Tablas: `folders`, `tracks`, `playlists`,
`playlist_tracks`, `tags`, `track_tags`, `settings`. Respalda desde
**Configuración → Base de datos → Crear copia**.

Los re-escaneos son incrementales: solo se vuelve a leer la metadata de los archivos
cuyo tamaño o fecha de modificación cambió. El escaneo corre en su propia conexión
SQLite y hace commit por lotes, así la interfaz sigue respondiendo mientras indexa.

Los errores que llegan a la interfaz también quedan en un log rotativo dentro del
directorio de logs del app:

| Sistema | Ruta |
|---|---|
| macOS | `~/Library/Logs/com.cantoral.desktop/` |
| Windows | `%APPDATA%\com.cantoral.desktop\logs\` |

## ❓ Problemas frecuentes

<details>
<summary><b>macOS dice que «Cantoral está dañada y no se puede abrir»</b></summary>

La compilación no está firmada, así que macOS la pone en cuarentena. Quítala:

```bash
xattr -dr com.apple.quarantine /Applications/Cantoral.app
```
</details>

<details>
<summary><b>Windows SmartScreen bloquea el instalador</b></summary>

Mismo motivo: falta el certificado Authenticode. **Más información → Ejecutar de todas formas**.
</details>

<details>
<summary><b>El escaneo no encuentra mis archivos</b></summary>

Revisa que la extensión esté en la [lista de formatos](#formatos-soportados) y que
la opción «Incluir subcarpetas» esté marcada si la música está anidada. Cantoral
rechaza indexar una carpeta que contenga —o esté dentro de— otra ya indexada, para
no descuadrar los contadores.
</details>

<details>
<summary><b>Muchas pistas aparecen como «Sin archivo»</b></summary>

Los archivos se movieron o la unidad externa no está conectada. Conecta la unidad y
vuelve a abrir la app: al arrancar se re-verifica todo el catálogo. Reubicar pistas
una a una todavía no se puede ([#17](https://github.com/xlCyanz/cantoral/issues/17)).
</details>

<details>
<summary><b>Una pista está en la carpeta y no aparece en la biblioteca</b></summary>

Cantoral solo indexa lo que puede reproducir. `.wma`, `.mkv`, `.avi` y `.wmv` no
los abre ningún motor de los que usa la app, así que no entran: al escanear se
dice cuántos archivos se quedaron fuera por eso. Conviértelos a MP3 o MP4 y
vuelve a escanear la carpeta.

Con `.ogg`, `.opus`, `.aiff` y `.mov` depende del sistema —Windows y macOS no
coinciden—, así que sí se indexan; si alguno no suena, la app lo dice al
intentarlo.
</details>

<details>
<summary><b>¿Dónde están mis datos y cómo los muevo a otro equipo?</b></summary>

En `cantoral.db` (ver [Datos](#-datos)). **Configuración → Base de datos → Crear copia**
genera un archivo que puedes llevar a otro equipo y cargar con **Restaurar…**. Ojo:
restaurar **reemplaza** toda la biblioteca actual.
</details>

## 🗺️ Hoja de ruta

El trabajo está repartido en cinco fases, cada una un
[milestone](https://github.com/xlCyanz/cantoral/milestones). El orden no es
arbitrario: cada fase supone la anterior resuelta.

### [Fase 1 · No perder datos](https://github.com/xlCyanz/cantoral/milestone/1)

La app no puede destruir el trabajo del usuario. Va primero porque nada de lo demás
importa si una biblioteca etiquetada a mano durante meses se pierde con un clic: no
hay nube, no hay historial, y el único seguro es una copia manual.

Confirmaciones en las acciones destructivas ([#2](https://github.com/xlCyanz/cantoral/issues/2)),
escrituras transaccionales ([#8](https://github.com/xlCyanz/cantoral/issues/8)),
etiquetas que no se corrompen al releerlas ([#9](https://github.com/xlCyanz/cantoral/issues/9)) y
reubicar pistas sin tener que borrar la carpeta entera ([#17](https://github.com/xlCyanz/cantoral/issues/17)).

### [Fase 2 · Que la app haga lo que promete](https://github.com/xlCyanz/cantoral/milestone/2)

Cerrar la brecha entre lo que este README anuncia y lo que la app hace de verdad.
Hoy hay columnas que siempre salen vacías y un filtro que nunca muestra nada.

Es la fase con más retorno por esfuerzo, porque casi todo el backend ya existe y
falta la interfaz que lo use. El editor de tono, BPM y ocasión
([#16](https://github.com/xlCyanz/cantoral/issues/16)) por sí solo desbloquea el
filtro por ocasión, la columna Tono, el agrupar por ocasión y tres columnas de la
hoja imprimible.

### [Fase 3 · Aguantar una biblioteca real](https://github.com/xlCyanz/cantoral/milestone/3)

Miles de pistas repartidas en discos externos, sin que la interfaz se arrastre
([#5](https://github.com/xlCyanz/cantoral/issues/5)) ni dos escaneos se pisen
([#6](https://github.com/xlCyanz/cantoral/issues/6)). Va después de la fase 2 a
propósito: optimizar una interfaz que todavía va a cambiar es trabajo que se tira.

### [Fase 4 · El flujo del culto](https://github.com/xlCyanz/cantoral/milestone/4)

Lo que un equipo de alabanza hace cada semana y hoy la app resuelve a medias.
La pieza grande —**letras y acordes con transposición**
([#21](https://github.com/xlCyanz/cantoral/issues/21))— ya está: es lo que hace
que alguien use Cantoral **durante** el culto y no solo antes. Quedan la
selección múltiple ([#20](https://github.com/xlCyanz/cantoral/issues/20)), las
etiquetas gestionables ([#22](https://github.com/xlCyanz/cantoral/issues/22)) y
poder compartir una lista con el equipo
([#26](https://github.com/xlCyanz/cantoral/issues/26)).

### [Fase 5 · Llegar a la iglesia](https://github.com/xlCyanz/cantoral/milestone/5)

Que las versiones nuevas lleguen a un PC de iglesia sin que nadie técnico intervenga
([#19](https://github.com/xlCyanz/cantoral/issues/19)). Mientras actualizar siga
siendo entrar a GitHub y acordarse del rodeo de `xattr`, los arreglos de las fases 1
a 4 no llegan a quien los necesita.

---

Para navegar por otro eje:
🐛 [bugs](https://github.com/xlCyanz/cantoral/issues?q=is%3Aissue+is%3Aopen+label%3Abug) ·
✨ [funciones](https://github.com/xlCyanz/cantoral/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement) ·
🌱 [buen primer issue](https://github.com/xlCyanz/cantoral/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) ·
⚡ [rendimiento](https://github.com/xlCyanz/cantoral/issues?q=is%3Aissue+is%3Aopen+label%3Aperformance) ·
♿ [accesibilidad](https://github.com/xlCyanz/cantoral/issues?q=is%3Aissue+is%3Aopen+label%3Aaccessibility) ·
🔒 [seguridad](https://github.com/xlCyanz/cantoral/issues?q=is%3Aissue+is%3Aopen+label%3Asecurity)

## 🤝 Contribuir

Las contribuciones son bienvenidas. Empieza por **[CONTRIBUTING.md](CONTRIBUTING.md)**:
tiene el entorno, las convenciones de commit, cómo correr las pruebas y qué se espera
de un pull request.

- 🐞 ¿Encontraste un fallo? → [Reportar un bug](https://github.com/xlCyanz/cantoral/issues/new?template=bug_report.yml)
- 💡 ¿Se te ocurre algo? → [Proponer una función](https://github.com/xlCyanz/cantoral/issues/new?template=feature_request.yml)
- 🔒 ¿Un problema de seguridad? → [SECURITY.md](SECURITY.md) (**no** abras un issue público)

Este proyecto se rige por el [Código de Conducta](CODE_OF_CONDUCT.md).

## 📄 Licencia

[MIT](LICENSE) © Johan Sierra Linares · Hecho con cuidado para el ministerio de alabanza.
