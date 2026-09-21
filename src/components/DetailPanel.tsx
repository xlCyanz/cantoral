import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronDown, FileText, FolderOpen, ListMusic, Play, Save, Search, SquareArrowOutUpRight, Tag, Trash2, TriangleAlert, X } from "lucide-react";
import { ocasiones, useStore } from "../store";
import type { SaveState } from "../store";
import { coverStyle, hasCover } from "../lib/covers";
import { gestorDeArchivos } from "../lib/api";
import type { Track } from "../lib/types";

const labelStyle: CSSProperties = { display: "block", fontSize: "11.5px", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 };
const fieldStyle: CSSProperties = { width: "100%", height: 38, border: "1px solid var(--border-2)", background: "var(--surface-2)", borderRadius: 9, fontSize: "13.5px", fontWeight: 600, color: "var(--text)", outline: "none" };
const sectionLabel: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--text-3)" };

/** Latin note names, the notation the rest of the app already uses ("Sol", "Lam"). */
const TONOS = [
  "Do", "Dom", "Do#", "Reb", "Re", "Rem", "Re#", "Mib", "Mibm", "Mi", "Mim",
  "Fa", "Fam", "Fa#", "Solb", "Sol", "Solm", "Sol#", "Lab", "La", "Lam",
  "La#", "Sib", "Sibm", "Si", "Sim",
];

/** What the footer shows for each phase of an edit writing itself. */
const ESTADO: Record<SaveState, { icono: ReactNode; texto: string; color: string }> = {
  idle: { icono: <Save size={14} strokeWidth={2} color="var(--text-3)" />, texto: "Los cambios se guardan solos", color: "var(--text-3)" },
  saving: { icono: <Save size={14} strokeWidth={2.2} color="var(--text-2)" />, texto: "Guardando…", color: "var(--text-2)" },
  saved: { icono: <Check size={15} strokeWidth={2.6} color="var(--success)" />, texto: "Guardado", color: "var(--success)" },
  error: { icono: <TriangleAlert size={15} strokeWidth={2.2} color="var(--danger)" />, texto: "No se pudo guardar", color: "var(--danger)" },
};

/** Occasions worth suggesting even before any track carries one. */
const OCASIONES_SUGERIDAS = ["Adoración", "Alabanza", "Comunión", "Ofrenda", "Reflexión", "Navidad", "Resurrección"];

function BigCoverInner({ t }: { t: Track }) {
  if (hasCover(t)) return null;
  if (t.missing)
    return <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.92)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 40, height: 40 }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
  if (t.video)
    return <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.92)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 44, height: 44 }}><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 40, height: 40 }}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
}

export default function DetailPanel() {
  const [listMenu, setListMenu] = useState(false);
  // Field by field: the panel sits beside a player that writes `posSec`
  // several times a second, and none of what it shows changes with it.
  const detailOpen = useStore((s) => s.detailOpen);
  const sel = useStore((s) => (s.selId ? (s.tracks.find((t) => t.id === s.selId) ?? null) : null));
  const playlists = useStore((s) => s.playlists);
  const plOrder = useStore((s) => s.plOrder);
  const tagDraft = useStore((s) => s.tagDraft);
  const saveState = useStore((s) => s.saveState);
  const ocasionesDelCatalogo = useStore(ocasiones);

  const closeDetail = useStore((s) => s.closeDetail);
  const relocateTrack = useStore((s) => s.relocateTrack);
  const deleteTrack = useStore((s) => s.deleteTrack);
  const play = useStore((s) => s.play);
  const onOpenExternal = useStore((s) => s.onOpenExternal);
  const addToList = useStore((s) => s.addToList);
  const setEdit = useStore((s) => s.setEdit);
  const onTagDraft = useStore((s) => s.onTagDraft);
  const addTag = useStore((s) => s.addTag);
  const removeTag = useStore((s) => s.removeTag);
  const revealTrack = useStore((s) => s.revealTrack);
  const openSheetEditor = useStore((s) => s.openSheetEditor);

  if (!detailOpen || !sel) return null;

  // The catalogue's own occasions first, then the defaults it has not used yet.
  const sugerenciasDeOcasion = [
    ...new Set([...ocasionesDelCatalogo, ...OCASIONES_SUGERIDAS]),
  ];

  // The real path the backend indexed. This used to be assembled from the
  // folder's name, the track's *title tag* and the format — so a file whose tag
  // differed from its filename got a path that did not exist, and the separator
  // was a hardcoded backslash on every platform.
  const ruta = sel.path ?? "";
  const tags = sel.tags || [];


  return (
    <aside style={{ width: 360, flex: "0 0 auto", background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 0, animation: "canPanel .26s cubic-bezier(.22,1,.36,1)", boxShadow: "-8px 0 24px rgba(30,22,14,.05)" }}>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 14px 12px", borderBottom: "1px solid var(--border)" }}>
        <span style={sectionLabel}>Detalle de pista</span>
        <button onClick={closeDetail} title="Cerrar" className="hb-s2t" style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--text-2)" }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 22px" }}>
        {/* cover + primary meta */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 20 }}>
          <div style={coverStyle(sel, 96)}><BigCoverInner t={sel} /></div>
          <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.2px", margin: "16px 0 3px", textWrap: "balance" } as CSSProperties}>{sel.titulo}</h2>
          <p style={{ fontSize: "13.5px", color: "var(--text-2)", margin: 0 }}>{sel.artista}</p>

          {sel.missing && (
            <div style={{ marginTop: 12, width: "100%", background: "var(--danger-soft)", color: "var(--danger)", padding: "10px 12px", borderRadius: 10, fontSize: "12.5px", fontWeight: 500, textAlign: "left", lineHeight: 1.35 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26, flex: "0 0 auto" }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                El archivo no se encuentra en el disco. Búscalo para que la pista conserve sus etiquetas.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => relocateTrack(sel.id)}
                  style={{ flex: 1, height: 34, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 9, background: "var(--danger)", color: "var(--on-danger)", fontSize: "12.5px", fontWeight: 600, transition: "filter .14s" }}
                  className="hb-danger-solid"
                >
                  <Search size={14} strokeWidth={2.4} />Localizar…
                </button>
                <button
                  onClick={() => deleteTrack(sel.id)}
                  title="Quitar de la biblioteca"
                  style={{ height: 34, padding: "0 12px", display: "flex", alignItems: "center", gap: 7, borderRadius: 9, border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", fontSize: "12.5px", fontWeight: 600 }}
                >
                  <Trash2 size={14} strokeWidth={2.2} />Quitar
                </button>
              </div>
            </div>
          )}
          {sel.video && !sel.missing && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 9, background: "var(--surface-2)", color: "var(--text-2)", padding: "9px 12px", borderRadius: 10, fontSize: "12.5px", fontWeight: 500, textAlign: "left", lineHeight: 1.35, border: "1px solid var(--border)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26, flex: "0 0 auto" }}><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>
              Los videos se abren en el reproductor predeterminado del sistema, no dentro de la app.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16, width: "100%" }}>
            <button onClick={() => play(sel.id)} className="hb-primary" style={{ flex: 1, height: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, background: "var(--primary)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, transition: "background .14s" }}>
              {sel.video ? <SquareArrowOutUpRight size={15} /> : <Play size={15} fill="currentColor" stroke="none" />}
              {sel.video ? "Abrir video" : "Reproducir"}
            </button>
            <button onClick={() => onOpenExternal(sel.id)} title="Abrir en el reproductor del sistema" className="hb-s2t" style={{ width: 44, height: 40, display: "grid", placeItems: "center", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text-2)" }}>
              <SquareArrowOutUpRight size={16} />
            </button>
          </div>
        </div>

        {/* add to a playlist */}
        {playlists.length > 0 && (
          <div style={{ marginBottom: 16, position: "relative" }}>
            <label style={labelStyle}>Agregar a una lista</label>
            <button
              onClick={() => setListMenu((v) => !v)}
              className="hb-s3"
              style={{ ...fieldStyle, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", cursor: "pointer", color: "var(--text-2)" }}
            >
              <span>Elegir lista…</span>
              <ChevronDown size={14} style={{ color: "var(--text-3)", transform: listMenu ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
            </button>
            {listMenu && (
              <>
                <div onClick={() => setListMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 21, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, boxShadow: "var(--sh-md)", padding: 5, maxHeight: 220, overflowY: "auto" }}>
                  {playlists.map((p) => {
                    const inList = (plOrder[p.id] || []).includes(sel.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => { addToList(p.id, sel.id); setListMenu(false); }}
                        className="hb-s2"
                        style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 10px", borderRadius: 8, fontSize: 13, fontWeight: 500, textAlign: "left", color: "var(--text)" }}
                      >
                        <ListMusic size={15} style={{ color: "var(--text-3)", flex: "0 0 auto" }} />
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nombre}</span>
                        {inList && <Check size={14} strokeWidth={2.4} style={{ color: "var(--primary)", flex: "0 0 auto" }} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* datos del culto: lo que el equipo necesita saber de un vistazo */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...sectionLabel, marginBottom: 9 }}>Datos del culto</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label htmlFor="det-tono" style={labelStyle}>Tono</label>
              <input
                id="det-tono"
                value={sel.tono}
                onChange={(e) => setEdit("tono", e.target.value)}
                list="tonos-musicales"
                placeholder="Sol"
                className="in-focus"
                style={{ ...fieldStyle, padding: "0 12px" }}
              />
              <datalist id="tonos-musicales">
                {TONOS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div style={{ width: 96, flex: "0 0 auto" }}>
              <label htmlFor="det-bpm" style={labelStyle}>Tempo</label>
              <input
                id="det-bpm"
                type="number"
                min={0}
                max={400}
                inputMode="numeric"
                value={sel.bpm || ""}
                // Rust takes an i64, so this has to leave the field as a number.
                onChange={(e) => setEdit("bpm", Math.max(0, Math.min(400, Number(e.target.value) || 0)))}
                placeholder="BPM"
                className="in-focus"
                style={{ ...fieldStyle, padding: "0 10px" }}
              />
            </div>
          </div>
          <div>
            <label htmlFor="det-ocasion" style={labelStyle}>Ocasión</label>
            <input
              id="det-ocasion"
              value={sel.ocasion}
              onChange={(e) => setEdit("ocasion", e.target.value)}
              list="ocasiones-pista"
              placeholder="Adoración"
              className="in-focus"
              style={{ ...fieldStyle, fontWeight: 500, padding: "0 12px" }}
            />
            <datalist id="ocasiones-pista">
              {sugerenciasDeOcasion.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
        </div>

        {/* tags */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ ...labelStyle, marginBottom: 7 }}>Etiquetas</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {tags.map((tag) => (
              <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 27, padding: "0 6px 0 10px", borderRadius: 8, background: "var(--primary-soft)", color: "var(--primary)", fontSize: 12, fontWeight: 600 }}>
                {tag}
                <button onClick={() => removeTag(tag)} className="hb-primsoft2" style={{ width: 17, height: 17, borderRadius: 5, display: "grid", placeItems: "center", color: "var(--primary)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" style={{ width: 10, height: 10 }}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </span>
            ))}
            {tags.length === 0 && <span style={{ fontSize: 12, color: "var(--text-3)", padding: "4px 0" }}>Sin etiquetas todavía</span>}
          </div>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Tag size={14} style={{ position: "absolute", left: 11, color: "var(--text-3)", pointerEvents: "none" }} />
            <input
              value={tagDraft}
              onChange={(e) => onTagDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addTag(tagDraft); }}
              placeholder="Agregar etiqueta y Enter…"
              className="in-focus"
              style={{ width: "100%", height: 36, border: "1px solid var(--border-2)", background: "var(--surface)", borderRadius: 9, padding: "0 12px 0 32px", fontSize: 13, outline: "none" }}
            />
          </div>
        </div>

        {/* letra y acordes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ ...labelStyle, marginBottom: 7 }}>Letra y acordes</label>
          <button
            onClick={() => openSheetEditor(sel.id)}
            className="hb-s2"
            style={{ width: "100%", height: 38, display: "flex", alignItems: "center", gap: 9, padding: "0 12px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text)", fontSize: "13px", fontWeight: 600 }}
          >
            <FileText size={15} color={sel.tieneHoja ? "var(--primary)" : "var(--text-3)"} />
            {sel.tieneHoja ? "Editar la hoja" : "Escribir la letra"}
            <div style={{ flex: 1 }} />
            {sel.tieneHoja && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>ESCRITA</span>
            )}
          </button>
        </div>

        {/* file info */}
        <div style={{ ...sectionLabel, marginBottom: 9 }}>Información del archivo</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 13 }}>
          <InfoRow label="Álbum" value={sel.album} />
          <InfoRow label="Duración" value={sel.dur} mono />
          <InfoRow label="Formato" value={sel.formato} />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0" }}>
            <span style={{ color: "var(--text-2)", flex: "0 0 auto" }}>Ubicación</span>
            <span title={ruta} style={{ fontWeight: 500, fontFamily: "ui-monospace,monospace", fontSize: 11, textAlign: "right", wordBreak: "break-all", color: "var(--text-2)" }}>
              {ruta || "—"}
            </span>
          </div>
          {ruta && (
            <button
              onClick={() => revealTrack(sel.id)}
              className="hb-s2"
              style={{ marginTop: 8, height: 34, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text-2)", fontSize: "12.5px", fontWeight: 600 }}
            >
              <FolderOpen size={14} />Mostrar en {gestorDeArchivos()}
            </button>
          )}
        </div>
      </div>

      {/*
        No save button: an edit writes itself, so there is nothing to press. The
        footer reports what the store is actually doing instead — the panel used
        to claim «Guardado automático» while nothing of the sort happened.
      */}
      <div style={{ flex: "0 0 auto", borderTop: "1px solid var(--border)", padding: "13px 16px", display: "flex", alignItems: "center", gap: 8 }} aria-live="polite">
        {ESTADO[saveState].icono}
        <span style={{ fontSize: "12.5px", fontWeight: saveState === "idle" ? 400 : 600, color: ESTADO[saveState].color }}>
          {ESTADO[saveState].texto}
        </span>
      </div>
    </aside>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--text-2)" }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right", ...(mono ? { fontVariantNumeric: "tabular-nums" } : {}) }}>{value}</span>
    </div>
  );
}
