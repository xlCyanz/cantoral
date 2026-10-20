import { FileInput, ListMusic, Plus } from "lucide-react";
import { cultos as cultosPorUso, plDur, resumenDeOrden, useStore } from "../store";
import { gradientFor, inicialDe } from "../lib/covers";
import { botonPrimario, botonSecundario, emptyBtnPrimary, emptyBtnSecondary } from "../lib/styles";
import Empty from "./Empty";

export default function CollectionsView() {
  const playlists = useStore((s) => s.playlists);
  const plOrder = useStore((s) => s.plOrder);
  const openPlaylist = useStore((s) => s.openPlaylist);
  const newList = useStore((s) => s.newList);
  const tracks = useStore((s) => s.tracks);
  const importList = useStore((s) => s.importList);

  // Un culto no tiene fecha: es una lista preparada para darle y que corra.
  // Sale arriba el último que se abrió o se cambió, que es el que se está
  // preparando.
  const cultos = useStore(cultosPorUso);

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
          <button onClick={importList} className="hb-s2" title="Abrir una lista exportada desde otra instalación" style={botonSecundario(38)}>
            <FileInput size={16} />Importar lista
          </button>
          <button onClick={newList} className="hb-primary" style={botonPrimario(38)}>
            <Plus size={16} strokeWidth={2.2} />Nueva lista
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(184px,1fr))", gap: 12 }}>
        {cultos.map((p) => {
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
              </div>
              <div style={{ padding: "9px 10px 10px" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nombre}</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-3)", marginTop: 3, fontWeight: 500 }}>
                  {resumenDeOrden(ids)} · {plDur({ tracks }, ids)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
