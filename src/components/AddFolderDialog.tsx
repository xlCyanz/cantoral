import { useState } from "react";
import { Check, Folder, FolderPlus, Search } from "lucide-react";
import { useStore } from "../store";
import { pickFolder } from "../lib/api";

export default function AddFolderDialog() {
  const dialogOpen = useStore((s) => s.dialog === "addFolder");
  const closeDialog = useStore((s) => s.closeDialog);
  const indexFolder = useStore((s) => s.indexFolder);

  const [path, setPath] = useState("C:\\Música\\Iglesia\\Coros 2025");
  const [subfolders, setSubfolders] = useState(true);
  const [watch, setWatch] = useState(false);

  if (!dialogOpen) return null;

  const browse = async () => {
    const chosen = await pickFolder();
    if (chosen) setPath(chosen);
  };

  return (
    <div onClick={closeDialog} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(25,18,12,.42)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 24, animation: "canOverlay .18s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "var(--sh-lg)", overflow: "hidden", animation: "canDialog .24s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--primary-soft)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
              <FolderPlus size={21} color="var(--primary)" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 2px" }}>Agregar carpeta de música</h2>
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>Cantoral indexará los archivos sin moverlos ni copiarlos.</p>
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-2)", marginBottom: 7 }}>Ubicación de la carpeta</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 42, display: "flex", alignItems: "center", gap: 9, border: "1px solid var(--border-2)", background: "var(--surface-2)", borderRadius: 10, padding: "0 12px", fontFamily: "ui-monospace,monospace", fontSize: "12.5px", color: "var(--text-2)", minWidth: 0 }}>
              <Folder size={16} color="var(--text-3)" style={{ flex: "0 0 auto" }} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{path}</span>
            </div>
            <button onClick={browse} className="hb-s2" style={{ height: 42, padding: "0 15px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 600 }}>Explorar…</button>
          </div>

          <label onClick={() => setSubfolders((v) => !v)} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: 12, border: "1px solid var(--border)", borderRadius: 11, background: "var(--surface-2)", cursor: "pointer", marginBottom: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, flex: "0 0 auto", marginTop: 1, display: "grid", placeItems: "center", ...(subfolders ? { background: "var(--primary)" } : { border: "1.5px solid var(--border-2)", background: "var(--surface)" }) }}>
              {subfolders && <Check size={13} color="var(--on-primary)" strokeWidth={3} />}
            </div>
            <div>
              <div style={{ fontSize: "13.5px", fontWeight: 600 }}>Incluir subcarpetas</div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 1 }}>Revisa también las carpetas que estén dentro de esta.</div>
            </div>
          </label>
          <label onClick={() => setWatch((v) => !v)} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: 12, border: "1px solid var(--border)", borderRadius: 11, background: "var(--surface-2)", cursor: "pointer" }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, flex: "0 0 auto", marginTop: 1, display: "grid", placeItems: "center", ...(watch ? { background: "var(--primary)" } : { border: "1.5px solid var(--border-2)", background: "var(--surface)" }) }}>
              {watch && <Check size={13} color="var(--on-primary)" strokeWidth={3} />}
            </div>
            <div>
              <div style={{ fontSize: "13.5px", fontWeight: 600 }}>Vigilar cambios automáticamente</div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 1 }}>Re-indexa cuando agregues o quites archivos en esta carpeta.</div>
            </div>
          </label>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-2)" }}>
          <button onClick={closeDialog} className="hb-s3" style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13.5px", fontWeight: 600 }}>Cancelar</button>
          <button onClick={() => indexFolder(path)} className="hb-primary" style={{ height: 40, padding: "0 18px", borderRadius: 10, background: "var(--primary)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, display: "flex", alignItems: "center", gap: 8, boxShadow: "var(--sh-sm)" }}>
            <Search size={16} strokeWidth={2.2} />Indexar carpeta
          </button>
        </div>
      </div>
    </div>
  );
}
