import { useEffect } from "react";
import { useStore } from "./store";
import { onScanProgress } from "./lib/api";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import LibraryView from "./components/LibraryView";
import CollectionsView from "./components/CollectionsView";
import PlaylistView from "./components/PlaylistView";
import ConfigView from "./components/ConfigView";
import DetailPanel from "./components/DetailPanel";
import PlayerBar from "./components/PlayerBar";
import AddFolderDialog from "./components/AddFolderDialog";
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
      useStore.setState({ scanPct: p.pct, scanFile: p.file });
    }).then((u) => (un = u));
    return () => un?.();
  }, []);

  return (
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
          </main>
        </div>

        <DetailPanel />
      </div>

      <PlayerBar />
      <AddFolderDialog />
      <Toast />
    </div>
  );
}
