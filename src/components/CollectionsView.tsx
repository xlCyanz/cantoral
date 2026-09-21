import { Calendar, Layers, ListMusic, Plus, RotateCcw } from "lucide-react";
import { plDur, repetibles, useStore } from "../store";
import { gradientFor } from "../lib/covers";
import { formatearFechaCorta, partirPorFecha } from "../lib/fechas";
import Empty, { emptyBtnPrimary } from "./Empty";

export default function CollectionsView() {
  const playlists = useStore((s) => s.playlists);
  const plOrder = useStore((s) => s.plOrder);
  const openPlaylist = useStore((s) => s.openPlaylist);
  const newList = useStore((s) => s.newList);
  const tracks = useStore((s) => s.tracks);
  const duplicateList = useStore((s) => s.duplicateList);
  const repetir = useStore(repetibles);

  // Templates are not services, so they are kept out of the date split: a
  // template has no date and would otherwise pile up under «Sin fecha» next to
  // lists that merely lost theirs.
  const cultos = playlists.filter((p) => !p.plantilla);
  const plantillas = playlists.filter((p) => p.plantilla);
  const { proximos, pasados, sinFecha } = partirPorFecha(cultos);
  const secciones = [
    { titulo: "Próximos", listas: proximos },
    { titulo: "Anteriores", listas: pasados },
    { titulo: "Sin fecha", listas: sinFecha },
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
          <button onClick={newList} className="hb-primary" style={emptyBtnPrimary}>
            <Plus size={18} strokeWidth={2.2} />Nueva lista
          </button>
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
        <button onClick={newList} className="hb-primary" style={{ flex: "0 0 auto", height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 15px", borderRadius: 10, background: "var(--primary)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, boxShadow: "var(--sh-sm)", transition: "background .14s" }}>
          <Plus size={16} strokeWidth={2.2} />Nueva lista
        </button>
      </div>

      {repetir.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, margin: "0 0 22px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "12.5px", fontWeight: 600, color: "var(--text-2)" }}>
            <RotateCcw size={14} />Repetir el culto anterior:
          </span>
          {/* The label spells the action out: read aloud, «Servicio dominical
              25 sept» says neither what the button does nor what it copies. */}
          {repetir.map(({ ocasion, lista }) => (
            <button
              key={ocasion}
              onClick={() => duplicateList(lista.id)}
              className="hb-s2"
              title={`Copiar «${lista.nombre}» del ${formatearFechaCorta(lista.fecha)}`}
              aria-label={`Repetir ${ocasion}: copiar «${lista.nombre}» del ${formatearFechaCorta(lista.fecha)}`}
              style={{ display: "flex", alignItems: "center", gap: 7, height: 32, padding: "0 12px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "12.5px", fontWeight: 600 }}
            >
              {ocasion}
              <span style={{ color: "var(--text-3)", fontWeight: 500 }}>{formatearFechaCorta(lista.fecha)}</span>
            </button>
          ))}
        </div>
      )}

      {secciones.map(({ titulo, listas }) => (
        <div key={titulo} style={{ marginBottom: 26 }}>
          {mostrarTitulos && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: titulo === "Próximos" ? "var(--primary)" : "var(--text-3)" }}>
                {titulo}
              </span>
              <span style={{ fontSize: "11.5px", color: "var(--text-3)" }}>{listas.length}</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
          )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(196px,1fr))", gap: 18 }}>
        {listas.map((p) => {
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
                {p.plantilla && (
                  <div title="Plantilla" style={{ position: "absolute", right: 9, top: 9, display: "grid", placeItems: "center", width: 22, height: 22, background: "rgba(20,14,9,.42)", backdropFilter: "blur(4px)", color: "#fff", borderRadius: 6 }}>
                    <Layers size={12} />
                  </div>
                )}
              </div>
              <div style={{ padding: "12px 4px 4px" }}>
                <div style={{ fontSize: "14.5px", fontWeight: 700, letterSpacing: "-.1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nombre}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, color: "var(--text-2)" }}>
                  {p.plantilla ? <Layers size={13} style={{ flex: "0 0 auto" }} /> : <Calendar size={13} style={{ flex: "0 0 auto" }} />}
                  <span style={{ fontSize: "11.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.plantilla ? "Plantilla" : formatearFechaCorta(p.fecha) || "Sin fecha"}
                  </span>
                </div>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(196px,1fr))", gap: 18 }}>
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
