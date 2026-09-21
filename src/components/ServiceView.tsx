import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Type, X } from "lucide-react";
import { useStore } from "../store";
import { transponerTono, usaBemoles } from "../lib/chords";
import { parseHoja } from "../lib/chords";

const boton: CSSProperties = {
  height: 34,
  minWidth: 34,
  padding: "0 10px",
  borderRadius: 9,
  border: "1px solid var(--border-2)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "12.5px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const etiqueta: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".5px",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

/**
 * The sheet as it is read from the stand: chords over the syllable they fall
 * on, sections marked, everything sized by one multiplier the user controls.
 */
function Hoja({ acordes, letra, escala, semitonos, bemoles }: {
  acordes: string;
  letra: string;
  escala: number;
  semitonos: number;
  bemoles: boolean;
}) {
  if (!acordes.trim()) {
    if (!letra.trim()) return null;
    // Lyrics with nobody's chords: still worth reading, just plainer.
    return (
      <div style={{ fontSize: 20 * escala, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{letra}</div>
    );
  }
  const lineas = parseHoja(acordes, semitonos, bemoles);
  return (
    <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 19 * escala, lineHeight: 1.3 }}>
      {lineas.map((linea, i) => {
        if (linea.tipo === "vacia") return <div key={i} style={{ height: 20 * escala }} />;
        if (linea.tipo === "seccion") {
          return (
            <div
              key={i}
              style={{
                fontFamily: "inherit",
                fontSize: 14 * escala,
                fontWeight: 700,
                letterSpacing: ".6px",
                textTransform: "uppercase",
                color: "var(--primary)",
                margin: `${22 * escala}px 0 ${6 * escala}px`,
              }}
            >
              {linea.etiqueta}
            </div>
          );
        }
        return (
          <div key={i} style={{ display: "flex", flexWrap: "wrap", marginBottom: 4 * escala }}>
            {linea.segmentos.map((seg, j) => (
              <span key={j} style={{ display: "inline-block", whiteSpace: "pre" }}>
                <span style={{ display: "block", fontWeight: 700, color: "var(--primary)", minHeight: "1.25em" }}>
                  {seg.acorde}
                </span>
                <span style={{ display: "block" }}>{seg.texto}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Full-screen view of the open service list, for the music stand.
 *
 * It is the same journey the playlist already describes — the songs in the
 * order they will be sung — with the one thing the app could not show until
 * now on screen, and in the key the group is singing it in this week.
 */
export default function ServiceView() {
  const abierto = useStore((s) => s.serviceOpen);
  const orden = useStore((s) => s.plOrder[s.curPlaylist]);
  const idx = useStore((s) => s.serviceIdx);
  const semitonos = useStore((s) => s.serviceSemitones);
  const escala = useStore((s) => s.serviceScale);
  const lista = useStore((s) => s.playlists.find((p) => p.id === s.curPlaylist));
  const pista = useStore((s) => {
    const ids = s.plOrder[s.curPlaylist] || [];
    const id = ids[s.serviceIdx];
    return id ? s.tracks.find((t) => t.id === id) : undefined;
  });
  const hoja = useStore((s) => {
    const ids = s.plOrder[s.curPlaylist] || [];
    const id = ids[s.serviceIdx];
    return id ? s.sheets[id] : undefined;
  });
  const closeService = useStore((s) => s.closeService);
  const serviceGo = useStore((s) => s.serviceGo);
  const transposeService = useStore((s) => s.transposeService);
  const scaleService = useStore((s) => s.scaleService);
  const openSheetEditor = useStore((s) => s.openSheetEditor);

  if (!abierto || !pista) return null;
  const total = orden?.length ?? 0;
  const tonoOriginal = pista.tono?.trim() ?? "";
  const tonoActual = semitonos ? transponerTono(tonoOriginal, semitonos) : tonoOriginal;
  // The sheet is spelled for the key it is being read in, not the one it was
  // written in: «Sol#» in a flat key is a translation the player has to do.
  const bemoles = usaBemoles(tonoActual || tonoOriginal);
  const letra = hoja?.letra ?? "";
  const acordes = hoja?.acordes ?? "";
  const vacia = !letra.trim() && !acordes.trim();

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "var(--bg)", color: "var(--text)", display: "flex", flexDirection: "column", animation: "canFade .2s ease" }}>
      <header style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={etiqueta}>
            {lista?.nombre} · {idx + 1} de {total}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.3px", margin: "3px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {pista.titulo}
          </h1>
          <div style={{ fontSize: "13.5px", color: "var(--text-2)" }}>{pista.artista}</div>
        </div>

        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 8, borderRight: "1px solid var(--border)" }}>
            <span style={etiqueta}>Tono</span>
            <button onClick={() => transposeService(-1)} title="Bajar medio tono" aria-label="Bajar medio tono" className="hb-s2" style={boton}>
              <Minus size={15} />
            </button>
            <span
              aria-live="polite"
              style={{ minWidth: 58, textAlign: "center", fontSize: 15, fontWeight: 700, color: semitonos ? "var(--primary)" : "var(--text)" }}
            >
              {tonoActual || "—"}
            </span>
            <button onClick={() => transposeService(1)} title="Subir medio tono" aria-label="Subir medio tono" className="hb-s2" style={boton}>
              <Plus size={15} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 8, borderRight: "1px solid var(--border)" }}>
            <Type size={15} color="var(--text-3)" />
            <button onClick={() => scaleService(-0.1)} title="Achicar la letra" aria-label="Achicar la letra" className="hb-s2" style={boton}>
              <Minus size={15} />
            </button>
            <button onClick={() => scaleService(0.1)} title="Agrandar la letra" aria-label="Agrandar la letra" className="hb-s2" style={boton}>
              <Plus size={15} />
            </button>
          </div>

          <button onClick={closeService} title="Salir del modo culto (Esc)" aria-label="Salir del modo culto" className="hb-s2" style={boton}>
            <X size={16} />Salir
          </button>
        </div>
      </header>

      <main style={{ flex: 1, overflowY: "auto", padding: "26px 32px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {semitonos !== 0 && tonoOriginal && (
            <div style={{ ...etiqueta, marginBottom: 14, color: "var(--primary)" }}>
              Transpuesto desde {tonoOriginal} · {semitonos > 0 ? `+${semitonos}` : semitonos} semitonos
            </div>
          )}
          {vacia ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <p style={{ fontSize: 17, color: "var(--text-2)", margin: "0 0 18px" }}>
                Esta pista todavía no tiene letra ni acordes escritos.
              </p>
              <button
                onClick={() => openSheetEditor(pista.id)}
                className="hb-primary"
                style={{ height: 40, padding: "0 18px", borderRadius: 10, background: "var(--primary)", color: "var(--on-primary)", fontSize: 14, fontWeight: 600 }}
              >
                Escribirla ahora
              </button>
            </div>
          ) : (
            <Hoja acordes={acordes} letra={letra} escala={escala} semitonos={semitonos} bemoles={bemoles} />
          )}
        </div>
      </main>

      <footer style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
        <button onClick={() => serviceGo(-1)} disabled={idx === 0} className="hb-s2" style={{ ...boton, height: 40, padding: "0 16px", opacity: idx === 0 ? 0.45 : 1 }}>
          <ChevronLeft size={17} />Anterior
        </button>
        <div style={{ flex: 1, textAlign: "center", ...etiqueta }}>
          Usa ← → para cambiar de canción y + − para el tono
        </div>
        <button onClick={() => serviceGo(1)} disabled={idx >= total - 1} className="hb-s2" style={{ ...boton, height: 40, padding: "0 16px", opacity: idx >= total - 1 ? 0.45 : 1 }}>
          Siguiente<ChevronRight size={17} />
        </button>
      </footer>
    </div>
  );
}
