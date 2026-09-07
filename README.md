<div align="center">

<img src="assets/banner.png" alt="Cantoral — Música de la iglesia" width="840" />

<p>
  <img src="https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white" alt="macOS" />
  <img src="https://img.shields.io/badge/Windows-0078D4?logo=windows11&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/license-MIT-A9502E" alt="MIT" />
</p>

</div>

**Cantoral** es una aplicación de escritorio para **organizar y catalogar la música
de la iglesia**: carpetas, pistas, listas para cultos y metadatos ricos (título,
artista, tono, tempo, ocasión, etiquetas). Corre en **macOS y Windows**, funciona
**100% local** y **nunca mueve ni copia** tus archivos de audio: solo los indexa.

Pensada para el ministerio de alabanza: cálida, tranquila y legible para listas largas.

## ✨ Funciones

- 🎵 **Biblioteca** — tabla ordenable y agrupable (ocasión / álbum / carpeta), búsqueda instantánea, favoritos y aviso de archivos faltantes.
- ⛪ **Metadatos de iglesia** — edita **tono, tempo (BPM), ocasión** y etiquetas por pista; se conservan al re-escanear.
- 📋 **Listas para cultos** — arma el repertorio de cada culto o ensayo, reordena arrastrando, edita nombre/fecha/ocasión y reproduce toda la lista.
- 🖨️ **Exportar** — genera una hoja imprimible de la lista (título, artista, ocasión, tono, BPM, duración) que se abre en el navegador; de ahí sale PDF con Cmd/Ctrl + P.
- ▶️ **Reproducción** — reproductor integrado con cola que sigue el orden del culto; los videos de proyección se abren en el reproductor predeterminado del sistema.
- 📂 **Escaneo sin mover archivos** — indexa carpetas con lectura de metadatos (`lofty`), con o sin subcarpetas; tus archivos permanecen donde están.
- 🖥️ **Multiplataforma** — controles de ventana completos: semáforo nativo en macOS, barra de título propia en Windows.
- 🔒 **Privado por diseño** — base de datos SQLite local; sin nube, sin cuentas, sin telemetría.
- 🎨 **Claro y oscuro** — sistema de diseño cálido propio; sigue el tema del sistema o se fija a mano.
- ⌨️ **Teclado** — espacio para reproducir/pausar, flechas para cambiar de pista, ⌘/Ctrl + F para buscar, ⌘/Ctrl + N para una lista nueva, Esc para cerrar y `?` para la ayuda.

## 🧱 Stack

| Capa | Tecnología |
|------|------------|
| Interfaz | React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · lucide-react |
| Núcleo | Tauri v2 (Rust) · SQLite (`rusqlite`, bundled) · `walkdir` · `lofty` |
| Plugins | `opener` (abrir en app externa) · `dialog` (selector de carpeta) |

## 🚀 Desarrollo

Requisitos: **Node 20+**, **pnpm**, **Rust** (stable). En Windows 11 WebView2 ya viene
incluido; en Windows 10 lo instalan los instaladores NSIS/MSI.

```bash
pnpm install

# 1) Solo interfaz en el navegador (datos de ejemplo, sin Rust) — iteración rápida
pnpm dev            # http://localhost:1420

# 2) App de escritorio completa (interfaz + backend Rust)
pnpm tauri dev
```

Pruebas:

```bash
pnpm test                                        # selectores del store y hoja de exportación
cargo test --manifest-path src-tauri/Cargo.toml   # esquema y consultas SQLite
```

En el navegador, `src/lib/api.ts` detecta que no hay runtime de Tauri y la app usa
los datos de ejemplo de `src/lib/seed.ts`, así que toda la UI es explorable sin
compilar Rust. Dentro de Tauri no se carga ningún dato de ejemplo: la misma capa
llama a los comandos de Rust y opera sobre la base local.

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

Al publicar un tag `v*`, el workflow además **crea el GitHub Release** y adjunta los
`.dmg`, `.msi` y `.exe`, para que se puedan descargar sin entrar a GitHub Actions.

## ⬇️ Instalación

**Windows** — usa el instalador `-setup.exe` (NSIS) o el `.msi`. Ambos instalan el
runtime **WebView2** si falta, así que funcionan también en **Windows 10**.
El `Cantoral.exe` portable **no** instala WebView2: úsalo solo en equipos que ya lo
tengan (Windows 11 lo trae de fábrica).

**macOS** — abre el `.dmg` y arrastra Cantoral a Aplicaciones. Si la compilación no
está firmada (ver abajo), macOS dirá que la app «está dañada»; para abrirla igual:

```bash
xattr -dr com.apple.quarantine /Applications/Cantoral.app
```

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
├── assets/                 # Logo, icono y banner
├── design/                 # Diseño de referencia (Cantoral.dc.html)
├── src/                    # Interfaz (React)
│   ├── components/         # TitleBar, Sidebar, TopBar, LibraryView, DetailPanel,
│   │                       # PlayerBar, Collections/Playlist, Config, diálogos, …
│   ├── lib/                # types · seed (mock) · covers · styles · exportSheet
│   │                       # · shortcuts · api (seam Tauri) · __tests__/
│   ├── store.ts            # Estado global (Zustand) + selectores derivados
│   └── styles/global.css   # Tokens de diseño (claro/oscuro), fuentes, keyframes
├── src-tauri/src/          # Núcleo (Rust)
│   ├── models.rs           # Structs (Track, Folder, Playlist)
│   ├── db.rs               # Esquema/migraciones y consultas SQLite
│   ├── scanner.rs          # Escaneo recursivo + lofty + eventos de progreso
│   ├── commands.rs         # Comandos IPC (biblioteca, listas, ajustes, respaldo)
│   └── lib.rs              # Plugins, estado y handlers
└── .github/workflows/      # CI: build macOS + Windows
```

## 💾 Datos

La base local `cantoral.db` (SQLite) se crea en el directorio de datos del app
(`~/Library/Application Support/com.cantoral.desktop/` en macOS,
`%APPDATA%\com.cantoral.desktop\` en Windows). El esquema se migra solo al abrir.
Tablas: `folders`, `tracks`,
`playlists`, `playlist_tracks`, `tags`, `track_tags`, `settings`. Respalda desde
**Configuración → Base de datos → Crear copia**.

Los re-escaneos son incrementales: solo se vuelve a leer la metadata de los archivos
cuyo tamaño o fecha de modificación cambió. El escaneo corre en su propia conexión
SQLite y hace commit por lotes, así la interfaz sigue respondiendo mientras indexa.

Los errores que llegan a la interfaz también quedan en un log rotativo dentro del
directorio de logs del app (`~/Library/Logs/com.cantoral.desktop/` en macOS,
`%APPDATA%\com.cantoral.desktop\logs\` en Windows).

## 📄 Licencia

[MIT](LICENSE) · Hecho con cuidado para el ministerio de alabanza.
