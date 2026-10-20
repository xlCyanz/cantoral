import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { flushUiPrefs, useStore } from "./store";
import { registerShortcuts } from "./lib/shortcuts";
import { encajarAlCambiarLaVentana } from "./lib/tamano";
import ErrorBoundary from "./components/ErrorBoundary";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import LibraryView from "./components/LibraryView";
import CollectionsView from "./components/CollectionsView";
import PlaylistView from "./components/PlaylistView";
import DetailPanel from "./components/DetailPanel";
import PlayerBar from "./components/PlayerBar";
import AddFolderDialog from "./components/AddFolderDialog";
import NewListDialog from "./components/NewListDialog";
import AddToListDialog from "./components/AddToListDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import ScanProgress from "./components/ScanProgress";
import RowMenu from "./components/RowMenu";
import Toast from "./components/Toast";
import TrabajosDeFondo from "./components/TrabajosDeFondo";

// Lo que casi nunca se abre se carga al abrirlo, y no al arrancar: la
// configuración y los diálogos de ayuda y
// «Agregar canciones». Un rato después de arrancar se cargan
// igual, en un momento libre, para que la primera vez que se abran no
// esperen a nada.
const cargarConfig = () => import("./components/ConfigView");
const cargarAgregar = () => import("./components/AgregarCancionesDialog");
const cargarAyuda = () => import("./components/HelpDialog");
const ConfigView = lazy(cargarConfig);
const AgregarCancionesDialog = lazy(cargarAgregar);
const HelpDialog = lazy(cargarAyuda);
const DIFERIDOS = [cargarConfig, cargarAgregar, cargarAyuda];

/**
 * Lo diferido, sin nada en su lugar mientras llega: es un archivo local que
 * tarda un cuadro, y un esqueleto que aparece y desaparece se notaría más
 * que ese cuadro vacío.
 */
function Diferido({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

export default function App() {
  const theme = useStore((s) => s.theme);
  const view = useStore((s) => s.view);
  const tick = useStore((s) => s.tick);
  const hydrate = useStore((s) => s.hydrate);
  const dialog = useStore((s) => s.dialog);
  const arranqueListo = useStore((s) => s.arranqueListo);

  // Reflect the theme on <html> so the CSS variables flip app-wide.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // 1s player transport tick.
  useEffect(() => {
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [tick]);

  // Load the catalogue from the backend: SQLite in the app, the seed in the browser.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Drive the scan progress bar from backend events.
  useEffect(() => {
    let un: (() => void) | undefined;
    void useStore.getState().escucharEscaneo().then((u) => (un = u));
    return () => un?.();
  }, []);

  // Escuchar por dónde va el video que enseña la ventana de salida.
  useEffect(() => {
    let un: (() => void) | undefined;
    void useStore.getState().escucharProyeccion().then((u) => (un = u));
    return () => un?.();
  }, []);

  // Seguir al sistema mientras el modo sea «Sistema».
  //
  // Por dos canales a la vez, y no por capricho: el de la ventana nativa es el
  // que acierta —en Windows el webview contesta «claro» aunque el sistema esté
  // en oscuro—, y `matchMedia` es el único que hay en el modo navegador.
  useEffect(() => {
    let soltar: (() => void) | undefined;
    void useStore.getState().seguirAlSistema().then((f) => (soltar = f));
    if (!window.matchMedia) return () => soltar?.();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => useStore.getState().applySystemTheme();
    mq.addEventListener("change", handler);
    return () => {
      soltar?.();
      mq.removeEventListener("change", handler);
    };
  }, []);

  // Lo diferido, ya con la biblioteca en pantalla y en un rato libre.
  useEffect(() => {
    if (!arranqueListo) return;
    const id = setTimeout(() => DIFERIDOS.forEach((cargar) => void cargar().catch(() => {})), 3000);
    return () => clearTimeout(id);
  }, [arranqueListo]);

  // Global keyboard shortcuts (space, arrows, ⌘F, ⌘N, Esc, ?, ⌘+/⌘−).
  useEffect(() => registerShortcuts(), []);

  // El tamaño de la interfaz se vuelve a encajar cuando la ventana cambia.
  useEffect(() => encajarAlCambiarLaVentana(), []);

  // Edits and interface preferences both wait out a short debounce before they
  // are written. Closing the window inside it would drop them, so flush on the
  // way out.
  useEffect(() => {
    const flush = () => {
      useStore.getState().flushEdit();
      flushUiPrefs();
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);

  // Native feel: suppress the browser context menu, except in editable fields.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  return (
    <ErrorBoundary>
    <div style={{ height: "100vh", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)", color: "var(--text)" }}>
      <TitleBar />

      {/* body: sidebar + main + detail */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, minWidth: 0 }}>
        <Sidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, background: "var(--bg)" }}>
          <TopBar />
          <main style={{ flex: 1, overflowY: "auto", minHeight: 0, position: "relative" }}>
            {view === "biblioteca" && <LibraryView />}
            {view === "colecciones" && <CollectionsView />}
            {view === "lista" && <PlaylistView />}
            {view === "config" && <Diferido><ConfigView /></Diferido>}
          </main>
        </div>

        <DetailPanel />
      </div>

      <PlayerBar />
      <AddFolderDialog />
      <NewListDialog />
      <AddToListDialog />
      {/* Cada uno se monta solo abierto: cerrado no pinta nada, y así ni se
          carga ni sigue al store mientras tanto. */}
      {dialog === "agregarCanciones" && <Diferido><AgregarCancionesDialog /></Diferido>}
      {dialog === "help" && <Diferido><HelpDialog /></Diferido>}
      <ConfirmDialog />
      <RowMenu />
      <ScanProgress />
      <Toast />
      <TrabajosDeFondo />
    </div>
    </ErrorBoundary>
  );
}
