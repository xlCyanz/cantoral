import type { CSSProperties } from "react";
import { Check, ChevronDown, Play, Save, Settings, SquareArrowOutUpRight, Tag, X } from "lucide-react";
import { eff, useStore } from "../store";
import { coverStyle } from "../lib/covers";
import { OCASIONES, TONOS } from "../lib/seed";
import type { Track } from "../lib/types";

const labelStyle: CSSProperties = { display: "block", fontSize: "11.5px", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 };
const fieldStyle: CSSProperties = { width: "100%", height: 38, border: "1px solid var(--border-2)", background: "var(--surface-2)", borderRadius: 9, fontSize: "13.5px", fontWeight: 600, color: "var(--text)", outline: "none" };
const sectionLabel: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--text-3)" };

function BigCoverInner({ t }: { t: Track }) {
  if (t.missing)
    return <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.92)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 40, height: 40 }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
  if (t.video)
    return <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.92)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 44, height: 44 }}><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ width: 40, height: 40 }}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
}

export default function DetailPanel() {
  const s = useStore();
  const sel = s.selId ? eff(s, s.tracks.find((t) => t.id === s.selId)!) : null;
  if (!s.detailOpen || !sel) return null;

  const folder = s.folders.find((f) => f.nombre === sel.carpeta);
  const ruta = (folder ? folder.ruta : "") + "\\" + sel.titulo + "." + (sel.formato || "").toLowerCase();
  const tags = sel.tags || [];

  const saveBtnStyle: CSSProperties = {
    flex: 1,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    fontSize: "13.5px",
    fontWeight: 600,
    transition: "all .14s",
    ...(s.saved ? { background: "var(--success-soft)", color: "var(--success)" } : { background: "var(--primary)", color: "var(--on-primary)" }),
  };

  return (
    <aside style={{ width: 360, flex: "0 0 auto", background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 0, animation: "canPanel .26s cubic-bezier(.22,1,.36,1)", boxShadow: "-8px 0 24px rgba(30,22,14,.05)" }}>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 14px 12px", borderBottom: "1px solid var(--border)" }}>
        <span style={sectionLabel}>Detalle de pista</span>
        <button onClick={s.closeDetail} title="Cerrar" className="hb-s2t" style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--text-2)" }}>
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
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, background: "var(--danger-soft)", color: "var(--danger)", padding: "8px 12px", borderRadius: 10, fontSize: "12.5px", fontWeight: 500, textAlign: "left", lineHeight: 1.35 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26, flex: "0 0 auto" }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
              El archivo no se encuentra en el disco. Vuelve a indexar la carpeta o localízalo manualmente.
            </div>
          )}
          {sel.video && !sel.missing && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 9, background: "var(--surface-2)", color: "var(--text-2)", padding: "9px 12px", borderRadius: 10, fontSize: "12.5px", fontWeight: 500, textAlign: "left", lineHeight: 1.35, border: "1px solid var(--border)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26, flex: "0 0 auto" }}><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>
              Los videos se abren en el reproductor predeterminado del sistema, no dentro de la app.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16, width: "100%" }}>
            <button onClick={() => s.play(sel.id)} className="hb-primary" style={{ flex: 1, height: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, background: "var(--primary)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, transition: "background .14s" }}>
              {sel.video ? <SquareArrowOutUpRight size={15} /> : <Play size={15} fill="currentColor" stroke="none" />}
              {sel.video ? "Abrir video" : "Reproducir"}
            </button>
            <button onClick={() => s.onOpenExternal(sel.id)} title="Abrir en el reproductor del sistema" className="hb-s2t" style={{ width: 44, height: 40, display: "grid", placeItems: "center", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text-2)" }}>
              <SquareArrowOutUpRight size={16} />
            </button>
          </div>
        </div>

        {/* church fields */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 12px" }}>
          <Settings size={14} color="var(--text-3)" />
          <span style={sectionLabel}>Datos de la iglesia</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Tono</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <select value={sel.tono} onChange={(e) => s.setEdit("tono", e.target.value)} className="in-focus" style={{ ...fieldStyle, appearance: "none", padding: "0 28px 0 12px", cursor: "pointer" }}>
                {TONOS.map((tn) => <option key={tn} value={tn}>{tn}</option>)}
              </select>
              <ChevronDown size={13} style={{ position: "absolute", right: 10, color: "var(--text-3)", pointerEvents: "none" }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Tempo (BPM)</label>
            <input type="number" value={sel.bpm} onChange={(e) => s.setEdit("bpm", Number(e.target.value) || 0)} className="in-focus" style={{ ...fieldStyle, padding: "0 12px", MozAppearance: "textfield" } as CSSProperties} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Ocasión</label>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <select value={sel.ocasion} onChange={(e) => s.setEdit("ocasion", e.target.value)} className="in-focus" style={{ ...fieldStyle, fontWeight: 500, appearance: "none", padding: "0 28px 0 12px", cursor: "pointer" }}>
              {OCASIONES.map((oc) => <option key={oc} value={oc}>{oc}</option>)}
            </select>
            <ChevronDown size={13} style={{ position: "absolute", right: 10, color: "var(--text-3)", pointerEvents: "none" }} />
          </div>
        </div>

        {/* tags */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ ...labelStyle, marginBottom: 7 }}>Etiquetas</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {tags.map((tag) => (
              <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 27, padding: "0 6px 0 10px", borderRadius: 8, background: "var(--primary-soft)", color: "var(--primary)", fontSize: 12, fontWeight: 600 }}>
                {tag}
                <button onClick={() => s.removeTag(tag)} className="hb-primsoft2" style={{ width: 17, height: 17, borderRadius: 5, display: "grid", placeItems: "center", color: "var(--primary)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" style={{ width: 10, height: 10 }}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </span>
            ))}
            {tags.length === 0 && <span style={{ fontSize: 12, color: "var(--text-3)", padding: "4px 0" }}>Sin etiquetas todavía</span>}
          </div>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Tag size={14} style={{ position: "absolute", left: 11, color: "var(--text-3)", pointerEvents: "none" }} />
            <input
              value={s.tagDraft}
              onChange={(e) => s.onTagDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") s.addTag(s.tagDraft); }}
              placeholder="Agregar etiqueta y Enter…"
              className="in-focus"
              style={{ width: "100%", height: 36, border: "1px solid var(--border-2)", background: "var(--surface)", borderRadius: 9, padding: "0 12px 0 32px", fontSize: 13, outline: "none" }}
            />
          </div>
        </div>

        {/* file info */}
        <div style={{ ...sectionLabel, marginBottom: 9 }}>Información del archivo</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, fontSize: 13 }}>
          <InfoRow label="Álbum" value={sel.album} />
          <InfoRow label="Duración" value={sel.dur} mono />
          <InfoRow label="Formato" value={sel.formato} />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0" }}>
            <span style={{ color: "var(--text-2)", flex: "0 0 auto" }}>Ubicación</span>
            <span style={{ fontWeight: 500, fontFamily: "ui-monospace,monospace", fontSize: 11, textAlign: "right", wordBreak: "break-all", color: "var(--text-2)" }}>{ruta}</span>
          </div>
        </div>
      </div>

      <div style={{ flex: "0 0 auto", borderTop: "1px solid var(--border)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={s.saveDetail} style={saveBtnStyle}>
          {s.saved ? <Check size={15} strokeWidth={2.2} /> : <Save size={15} strokeWidth={2.2} />}
          {s.saved ? "Guardado" : "Guardar cambios"}
        </button>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>Guardado automático</span>
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
