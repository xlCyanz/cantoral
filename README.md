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
- 📋 **Listas para cultos** — arma el repertorio de cada culto o ensayo, reordena arrastrando y reproduce toda la lista.
- ▶️ **Reproducción** — reproductor integrado, o abre en el reproductor predeterminado del sistema; soporta videos de proyección.
- 📂 **Escaneo sin mover archivos** — indexa carpetas con lectura de metadatos (`lofty`); tus archivos permanecen donde están.
- 🖥️ **Multiplataforma** — controles de ventana completos: semáforo nativo en macOS, barra de título propia en Windows.
- 🔒 **Privado por diseño** — base de datos SQLite local; sin nube, sin cuentas, sin telemetría.
- 🎨 **Claro y oscuro** — sistema de diseño cálido propio, con panel «Sistema de diseño» integrado.

## 🧱 Stack

| Capa | Tecnología |
|------|------------|
| Interfaz | React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · lucide-react |
| Núcleo | Tauri v2 (Rust) · SQLite (`rusqlite`, bundled) · `walkdir` · `lofty` |
| Plugins | `opener` (abrir en app externa) · `dialog` (selector de carpeta) |

## 🚀 Desarrollo

Requisitos: **Node 20+**, **pnpm**, **Rust** (stable). En Windows 11 WebView2 ya viene incluido.

```bash
pnpm install

# 1) Solo interfaz en el navegador (datos de ejemplo, sin Rust) — iteración rápida
pnpm dev            # http://localhost:1420

# 2) App de escritorio completa (interfaz + backend Rust)
pnpm tauri dev
```

En el navegador, `src/lib/api.ts` detecta que no hay runtime de Tauri y la app usa
los datos de ejemplo de `src/lib/seed.ts` (toda la UI es explorable, incluido el
panel «Demo» para ver los estados vacío / escaneo / error). Dentro de Tauri, la
misma capa llama a los comandos de Rust y opera sobre la base local.

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

- **Windows** — `Cantoral.exe` (**portable**, requiere WebView2 incluido en Windows 11), más `bundle/nsis/*.exe` y `bundle/msi/*.msi`.
- **macOS** — `bundle/macos/Cantoral.app` y `bundle/dmg/*.dmg`.

## 🗂️ Estructura

```
cantoral/
├── assets/                 # Logo, icono y banner
├── design/                 # Diseño de referencia (Cantoral.dc.html)
├── src/                    # Interfaz (React)
│   ├── components/         # TitleBar, Sidebar, TopBar, LibraryView, DetailPanel,
│   │                       # PlayerBar, Collections/Playlist, Config, DesignSystem, …
│   ├── lib/                # types · seed (mock) · covers · styles · api (seam Tauri)
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
`%APPDATA%\com.cantoral.desktop\` en Windows). Tablas: `folders`, `tracks`,
`playlists`, `playlist_tracks`, `tags`, `track_tags`, `settings`. Respalda desde
**Configuración → Base de datos → Crear copia**.

## 📄 Licencia

[MIT](LICENSE) · Hecho con cuidado para el ministerio de alabanza.
