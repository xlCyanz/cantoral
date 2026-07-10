import { Calendar, ListMusic, Plus } from "lucide-react";
import { plDur, useStore } from "../store";
import { gradientFor } from "../lib/covers";

export default function CollectionsView() {
  const playlists = useStore((s) => s.playlists);
  const plOrder = useStore((s) => s.plOrder);
  const openPlaylist = useStore((s) => s.openPlaylist);
  const newList = useStore((s) => s.newList);
  const s = useStore();

  return (
    <div style={{ padding: "22px 24px 40px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <p style={{ fontSize: "13.5px", color: "var(--text-2)", margin: 0, maxWidth: 520, lineHeight: 1.5 }}>
          Arma el repertorio de cada culto o ensayo. Reordena arrastrando, reproduce toda la lista y expórtala para el equipo.
        </p>
        <button onClick={newList} className="hb-primary" style={{ flex: "0 0 auto", height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 15px", borderRadius: 10, background: "var(--primary)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, boxShadow: "var(--sh-sm)", transition: "background .14s" }}>
          <Plus size={16} strokeWidth={2.2} />Nueva lista
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(196px,1fr))", gap: 18 }}>
        {playlists.map((p) => {
          const ids = plOrder[p.id] || p.ids;
          return (
            <div key={p.id} onClick={() => openPlaylist(p.id)} className="pl-card" style={{ cursor: "pointer", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 15, padding: 12 }}>
              <div style={{ position: "relative", width: "100%", aspectRatio: "1", borderRadius: 11, overflow: "hidden", boxShadow: "var(--sh-sm)" }}>
                <div style={gradientFor(p.id)} />
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                  <ListMusic size={42} color="rgba(255,255,255,.92)" strokeWidth={1.5} />
                </div>
                <div style={{ position: "absolute", left: 9, top: 9, background: "rgba(20,14,9,.42)", backdropFilter: "blur(4px)", color: "#fff", fontSize: "10.5px", fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>
                  {p.ocasion}
                </div>
              </div>
              <div style={{ padding: "12px 4px 4px" }}>
                <div style={{ fontSize: "14.5px", fontWeight: 700, letterSpacing: "-.1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nombre}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, color: "var(--text-2)" }}>
                  <Calendar size={13} style={{ flex: "0 0 auto" }} />
                  <span style={{ fontSize: "11.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.fecha}</span>
                </div>
                <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: 3, fontWeight: 500 }}>
                  {ids.length} pistas · {plDur(s, ids)}
                </div>
              </div>
            </div>
          );
        })}

        <button onClick={newList} className="pl-new" style={{ cursor: "pointer", background: "none", border: "1.5px dashed var(--border-2)", borderRadius: 15, minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 11, color: "var(--text-3)" }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--surface-2)", display: "grid", placeItems: "center" }}>
            <Plus size={22} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Crear nueva lista</span>
        </button>
      </div>
    </div>
  );
}
