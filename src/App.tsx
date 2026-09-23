import { useEffect } from "react";
import { flushUiPrefs, useStore } from "./store";
import { onScanProgress } from "./lib/api";
import { registerShortcuts } from "./lib/shortcuts";
import ErrorBoundary from "./components/ErrorBoundary";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import LibraryView from "./components/LibraryView";
import CollectionsView from "./components/CollectionsView";
import PlaylistView from "./components/PlaylistView";
import ConfigView from "./components/ConfigView";
import ProjectionView from "./components/ProjectionView";
import DetailPanel from "./components/DetailPanel";
import PlayerBar from "./components/PlayerBar";
import AddFolderDialog from "./components/AddFolderDialog";
import NewListDialog from "./components/NewListDialog";
import AddToListDialog from "./components/AddToListDialog";
import ImportListDialog from "./components/ImportListDialog";
import PrintPreview from "./components/PrintPreview";
import HelpDialog from "./components/HelpDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import ScanProgress from "./components/ScanProgress";
import RowMenu from "./components/RowMenu";
import SheetDialog from "./components/SheetDialog";
import ServiceView from "./components/ServiceView";
import Toast from "./components/Toast";

export default function App() {
  const theme = useStore((s) => s.theme);
  const view = useStore((s) => s.view);
  const tick = useStore((s) => s.tick);
  const hydrate = useStore((s) => s.hydrate);

  // Reflect the theme on <html> so the CSS variables flip app-wide.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // 1s player transport tick.
  useEffect(() => {
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [tick]);

  // Load the catalogue from the backend (no-op in the browser).
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Drive the scan progress bar from backend events.
  useEffect(() => {
    let un: (() => void) | undefined;
    void onScanProgress((p) => {
      useStore.setState({ scanPct: p.pct, scanFile: p.file, scanOmitidos: p.omitidos });
    }).then((u) => (un = u));
    return () => un?.();
  }, []);

  // Escuchar por dónde va lo que está proyectando la ventana de salida.
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

  // Global keyboard shortcuts (space, arrows, ⌘F, ⌘N, Esc, ?).
  useEffect(() => registerShortcuts(), []);

  // Edits and interface preferences both wait out a short debounce before they
  // are written. Closing the window inside it would drop them, so flush on the
  // way out.
  useEffect(() => {
    const flush = () => {
      useStore.getState().flushEdit();
      useStore.getState().flushSheet();
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
            {view === "config" && <ConfigView />}
            {view === "proyeccion" && <ProjectionView />}
          </main>
        </div>

        <DetailPanel />
      </div>

      <PlayerBar />
      <AddFolderDialog />
      <NewListDialog />
      <AddToListDialog />
      <ImportListDialog />
      <PrintPreview />
      <HelpDialog />
      <ConfirmDialog />
      <ServiceView />
      <SheetDialog />
      <RowMenu />
      <ScanProgress />
      <Toast />
    </div>
    </ErrorBoundary>
  );
}
