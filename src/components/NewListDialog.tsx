import { useState } from "react";
import { Layers, ListMusic, Pencil } from "lucide-react";
import { plantillas as plantillasSel, useStore } from "../store";
import { esIso } from "../lib/fechas";
import Modal from "./Modal";

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

/**
 * Create-a-list dialog, reused in «edit» mode for an existing list.
 *
 * Only decides whether the dialog is open and with what values. The form
 * itself is a separate component mounted under a `key`, so opening the dialog
 * — or switching to a different list — remounts it and the `useState`
 * initialisers seed the fields. Seeding from an effect instead would mean
 * calling setState during an effect body, which React advises against.
 */
export default function NewListDialog() {
  const dialog = useStore((s) => s.dialog);
  const current = useStore((s) => s.playlists.find((p) => p.id === s.curPlaylist));

  const editing = dialog === "editList";
  const open = dialog === "newList" || editing;
  if (!open) return null;

  return (
    <ListForm
      key={editing ? `edit:${current?.id ?? ""}` : "new"}
      editing={editing}
      initialNombre={editing ? current?.nombre ?? "" : ""}
      initialFecha={editing ? current?.fecha ?? "" : ""}
      initialOcasion={editing ? current?.ocasion ?? "" : ""}
    />
  );
}

function ListForm({
  editing,
  initialNombre,
  initialFecha,
  initialOcasion,
}: {
  editing: boolean;
  initialNombre: string;
  initialFecha: string;
  initialOcasion: string;
}) {
  const closeDialog = useStore((s) => s.closeDialog);
  const createList = useStore((s) => s.createList);
  const updateList = useStore((s) => s.updateList);
  const plantillas = useStore(plantillasSel);

  const [nombre, setNombre] = useState(initialNombre);
  const [fecha, setFecha] = useState(initialFecha);
  const [ocasion, setOcasion] = useState(initialOcasion);
  const [desde, setDesde] = useState("");

  const submit = () => {
    if (!nombre.trim()) return;
    if (editing) updateList(nombre, fecha, ocasion);
    else createList(nombre, fecha, ocasion, desde || undefined);
  };

  /**
   * Picking a template fills in the occasion when the field is still empty.
   * Typed text is never overwritten: the user's own words outrank a default.
   */
  const elegirPlantilla = (id: string) => {
    const siguiente = desde === id ? "" : id;
    setDesde(siguiente);
    const pl = plantillas.find((p) => p.id === siguiente);
    if (pl?.ocasion && !ocasion.trim()) setOcasion(pl.ocasion);
  };

  return (
    <Modal labelledBy="list-dialog-title" onClose={closeDialog} maxWidth={480}>
      <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 13 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--primary-soft)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          {editing ? <Pencil size={20} color="var(--primary)" /> : <ListMusic size={21} color="var(--primary)" />}
        </div>
        <div>
          <h2 id="list-dialog-title" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 2px" }}>
            {editing ? "Editar lista" : "Nueva lista para culto"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>
            {editing ? "Cambia el nombre, la fecha o la ocasión." : "Dale un nombre y arma el repertorio."}
          </p>
        </div>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Only when creating: an existing list already has its repertoire, and
            offering to replace it from a template would be a different, and
            destructive, action. */}
        {!editing && plantillas.length > 0 && (
          <div>
            <label style={label}>Partir de una plantilla <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span></label>
            <div role="group" aria-label="Plantillas" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {plantillas.map((p) => {
                const puesta = desde === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => elegirPlantilla(p.id)}
                    aria-pressed={puesta}
                    aria-label={`${p.nombre}, ${p.ids.length} ${p.ids.length === 1 ? "pista" : "pistas"}`}
                    className="hb-s2"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      height: 34,
                      padding: "0 12px",
                      borderRadius: 9,
                      border: `1px solid ${puesta ? "var(--primary)" : "var(--border-2)"}`,
                      background: puesta ? "var(--primary-soft)" : "var(--surface-2)",
                      color: puesta ? "var(--primary)" : "var(--text)",
                      fontSize: "12.5px",
                      fontWeight: 600,
                    }}
                  >
                    <Layers size={14} />
                    {p.nombre}
                    <span aria-hidden style={{ color: "var(--text-3)", fontWeight: 500 }}>{p.ids.length}</span>
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: "var(--text-3)", margin: "6px 0 0" }}>
              {desde
                ? "La lista nueva empieza con las mismas pistas, en el mismo orden."
                : "Empieza vacía, o elige una plantilla para copiar su repertorio."}
            </p>
          </div>
        )}
        <div>
          <label style={label}>Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} autoFocus placeholder="Culto Domingo…" className="in-focus" style={field} />
        </div>
        <div>
          <label style={label}>Fecha <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span></label>
          <input
            type="date"
            value={esIso(fecha) ? fecha : ""}
            onChange={(e) => setFecha(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            className="in-focus"
            style={field}
          />
          {/* A date written before there was a date picker cannot go in the
              field, so it is shown rather than vanishing without a word. */}
          {fecha && !esIso(fecha) && (
            <p style={{ fontSize: 11, color: "var(--text-3)", margin: "5px 0 0" }}>
              Antes decía «{fecha}». Elige una fecha para reemplazarla, o déjalo en blanco para quitarla.
            </p>
          )}
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
        <button onClick={submit} disabled={!nombre.trim()} className="hb-primary" style={{ height: 40, padding: "0 18px", borderRadius: 10, background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, boxShadow: "var(--sh-sm)", opacity: nombre.trim() ? 1 : 0.55, cursor: nombre.trim() ? "pointer" : "not-allowed" }}>
          {editing ? "Guardar cambios" : "Crear lista"}
        </button>
      </div>
    </Modal>
  );
}
