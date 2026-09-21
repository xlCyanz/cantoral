import { useState } from "react";
import type { CSSProperties } from "react";
import { Check, Copy, Heart, Search, TriangleAlert } from "lucide-react";
import { useStore } from "../store";
import type { DuplicateGroup } from "../lib/api";

/** Bytes as something a person can compare at a glance. */
export function tamano(bytes: number): string {
  if (bytes <= 0) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return mb < 100 ? `${mb.toFixed(1).replace(".", ",")} MB` : `${Math.round(mb)} MB`;
}

/** Why a group was put together, in words rather than a field name. */
export function motivoEnPalabras(motivo: string): string {
  return motivo === "archivo" ? "Mismo archivo" : "Mismo título";
}

const h2Style: CSSProperties = { fontSize: "15.5px", fontWeight: 700, margin: "0 0 3px" };
const pStyle: CSSProperties = { fontSize: "12.5px", color: "var(--text-2)", margin: 0, lineHeight: 1.5 };
const badge: CSSProperties = {
  flex: "0 0 auto",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".3px",
  textTransform: "uppercase",
  color: "var(--text-2)",
  background: "var(--surface-3)",
  padding: "2px 7px",
  borderRadius: 5,
};

/**
 * One group, with its own choice of which copy stays.
 *
 * The choice lives here rather than in the store because it is a question, not
 * a fact about the library — and it is keyed on the group's signature by the
 * caller, so a refreshed list comes back with the backend's suggestion again
 * instead of a stale pick.
 */
function Grupo({ grupo }: { grupo: DuplicateGroup }) {
  const [queda, setQueda] = useState(grupo.sugerido);
  const mergeDuplicates = useStore((s) => s.mergeDuplicates);
  const dismissDuplicates = useStore((s) => s.dismissDuplicates);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 13, background: "var(--surface)", padding: "13px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
        <Copy size={15} color="var(--text-3)" style={{ flex: "0 0 auto" }} />
        <span style={{ fontSize: "13.5px", fontWeight: 600, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {grupo.tracks[0]?.titulo}
        </span>
        <span style={badge}>{motivoEnPalabras(grupo.motivo)}</span>
        <div style={{ flex: 1 }} />
        <span style={{ flex: "0 0 auto", fontSize: "11.5px", color: "var(--text-3)" }}>{grupo.tracks.length} copias</span>
      </div>

      {grupo.tracks.map((t) => (
        <label
          key={t.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "9px 10px",
            borderRadius: 10,
            cursor: "pointer",
            background: t.id === queda ? "var(--primary-soft)" : "transparent",
            marginBottom: 4,
          }}
        >
          <input
            type="radio"
            name={`dup-${grupo.signature}`}
            checked={t.id === queda}
            onChange={() => setQueda(t.id)}
            style={{ marginTop: 2, accentColor: "var(--primary)", flex: "0 0 auto" }}
          />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: "12.5px", fontWeight: 600 }}>{t.formato}</span>
              <span style={{ fontSize: "12.5px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{t.dur}</span>
              <span style={{ fontSize: "12.5px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{tamano(t.fsize)}</span>
              <span style={{ fontSize: "12.5px", color: "var(--text-3)" }}>{t.carpeta}</span>
              {t.fav && <Heart size={12} fill="currentColor" color="var(--primary)" />}
              {t.missing && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "var(--danger)", background: "var(--danger-soft)", padding: "1px 6px", borderRadius: 5 }}>
                  <TriangleAlert size={10} />Sin archivo
                </span>
              )}
              {t.id === grupo.sugerido && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "var(--primary)" }}>
                  <Check size={11} strokeWidth={3} />Sugerida
                </span>
              )}
            </span>
            <span
              title={t.path}
              style={{ display: "block", fontSize: 11, color: "var(--text-3)", fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}
            >
              {t.path}
            </span>
          </span>
        </label>
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 10 }}>
        <button
          onClick={() => mergeDuplicates(grupo.signature, queda)}
          className="hb-primary"
          style={{ height: 34, padding: "0 14px", borderRadius: 9, background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: "12.5px", fontWeight: 600 }}
        >
          Conservar esta y fusionar el resto
        </button>
        <button
          onClick={() => dismissDuplicates(grupo.signature)}
          className="hb-s2"
          style={{ height: 34, padding: "0 13px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "12.5px", fontWeight: 600 }}
        >
          No son duplicadas
        </button>
      </div>
    </div>
  );
}

/** The «Pistas duplicadas» section of Configuración. */
export default function DuplicateGroups() {
  const duplicates = useStore((s) => s.duplicates);
  const dismissed = useStore((s) => s.duplicatesDismissed);
  const estado = useStore((s) => s.duplicatesState);
  const findDuplicates = useStore((s) => s.findDuplicates);
  const restoreDismissed = useStore((s) => s.restoreDismissedDuplicates);

  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 12 }}>
        <div>
          <h2 style={h2Style}>Pistas duplicadas</h2>
          <p style={pStyle}>
            La misma canción suele acabar dos veces en la biblioteca: el MP3 y el WAV, la que bajó cada
            quien en su carpeta. Al fusionarlas, la que se queda hereda las etiquetas, el favorito y el
            sitio en las listas para culto de las demás. Tus archivos no se borran del disco.
          </p>
        </div>
        <button
          onClick={findDuplicates}
          disabled={estado === "buscando"}
          className="hb-s2"
          style={{ flex: "0 0 auto", height: 34, display: "flex", alignItems: "center", gap: 7, padding: "0 13px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "12.5px", fontWeight: 600, opacity: estado === "buscando" ? 0.55 : 1 }}
        >
          <Search size={14} strokeWidth={2.2} />
          {estado === "listo" ? "Buscar otra vez" : "Buscar duplicadas"}
        </button>
      </div>

      {estado === "buscando" && (
        <p style={{ ...pStyle, padding: "14px 0" }}>Comparando tamaños, duraciones y títulos…</p>
      )}

      {estado === "listo" && duplicates.length === 0 && (
        <p style={{ ...pStyle, padding: "14px 15px", border: "1px solid var(--border)", borderRadius: 13, background: "var(--surface)" }}>
          No encontramos pistas duplicadas.
        </p>
      )}

      {duplicates.map((g) => (
        // Keyed on the signature so a refreshed list comes back with the
        // backend's suggestion, not the pick made for a group that changed.
        <Grupo key={g.signature} grupo={g} />
      ))}

      {estado === "listo" && dismissed > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: "11.5px", color: "var(--text-3)" }}>
            {dismissed === 1 ? "1 grupo marcado como «no son duplicadas»" : `${dismissed} grupos marcados como «no son duplicadas»`}
          </span>
          <button onClick={restoreDismissed} className="hb-text" style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--primary)" }}>
            Volver a revisarlos
          </button>
        </div>
      )}
    </div>
  );
}
