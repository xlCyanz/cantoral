import { useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Check, FileText, FolderOpen, Play, Save, Search, Tag, Trash2, TriangleAlert, X } from "lucide-react";
import { etiquetas, ocasiones, useStore } from "../store";
import type { SaveState } from "../store";
import { coverStyle, hasCover } from "../lib/covers";
import { gestorDeArchivos } from "../lib/api";
import { useEstrecho } from "../lib/ventana";
import { useReproductor } from "../lib/media";
import { motivoNoProyectable } from "../lib/formatos";
import { AddToListButton } from "./AddToListDialog";
import type { Track } from "../lib/types";

/**
 * El video de la pista, donde va la carátula de un audio.
 *
 * Aquí y no en la barra del reproductor: un 16:9 no cabe en una barra de 88
 * píxeles, y el panel ya es el sitio donde se mira una pista de cerca. Es
 * además para lo que de verdad se usa entre semana — comprobar que el clip es
 * el correcto antes del domingo—, no para proyectarlo: eso lo hace la ventana
 * de salida, que sí ocupa la pantalla entera.
 *
 * Sin `controls`: el transporte es el de la barra de abajo, el mismo que el
 * del audio. Dos juegos de controles para una sola pista serían dos sitios
 * donde mirar en qué segundo va.
 */
function VideoDeLaPista({ t }: { t: Track }) {
  const ref = useRef<HTMLVideoElement>(null);
  const esLaQueSuena = useStore((s) => s.playerId) === t.id;
  const manejadores = useReproductor(ref, t, esLaQueSuena);

  return (
    <video
      ref={ref}
      preload="metadata"
      playsInline
      {...manejadores}
      style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 12, background: "#000", objectFit: "contain", border: "1px solid var(--border)" }}
    />
  );
}

// El rediseño aprieta el panel: de 360 px a 300, y de 272 cuando la ventana
// se queda corta. Lo que gana es la tabla que tiene al lado, que es donde se
// arma el culto; el panel se lee de arriba abajo igual con los campos más
// bajos.
const labelStyle: CSSProperties = { display: "block", fontSize: "10.5px", color: "var(--text-2)", marginBottom: 3 };
const fieldStyle: CSSProperties = { width: "100%", height: 28, border: "1px solid var(--border-2)", background: "var(--surface-2)", borderRadius: 6, fontSize: 12, color: "var(--text)", outline: "none" };
const sectionLabel: CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: ".11em", textTransform: "uppercase", color: "var(--text-3)" };


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
  // Field by field: the panel sits beside a player that writes `posSec`
  // several times a second, and none of what it shows changes with it.
  const detailOpen = useStore((s) => s.detailOpen);
  const sel = useStore((s) => (s.selId ? (s.tracks.find((t) => t.id === s.selId) ?? null) : null));
  const playlists = useStore((s) => s.playlists);
  const tagDraft = useStore((s) => s.tagDraft);
  const saveState = useStore((s) => s.saveState);
  const ocasionesDelCatalogo = useStore(ocasiones);
  const todasLasEtiquetas = useStore(etiquetas);

  const closeDetail = useStore((s) => s.closeDetail);
  const relocateTrack = useStore((s) => s.relocateTrack);
  const deleteTrack = useStore((s) => s.deleteTrack);
  const play = useStore((s) => s.play);
  const setEdit = useStore((s) => s.setEdit);
  const onTagDraft = useStore((s) => s.onTagDraft);
  const addTag = useStore((s) => s.addTag);
  const removeTag = useStore((s) => s.removeTag);
  const revealTrack = useStore((s) => s.revealTrack);
  const openSheetEditor = useStore((s) => s.openSheetEditor);
  const detailFijado = useStore((s) => s.detailFijado);
  const toggleDetailFijado = useStore((s) => s.toggleDetailFijado);
  const estrecho = useEstrecho(300);

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
    <aside style={{ width: estrecho ? 272 : 300, flex: "0 0 auto", background: "var(--surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", minHeight: 0, animation: "canPanel .26s cubic-bezier(.22,1,.36,1)", boxShadow: "-8px 0 24px rgba(30,22,14,.05)" }}>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, padding: "9px 10px 9px 12px", borderBottom: "1px solid var(--border)" }}>
        <span style={sectionLabel}>Detalle</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={toggleDetailFijado}
          title={detailFijado ? "Esc ya no cierra el panel" : "Mantener abierto: Esc dejará de cerrarlo"}
          aria-pressed={detailFijado}
          className={detailFijado ? undefined : "hb-s2"}
          style={{ height: 24, padding: "0 9px", borderRadius: 6, border: `1px solid ${detailFijado ? "var(--primary)" : "var(--border-2)"}`, background: detailFijado ? "var(--primary-soft)" : "var(--surface-2)", color: detailFijado ? "var(--primary)" : "var(--text-2)", fontSize: 11, fontWeight: 600 }}
        >
          Fijar
        </button>
        <button onClick={closeDetail} title="Cerrar (Esc)" className="hb-s2" style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text-2)", display: "grid", placeItems: "center" }}>
          <X size={13} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 13px 16px" }}>
        {/* La carátula al lado del título y no encima: apilados se comían un
            tercio del panel antes de llegar al primer dato editable. */}
        <div style={{ marginBottom: 13 }}>
          {sel.video ? (
            <VideoDeLaPista t={sel} />
          ) : (
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <div style={{ ...coverStyle(sel, 74), flex: "0 0 auto" }}><BigCoverInner t={sel} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="display" style={{ fontSize: 19, lineHeight: 1.15, marginBottom: 2, textWrap: "balance" } as CSSProperties}>{sel.titulo}</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-2)" }}>{sel.artista}</div>
              </div>
            </div>
          )}
          {sel.video && (
            <div style={{ marginTop: 9 }}>
              <div className="display" style={{ fontSize: 19, lineHeight: 1.15, marginBottom: 2, textWrap: "balance" } as CSSProperties}>{sel.titulo}</div>
              <div style={{ fontSize: "11.5px", color: "var(--text-2)" }}>{sel.artista}</div>
            </div>
          )}

          {sel.missing && (
            <div style={{ marginTop: 12, width: "100%", background: "var(--danger-soft)", color: "var(--danger)", padding: "10px 12px", borderRadius: 10, fontSize: "12.5px", fontWeight: 500, textAlign: "left", lineHeight: 1.35 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26, flex: "0 0 auto" }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                El archivo no se encuentra en el disco. Búscalo para que la pista conserve sus etiquetas.
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => relocateTrack(sel.id)}
                  style={{ flex: 1, height: 34, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 9, background: "var(--danger-fill)", color: "var(--on-danger)", fontSize: "12.5px", fontWeight: 600, transition: "filter .14s" }}
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
          {/* Un archivo que está en el disco y que la app no puede abrir. Ya no
              hay reproductor del sistema al que mandarlo, así que decirlo aquí
              —con el formato, que es lo que hay que convertir— es todo lo que
              se puede hacer por quien lo tiene en un culto del domingo. */}
          {!sel.missing && motivoNoProyectable(sel) && (
            <div style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", gap: 9, background: "var(--surface-2)", color: "var(--text-2)", padding: "9px 12px", borderRadius: 10, fontSize: "12.5px", fontWeight: 500, textAlign: "left", lineHeight: 1.35, border: "1px solid var(--border)" }}>
              <TriangleAlert size={18} strokeWidth={2} color="var(--text-3)" style={{ flex: "0 0 auto" }} />
              {motivoNoProyectable(sel)}. Conviértelo a MP3 o MP4 y vuelve a escanear la carpeta.
            </div>
          )}

        </div>

        {/* Las dos cosas que se hacen con una pista abierta, en una fila. El
            de agregar abre el mismo diálogo que la barra de selección y el
            menú contextual, que además dice cuántas pistas va a mover. */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button onClick={() => play(sel.id)} className="hb-primary" style={{ flex: 1, minWidth: 0, height: 30, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 7, background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", transition: "background .14s" }}>
            <Play size={13} fill="currentColor" stroke="none" />
            Reproducir
          </button>
          {playlists.length > 0 && (
            <AddToListButton
              className="hb-s3"
              style={{ flex: 1, minWidth: 0, height: 30, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 7, border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
              // Con el panel estrecho, «Agregar a culto…» parte en dos líneas y
              // rompe la fila. Se acorta antes que dejar que la corte.
              label={estrecho ? "Agregar…" : "Agregar a culto…"}
            />
          )}
        </div>

        {/* datos del culto: lo que el equipo necesita saber de un vistazo */}
        <div style={{ marginBottom: 14 }}>
          {/* Artista y ocasión, y nada más: es lo que pide el rediseño. El
              tono y el tempo se editaban aquí y ya no se editan en ningún
              sitio — ver el issue que acompaña a este cambio. */}
          <div style={{ ...sectionLabel, marginBottom: 8 }}>Datos del culto</div>
          {/* El artista, que hasta ahora se leía y no se podía corregir. En una
              biblioteca de iglesia media viene mal en las etiquetas del
              archivo —«Track 03», «Unknown Artist»— y no había dónde
              arreglarlo sin tocar el MP3. */}
          <div style={{ marginBottom: 9 }}>
            <label htmlFor="det-artista" style={labelStyle}>Artista</label>
            <input
              id="det-artista"
              value={sel.artista}
              onChange={(e) => setEdit("artista", e.target.value)}
              placeholder="Coro Congregacional"
              className="in-focus"
              style={{ ...fieldStyle, padding: "0 8px" }}
            />
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
              style={{ ...fieldStyle, padding: "0 8px" }}
            />
            <datalist id="ocasiones-pista">
              {sugerenciasDeOcasion.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
        </div>

        {/* tags */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...sectionLabel, marginBottom: 7 }}>Etiquetas</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {tags.map((tag) => (
              <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 23, padding: "0 4px 0 9px", borderRadius: 12, background: "var(--primary-soft)", color: "var(--primary)", fontSize: 11, fontWeight: 600 }}>
                {tag}
                <button onClick={() => removeTag(tag)} className="hb-primsoft2" style={{ width: 17, height: 17, borderRadius: 5, display: "grid", placeItems: "center", color: "var(--primary)" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" style={{ width: 10, height: 10 }}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </span>
            ))}
            {tags.length === 0 && <span style={{ fontSize: 11, color: "var(--text-3)", padding: "3px 0" }}>Sin etiquetas todavía</span>}
          </div>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Tag size={12} style={{ position: "absolute", left: 9, color: "var(--text-3)", pointerEvents: "none" }} />
            <input
              value={tagDraft}
              onChange={(e) => onTagDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addTag(tagDraft); }}
              placeholder="Añadir y Enter"
              list="etiquetas-existentes"
              className="in-focus"
              style={{ width: "100%", height: 26, border: "1px dashed var(--border-2)", background: "transparent", borderRadius: 13, padding: "0 10px 0 28px", fontSize: 11, outline: "none", color: "var(--text)" }}
            />
            {/* The tags already in use, so a second spelling of one never gets
                invented. Ones this track carries are left out — offering them
                would only invite a no-op. */}
            <datalist id="etiquetas-existentes">
              {todasLasEtiquetas
                .filter((e) => !tags.includes(e.nombre))
                .map((e) => (
                  <option key={e.nombre} value={e.nombre} />
                ))}
            </datalist>
          </div>
        </div>

        {/* Letra y acordes: una línea con su estado a la derecha. Escrita o
            sin escribir es lo único que hace falta saber desde aquí; lo demás
            está dentro del editor. */}
        <button
          onClick={() => openSheetEditor(sel.id)}
          className="hb-s2"
          style={{ width: "100%", height: 32, display: "flex", alignItems: "center", gap: 8, padding: "0 10px", borderRadius: 7, border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12, fontWeight: 600, marginBottom: 14 }}
        >
          <FileText size={13} color={sel.tieneHoja ? "var(--primary)" : "var(--text-3)"} />
          Letra y acordes
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: "10.5px", fontWeight: 600, padding: "2px 7px", borderRadius: 10, background: sel.tieneHoja ? "var(--primary-soft)" : "var(--surface-3)", color: sel.tieneHoja ? "var(--primary)" : "var(--text-3)" }}>
            {sel.tieneHoja ? "escrita" : "sin escribir"}
          </span>
        </button>

        {/* El archivo: lo que hay que saber para encontrarlo, no una ficha
            técnica. El álbum y la duración ya están en la tabla de al lado. */}
        <div style={{ ...sectionLabel, marginBottom: 7 }}>Archivo</div>
        <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.75, marginBottom: 9 }}>
          <div>
            {[sel.formato, sel.album].filter(Boolean).join(" · ") || "—"}
          </div>
          <div title={ruta} style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: "10.5px", color: "var(--text-3)", wordBreak: "break-all" }}>
            {ruta || "sin archivo"}
          </div>
        </div>
        {ruta && (
          <button
            onClick={() => revealTrack(sel.id)}
            className="hb-s2"
            style={{ width: "100%", height: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 7, border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text)", fontSize: "11.5px" }}
          >
            <FolderOpen size={13} />Mostrar en {gestorDeArchivos()}
          </button>
        )}
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

