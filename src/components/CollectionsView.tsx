import { FileInput, Layers, ListMusic, Plus } from "lucide-react";
import { cultos as cultosPorUso, plantillas as plantillasDe, plDur, useStore } from "../store";
import { gradientFor, inicialDe } from "../lib/covers";
import Empty, { emptyBtnPrimary, emptyBtnSecondary } from "./Empty";

export default function CollectionsView() {
  const playlists = useStore((s) => s.playlists);
  const plOrder = useStore((s) => s.plOrder);
  const openPlaylist = useStore((s) => s.openPlaylist);
  const newList = useStore((s) => s.newList);
  const tracks = useStore((s) => s.tracks);
  const importList = useStore((s) => s.importList);

  // Un culto no tiene fecha: es una lista preparada para darle y que corra.
  // Sale arriba el último que se abrió o se cambió, que es el que se está
  // preparando. Las plantillas van aparte porque no son cultos: son el punto
  // de partida de uno.
  const cultos = useStore(cultosPorUso);
  const plantillas = useStore(plantillasDe);
  const secciones = [
    { titulo: "Cultos", listas: cultos },
    { titulo: "Plantillas", listas: plantillas },
  ].filter((s) => s.listas.length > 0);
  // With everything in one bucket a heading says nothing, so it is left out
  // until the split actually separates something.
  const mostrarTitulos = secciones.length > 1;

  if (playlists.length === 0) {
    return (
      <Empty
        icon={<ListMusic size={42} strokeWidth={1.6} />}
        title="Aún no hay listas"
        desc="Crea tu primera lista para armar el repertorio de un culto o ensayo."
        action={
          // Importing has to be reachable from here as well: a fresh install
          // that was sent a list has no lists, which is exactly this screen.
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={newList} className="hb-primary" style={emptyBtnPrimary}>
              <Plus size={18} strokeWidth={2.2} />Nueva lista
            </button>
            <button onClick={importList} className="hb-s2" style={emptyBtnSecondary}>
              <FileInput size={16} />Importar lista
            </button>
          </div>
        }
      />
    );
  }

  return (
    <div style={{ padding: "22px 24px 40px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <p style={{ fontSize: "13.5px", color: "var(--text-2)", margin: 0, maxWidth: 520, lineHeight: 1.5 }}>
          Arma el repertorio de cada culto o ensayo. Reordena arrastrando, reproduce toda la lista y expórtala para el equipo.
        </p>
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={importList} className="hb-s2" title="Abrir una lista exportada desde otra instalación" style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13.5px", fontWeight: 600, transition: "background .14s" }}>
            <FileInput size={16} />Importar lista
          </button>
          <button onClick={newList} className="hb-primary" style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 15px", borderRadius: 10, background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, boxShadow: "var(--sh-sm)", transition: "background .14s" }}>
            <Plus size={16} strokeWidth={2.2} />Nueva lista
          </button>
        </div>
      </div>

      {secciones.map(({ titulo, listas }) => (
        <div key={titulo} style={{ marginBottom: 26 }}>
          {mostrarTitulos && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--text-3)" }}>
                {titulo}
              </span>
              <span style={{ fontSize: "11.5px", color: "var(--text-3)" }}>{listas.length}</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
          )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(184px,1fr))", gap: 12 }}>
        {listas.map((p) => {
          const ids = plOrder[p.id] || p.ids;
          return (
            <div key={p.id} onClick={() => openPlaylist(p.id)} className="pl-card" style={{ cursor: "pointer", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {/* La inicial en vez de un icono: veinte tarjetas con el mismo
                  dibujo no se distinguen de un vistazo, y la inicial sí. */}
              <div style={{ position: "relative", width: "100%", aspectRatio: "1.45", overflow: "hidden" }}>
                <div style={gradientFor(p.id, 150)} />
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                  <span className="display" style={{ fontSize: 34, color: "rgba(255,255,255,.9)" }}>{inicialDe(p.nombre)}</span>
                </div>
                <div style={{ position: "absolute", left: 9, top: 7, right: 9, fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.82)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.ocasion}
                </div>
                {p.plantilla && (
                  <div title="Plantilla" style={{ position: "absolute", right: 8, bottom: 8, display: "grid", placeItems: "center", width: 20, height: 20, background: "rgba(0,0,0,.34)", color: "#fff", borderRadius: 6 }}>
                    <Layers size={11} />
                  </div>
                )}
              </div>
              <div style={{ padding: "9px 10px 10px" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nombre}</div>
                {p.plantilla && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, color: "var(--text-2)" }}>
                    <Layers size={13} style={{ flex: "0 0 auto" }} />
                    <span style={{ fontSize: "11.5px" }}>Plantilla</span>
                  </div>
                )}
                <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: 3, fontWeight: 500 }}>
                  {ids.length} pistas · {plDur({ tracks }, ids)}
                </div>
              </div>
            </div>
          );
        })}

      </div>
        </div>
      ))}

    </div>
  );
}
