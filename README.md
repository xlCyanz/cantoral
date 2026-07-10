# Cantoral

Aplicación de escritorio para **organizar y catalogar la música de la iglesia**:
carpetas, pistas, listas para cultos y metadatos ricos (título, artista, tono,
tempo, ocasión, etiquetas). La reproducción puede hacerse dentro del app o
delegarse al reproductor predeterminado de Windows. Los archivos de audio
**nunca se mueven ni se copian**: solo se indexan.

La interfaz implementa fielmente el diseño de `design/Cantoral.dc.html`.

## Stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS v4, Zustand, lucide-react.
- **Backend:** Tauri v2 (Rust) — SQLite vía `rusqlite` (bundled), escaneo con
  `walkdir` + lectura de metadatos con `lofty`.
- **Plugins Tauri:** `opener` (abrir en app externa), `dialog` (selector de carpeta).

## Estructura

```
cantoral/
├── design/                 # Diseño de referencia (Cantoral.dc.html + runtime)
├── src/                    # Frontend
│   ├── components/         # TitleBar, Sidebar, TopBar, LibraryView, DetailPanel,
│   │                       # PlayerBar, Collections/Playlist, Config, DesignSystem,
│   │                       # AddFolderDialog, Toast, DemoPill
│   ├── lib/                # types, seed (mock), covers, styles, api (seam Tauri)
│   ├── store.ts            # Estado global (Zustand) + selectores derivados
│   ├── styles/global.css   # Tokens de diseño (claro/oscuro), fuentes, keyframes
│   └── App.tsx
├── src-tauri/              # Backend Rust
│   └── src/
│       ├── models.rs       # Structs (Track, Folder, Playlist) serializados a la UI
│       ├── db.rs           # Conexión, esquema/migraciones y consultas SQLite
│       ├── scanner.rs      # Escaneo recursivo + lofty + eventos de progreso
│       ├── commands.rs     # Comandos IPC (biblioteca, listas, ajustes, respaldo)
│       └── lib.rs          # Registro de plugins, estado y handlers
└── .github/workflows/build.yml   # Compilación del ejecutable de Windows (CI)
```

## Desarrollo

Requisitos: Node 20+, pnpm, Rust (stable). En Windows 11 WebView2 ya viene incluido.

```bash
pnpm install

# 1) Solo interfaz en el navegador (datos de ejemplo, sin Rust) — iteración rápida
pnpm dev            # http://localhost:1420

# 2) App de escritorio completa (interfaz + backend Rust)
pnpm tauri dev
```

En el navegador, la capa `src/lib/api.ts` detecta que no hay runtime de Tauri y
la app usa los datos de ejemplo de `src/lib/seed.ts` (toda la UI es explorable,
incluido el panel «Demo» para ver los estados vacío/escaneo/error). Dentro de
Tauri, la misma capa llama a los comandos de Rust y opera sobre la base local.

## Multiplataforma (macOS y Windows)

Cantoral corre en **macOS y Windows** con controles de ventana completos
(maximizar, minimizar, cerrar, redimensionar). La barra de título se adapta al
sistema:
- **macOS:** controles nativos (semáforo) vía `titleBarStyle: Overlay`; doble
  clic en la barra maximiza.
- **Windows/Linux:** ventana sin marco con botones propios minimizar / maximizar
  (con icono restaurar) / cerrar, arrastre y doble clic para maximizar.

## Compilar

Cada instalador se genera en su runner nativo (compilar bundles de escritorio de
Tauri no es cross-compilable). El workflow `.github/workflows/build.yml` compila
**macOS + Windows** en matriz (tag `v*` o disparo manual). Localmente:

```bash
pnpm tauri build
```

Produce, según el sistema:
- **Windows:** `src-tauri/target/release/Cantoral.exe` (**portable**, requiere
  WebView2 incluido en Windows 11), más instaladores `bundle/nsis/*.exe` y `bundle/msi/*.msi`.
- **macOS:** `src-tauri/target/release/bundle/macos/Cantoral.app` y `bundle/dmg/*.dmg`.

## Datos

La base local `cantoral.db` (SQLite) se crea en el directorio de datos del app
(`%APPDATA%\com.cantoral.desktop` en Windows). Tablas: `folders`, `tracks`,
`playlists`, `playlist_tracks`, `tags`, `track_tags`, `settings`. Al re-escanear
una carpeta se conservan los campos editados por el usuario (tono, tempo,
ocasión, favorito). Usa **Configuración → Base de datos → Crear copia** para
respaldar.
