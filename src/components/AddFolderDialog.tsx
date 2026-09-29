import { useState } from "react";
import { Check, Folder, FolderPlus, Search } from "lucide-react";
import { useStore } from "../store";
import { backend } from "../lib/backend";
import { botonDialogoPrimario, botonDialogoSecundario } from "../lib/styles";
import Modal from "./Modal";

/**
 * Only decides whether the dialog is open. The form is a separate component so
 * that closing the dialog unmounts it and its state goes with it.
 *
 * Keeping the state here meant it outlived the dialog: after indexing a folder,
 * reopening showed the previous path already chosen and «Indexar carpeta»
 * enabled — one stray click away from re-scanning something nobody asked for.
 */
export default function AddFolderDialog() {
  const dialogOpen = useStore((s) => s.dialog === "addFolder");
  if (!dialogOpen) return null;
  return <AddFolderForm />;
}

function AddFolderForm() {
  const closeDialog = useStore((s) => s.closeDialog);
  const indexFolder = useStore((s) => s.indexFolder);

  const [path, setPath] = useState("");
  const [subfolders, setSubfolders] = useState(true);

  const browse = async () => {
    const chosen = await backend().pickFolder();
    if (chosen) setPath(chosen);
  };

  return (
    <Modal labelledBy="add-folder-title" onClose={closeDialog} maxWidth={520}>
      <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--primary-soft)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <FolderPlus size={21} color="var(--primary)" />
          </div>
          <div>
            <h2 id="add-folder-title" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 2px" }}>Agregar carpeta de música</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>Cantoral indexará los archivos sin moverlos ni copiarlos.</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* No es un campo que se escriba: la ruta sale de «Explorar…». Así que
            el rótulo y la ruta describen a ese botón, que es lo que recibe el
            foco, y no a un `label` que no apuntaba a nada (#138). */}
        <div id="carpeta-rotulo" style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-2)", marginBottom: 7 }}>Ubicación de la carpeta</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 42, display: "flex", alignItems: "center", gap: 9, border: "1px solid var(--border-2)", background: "var(--surface-2)", borderRadius: 10, padding: "0 12px", fontFamily: "ui-monospace,monospace", fontSize: "12.5px", color: "var(--text-2)", minWidth: 0 }}>
            <Folder size={16} color="var(--text-3)" style={{ flex: "0 0 auto" }} />
            <span id="carpeta-ruta" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: path ? "var(--text-2)" : "var(--text-3)" }}>
              {path || "Ninguna carpeta seleccionada"}
            </span>
          </div>
          <button onClick={browse} aria-describedby="carpeta-rotulo carpeta-ruta" className="hb-s2" style={{ height: 42, padding: "0 15px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 600 }}>Explorar…</button>
        </div>

        {/* Una casilla de verdad, escondida, debajo de la pintada: Tab llega,
            Espacio la marca y el lector la anuncia como casilla. Antes era un
            `label` con `onClick` sobre un `div` y el teclado se la saltaba
            (#138). */}
        <label className="casilla" style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 11, padding: 12, border: "1px solid var(--border)", borderRadius: 11, background: "var(--surface-2)", cursor: "pointer" }}>
          <input
            type="checkbox"
            className="solo-lector"
            checked={subfolders}
            onChange={(e) => setSubfolders(e.target.checked)}
            aria-describedby="subcarpetas-ayuda"
          />
          <div aria-hidden className="casilla-marca" style={{ width: 20, height: 20, borderRadius: 6, flex: "0 0 auto", marginTop: 1, display: "grid", placeItems: "center", ...(subfolders ? { background: "var(--primary-fill)" } : { border: "1.5px solid var(--border-2)", background: "var(--surface)" }) }}>
            {subfolders && <Check size={13} color="var(--on-primary)" strokeWidth={3} />}
          </div>
          <div>
            <div style={{ fontSize: "13.5px", fontWeight: 600 }}>Incluir subcarpetas</div>
            <div id="subcarpetas-ayuda" style={{ fontSize: 12, color: "var(--text-2)", marginTop: 1 }}>Revisa también las carpetas que estén dentro de esta.</div>
          </div>
        </label>
      </div>

      <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-2)" }}>
        <button onClick={closeDialog} className="hb-s3" style={botonDialogoSecundario}>Cancelar</button>
        <button onClick={() => indexFolder(path, subfolders)} disabled={!path} className="hb-primary" style={{ ...botonDialogoPrimario, display: "flex", alignItems: "center", gap: 8, opacity: path ? 1 : 0.55, cursor: path ? "pointer" : "not-allowed" }}>
          <Search size={16} strokeWidth={2.2} />Indexar carpeta
        </button>
      </div>
    </Modal>
  );
}
