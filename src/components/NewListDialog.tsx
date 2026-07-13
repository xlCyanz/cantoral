import { useState } from "react";
import { ListMusic } from "lucide-react";
import { useStore } from "../store";

const label = { display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-2)", marginBottom: 7 } as const;
const field = {
  width: "100%",
  height: 42,
  border: "1px solid var(--border-2)",
  background: "var(--surface-2)",
  borderRadius: 10,
  padding: "0 12px",
  fontSize: "13.5px",
  color: "var(--text)",
  outline: "none",
} as const;

export default function NewListDialog() {
  const open = useStore((s) => s.dialog === "newList");
  const closeDialog = useStore((s) => s.closeDialog);
  const createList = useStore((s) => s.createList);

  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [ocasion, setOcasion] = useState("");

  if (!open) return null;

  const submit = () => {
    if (!nombre.trim()) return;
    createList(nombre, fecha, ocasion);
    setNombre("");
    setFecha("");
    setOcasion("");
  };

  return (
    <div onClick={closeDialog} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(25,18,12,.42)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 24, animation: "canOverlay .18s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "var(--sh-lg)", overflow: "hidden", animation: "canDialog .24s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--primary-soft)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <ListMusic size={21} color="var(--primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 2px" }}>Nueva lista para culto</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>Dale un nombre y arma el repertorio.</p>
          </div>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={label}>Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} autoFocus placeholder="Culto Domingo…" className="in-focus" style={field} />
          </div>
          <div>
            <label style={label}>Fecha <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span></label>
            <input value={fecha} onChange={(e) => setFecha(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Domingo 13 de julio, 2025" className="in-focus" style={field} />
          </div>
          <div>
            <label style={label}>Ocasión <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span></label>
            <input value={ocasion} onChange={(e) => setOcasion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} list="ocasiones-lista" placeholder="Servicio dominical" className="in-focus" style={field} />
            <datalist id="ocasiones-lista">
              <option value="Servicio dominical" />
              <option value="Reunión juvenil" />
              <option value="Comunión" />
              <option value="Ensayo" />
              <option value="Adoración especial" />
            </datalist>
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-2)" }}>
          <button onClick={closeDialog} className="hb-s3" style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13.5px", fontWeight: 600 }}>Cancelar</button>
          <button onClick={submit} disabled={!nombre.trim()} className="hb-primary" style={{ height: 40, padding: "0 18px", borderRadius: 10, background: "var(--primary)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, boxShadow: "var(--sh-sm)", opacity: nombre.trim() ? 1 : 0.55, cursor: nombre.trim() ? "pointer" : "not-allowed" }}>Crear lista</button>
        </div>
      </div>
    </div>
  );
}
