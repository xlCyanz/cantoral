import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowUpCircle, CircleCheck, Database, Download, Folder, FolderInput, HelpCircle, Plus, RefreshCw, TriangleAlert, X } from "lucide-react";
import { useStore } from "../store";
import { ocupadoStyle } from "../lib/styles";
import DuplicateGroups from "./DuplicateGroups";
import TagManager from "./TagManager";
import { getDbInfo, isMacOS, type DbInfo } from "../lib/api";
import type { ThemeMode } from "../lib/types";

const h2Style: CSSProperties = { fontSize: 15, fontWeight: 700, margin: "0 0 3px" };
const pStyle: CSSProperties = { fontSize: 13, color: "var(--text-2)", margin: 0 };

/** Bytes → human-readable size. */
function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(1) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}

/** RFC3339 → "hoy a las HH:MM" / "ayer…" / "DD/MM/YYYY HH:MM". */
function formatScan(iso: string | undefined): string {
  if (!iso) return "aún sin escanear";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "aún sin escanear";
  const now = new Date();
  const hhmm = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay) return `hoy a las ${hhmm}`;
  if (d.toDateString() === yest.toDateString()) return `ayer a las ${hhmm}`;
  return d.toLocaleDateString("es") + " " + hhmm;
}

const LIGHT_P = { bg: "#f7f8fa", side: "#eef0f4", border: "#e1e5ea", primary: "#3a4d8f", muted: "#cbd1da" };
const DARK_P = { bg: "#14171c", side: "#0f1216", border: "#2c313a", primary: "#8ba1e6", muted: "#3e4552" };

function MiniPreview({ p, half }: { p: typeof LIGHT_P; half?: boolean }) {
  return (
    <div style={{ flex: 1, background: p.bg, display: "flex", overflow: "hidden", height: "100%" }}>
      {!half && <div style={{ width: 22, background: p.side, borderRight: `1px solid ${p.border}` }} />}
      <div style={{ flex: 1, padding: 7 }}>
        <div style={{ width: "62%", height: 6, borderRadius: 3, background: p.primary, marginBottom: 5 }} />
        <div style={{ width: "88%", height: 5, borderRadius: 3, background: p.muted }} />
      </div>
    </div>
  );
}

function ThemeCard({ value, label }: { value: ThemeMode; label: string }) {
  const themeMode = useStore((s) => s.themeMode);
  const setThemeMode = useStore((s) => s.setThemeMode);
  const active = themeMode === value;
  return (
    <button
      onClick={() => setThemeMode(value)}
      style={{ flex: 1, padding: "14px 12px", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transition: "all .14s", cursor: "pointer", border: `1.5px solid ${active ? "var(--primary)" : "var(--border-2)"}`, background: active ? "var(--primary-soft)" : "var(--surface)", color: "var(--text)" }}
    >
      <div style={{ width: "100%", height: 52, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-2)", display: "flex" }}>
        {value === "light" && <MiniPreview p={LIGHT_P} />}
        {value === "dark" && <MiniPreview p={DARK_P} />}
        {value === "system" && (
          <>
            <MiniPreview p={LIGHT_P} half />
            <MiniPreview p={DARK_P} half />
          </>
        )}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

const PEOPLE = [
  { initials: "JS", name: "Johan Sierra Linares", role: "Desarrollo y diseño" },
  { initials: "EL", name: "Eliezer Lorenzo", role: "Colaborador" },
];

export default function ConfigView() {
  const folders = useStore((s) => s.folders);
  const totalTracks = useStore((s) => s.tracks.length);
  const openExt = useStore((s) => s.openExt);
  const openAddFolder = useStore((s) => s.openAddFolder);
  const scanning = useStore((s) => s.scanning);
  const rescanFolder = useStore((s) => s.rescanFolder);
  const relocateFolder = useStore((s) => s.relocateFolder);
  const removeFolder = useStore((s) => s.removeFolder);
  const toggleOpenExt = useStore((s) => s.toggleOpenExt);
  const restore = useStore((s) => s.restore);
  const backup = useStore((s) => s.backup);
  const openHelp = useStore((s) => s.openHelp);

  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  useEffect(() => {
    void getDbInfo().then(setDbInfo);
  }, [folders.length, totalTracks]);

  const lastScan = folders
    .map((f) => f.lastScan)
    .filter((x): x is string => !!x)
    .sort()
    .pop();

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px 44px" }}>
      {/* apariencia */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={h2Style}>Apariencia</h2>
        <p style={{ ...pStyle, marginBottom: 14 }}>Elige cómo se ve Cantoral.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <ThemeCard value="light" label="Claro" />
          <ThemeCard value="dark" label="Oscuro" />
          <ThemeCard value="system" label="Sistema" />
        </div>
      </div>

      {/* carpetas */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 style={h2Style}>Carpetas indexadas</h2>
            <p style={pStyle}>Cantoral revisa estas ubicaciones. Tus archivos nunca se mueven ni se copian. Si una carpeta cambió de sitio, muévela en vez de quitarla: así conserva etiquetas y favoritos.</p>
          </div>
          <button onClick={openAddFolder} disabled={scanning} title={scanning ? "Hay un escaneo en curso" : undefined} className="hb-s2" style={{ flex: "0 0 auto", height: 34, display: "flex", alignItems: "center", gap: 7, padding: "0 13px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "12.5px", fontWeight: 600, ...ocupadoStyle(scanning) }}>
            <Plus size={14} strokeWidth={2.2} />Agregar
          </button>
        </div>
        <div style={{ border: "1px solid var(--border)", borderRadius: 13, overflow: "hidden", background: "var(--surface)" }}>
          {folders.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 14px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-2)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                <Folder size={18} color="var(--text-2)" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "13.5px", fontWeight: 600 }}>{f.nombre}</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-3)", fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.ruta}</div>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 500, flex: "0 0 auto" }}>{f.count} pistas</span>
              <button onClick={() => rescanFolder(f.id)} disabled={scanning} title={scanning ? "Hay un escaneo en curso" : "Volver a escanear"} className="hb-s2t" style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--text-3)", flex: "0 0 auto", ...ocupadoStyle(scanning) }}>
                <RefreshCw size={15} />
              </button>
              <button
                onClick={() => relocateFolder(f.id)}
                title="La carpeta cambió de ubicación: apuntarla al sitio nuevo sin perder etiquetas"
                aria-label={`Mover «${f.nombre}» a otra ubicación`}
                className="hb-s2t"
                style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--text-3)", flex: "0 0 auto" }}
              >
                <FolderInput size={15} />
              </button>
              <button onClick={() => removeFolder(f.id)} title="Quitar carpeta" className="hb-danger" style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", color: "var(--text-3)", flex: "0 0 auto" }}>
                <X size={15} />
              </button>
            </div>
          ))}
          <div style={{ padding: "11px 14px", fontSize: 12, color: "var(--text-3)", background: "var(--surface-2)" }}>
            Última actualización: {formatScan(lastScan)} · {totalTracks} pistas en total
          </div>
        </div>
      </div>

      <TagManager />

      <DuplicateGroups />

      {/* reproduccion */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={{ ...h2Style, marginBottom: 12 }}>Reproducción</h2>
        <label onClick={toggleOpenExt} style={{ display: "flex", alignItems: "center", gap: 14, padding: 15, border: "1px solid var(--border)", borderRadius: 13, background: "var(--surface)", cursor: "pointer" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13.5px", fontWeight: 600 }}>Abrir siempre en el reproductor del sistema</div>
            <div style={{ fontSize: "12.5px", color: "var(--text-2)", marginTop: 2 }}>Al pulsar reproducir, usa la app predeterminada del sistema en vez del reproductor integrado.</div>
          </div>
          <div style={{ width: 42, height: 24, borderRadius: 20, padding: 2, transition: "background .16s", flex: "0 0 auto", cursor: "pointer", background: openExt ? "var(--primary)" : "var(--border-2)" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "transform .16s", transform: `translateX(${openExt ? "18px" : "0px"})` }} />
          </div>
        </label>
      </div>

      {/* base de datos */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={h2Style}>Base de datos</h2>
        <p style={{ ...pStyle, marginBottom: 12 }}>Tu catálogo, listas y etiquetas se guardan en una base local. Haz copias periódicas.</p>
        <div style={{ border: "1px solid var(--border)", borderRadius: 13, background: "var(--surface)", padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--success-soft)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <Database size={20} color="var(--success)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13.5px", fontWeight: 600 }}>cantoral.db</div>
            <div title={dbInfo?.path} style={{ fontSize: 12, color: "var(--text-3)", fontFamily: "ui-monospace,monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {dbInfo ? `${dbInfo.path} · ${formatSize(dbInfo.size)}` : "Base de datos local"}
            </div>
          </div>
          <button onClick={restore} className="hb-s2" style={{ flex: "0 0 auto", height: 36, padding: "0 14px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "12.5px", fontWeight: 600 }}>Restaurar…</button>
          <button onClick={backup} className="hb-primary" style={{ flex: "0 0 auto", height: 36, display: "flex", alignItems: "center", gap: 7, padding: "0 14px", borderRadius: 9, background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: "12.5px", fontWeight: 600 }}>
            <Download size={14} />Crear copia
          </button>
        </div>
      </div>

      {/* ayuda */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={h2Style}>Ayuda</h2>
        <p style={{ ...pStyle, marginBottom: 12 }}>¿Primera vez con Cantoral? Repasa cómo funciona en un minuto.</p>
        <button onClick={openHelp} className="hb-s2" style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 15px", borderRadius: 10, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "13.5px", fontWeight: 600 }}>
          <HelpCircle size={16} />¿Cómo funciona?
        </button>
      </div>

      {/* actualizaciones */}
      <Actualizaciones />

      {/* créditos / autores */}
      <div style={{ marginBottom: 30 }}>
        <h2 style={h2Style}>Créditos</h2>
        <p style={{ ...pStyle, marginBottom: 12 }}>Quienes hacen posible Cantoral.</p>
        <div style={{ border: "1px solid var(--border)", borderRadius: 13, background: "var(--surface)", overflow: "hidden" }}>
          {PEOPLE.map((p, i) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderTop: i ? "1px solid var(--border)" : undefined }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--brand-grad)", display: "grid", placeItems: "center", flex: "0 0 auto", color: "#fff", fontSize: 15, fontWeight: 700, boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" }}>{p.initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13.5px", fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>{p.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12, paddingTop: 8 }}>
        Cantoral {__APP_VERSION__} · Hecho con cuidado para el ministerio de alabanza
      </div>
    </div>
  );
}

/** `12345678` → `12,3 MB`, para una descarga en curso. */
function megas(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Buscar e instalar una versión nueva.
 *
 * El público de esta app son PCs de iglesia sin nadie técnico cerca, así que
 * la comprobación al arrancar es callada y esto es lo que se ve cuando alguien
 * viene a mirar. El botón siempre contesta algo: silencio después de pulsar se
 * lee como que no funciona.
 */
function Actualizaciones() {
  const update = useStore((s) => s.update);
  const estado = useStore((s) => s.updateState);
  const error = useStore((s) => s.updateError);
  const progreso = useStore((s) => s.updateProgress);
  const checkForUpdate = useStore((s) => s.checkForUpdate);
  const installUpdate = useStore((s) => s.installUpdate);

  const buscando = estado === "checking";
  const bajando = estado === "downloading";
  const hay = update?.estado === "disponible";
  const pct =
    progreso?.total && progreso.total > 0
      ? Math.min(100, Math.round((progreso.descargado / progreso.total) * 100))
      : null;

  return (
    <div style={{ marginBottom: 30 }}>
      <h2 style={h2Style}>Actualizaciones</h2>
      <p style={{ ...pStyle, marginBottom: 12 }}>
        Tienes la versión {__APP_VERSION__}.{" "}
        {update?.estado === "sinConfigurar"
          ? "Esta compilación no trae actualizaciones automáticas: descárgalas desde GitHub."
          : "Cantoral mira si hay una versión nueva al abrirse, sin interrumpir."}
      </p>

      <div style={{ border: "1px solid var(--border)", borderRadius: 13, background: "var(--surface)", padding: 16 }}>
        {hay && update.estado === "disponible" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <ArrowUpCircle size={18} color="var(--primary)" style={{ flex: "0 0 auto" }} />
              <span style={{ fontSize: "13.5px", fontWeight: 700 }}>Cantoral {update.version} está disponible</span>
            </div>
            {update.notas.trim() && (
              <pre style={{ fontSize: "12.5px", color: "var(--text-2)", margin: "0 0 12px", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 180, overflowY: "auto" }}>
                {update.notas.trim()}
              </pre>
            )}
            {/* Hasta que exista el certificado de Apple, la app actualizada
                vuelve a quedar en cuarentena y macOS dirá que está dañada.
                Decirlo antes evita el susto. */}
            {isMacOS() && (
              <p style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "12px", color: "var(--text-3)", margin: "0 0 12px", lineHeight: 1.5 }}>
                <TriangleAlert size={14} style={{ flex: "0 0 auto", marginTop: 1 }} />
                <span>
                  En macOS, al abrirla de nuevo el sistema puede decir que la app está dañada, porque
                  todavía no está firmada. Se arregla con{" "}
                  <code style={{ fontSize: "11.5px" }}>xattr -dr com.apple.quarantine /Applications/Cantoral.app</code>.
                </span>
              </p>
            )}
            {bajando ? (
              <div>
                <div style={{ height: 6, borderRadius: 4, background: "var(--surface-3)", overflow: "hidden", marginBottom: 7 }}>
                  <div style={{ height: "100%", width: pct === null ? "100%" : `${pct}%`, background: "var(--primary)", transition: "width .2s", opacity: pct === null ? 0.5 : 1 }} />
                </div>
                <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
                  {pct === null
                    ? `Descargando… ${megas(progreso?.descargado ?? 0)}`
                    : `Descargando… ${pct}%`}{" "}
                  · Cantoral se reiniciará solo al terminar.
                </p>
              </div>
            ) : (
              <button onClick={installUpdate} className="hb-primary" style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 15px", borderRadius: 10, background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, boxShadow: "var(--sh-sm)" }}>
                <Download size={16} />Instalar y reiniciar
              </button>
            )}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13px", color: "var(--text-2)", flex: 1, minWidth: 0 }}>
              {estado === "error" ? (
                <>
                  <TriangleAlert size={16} color="var(--danger)" style={{ flex: "0 0 auto" }} />
                  <span style={{ minWidth: 0 }}>No se pudo comprobar{error ? `: ${error}` : "."}</span>
                </>
              ) : update?.estado === "alDia" ? (
                <>
                  <CircleCheck size={16} color="var(--primary)" style={{ flex: "0 0 auto" }} />
                  Estás en la última versión.
                </>
              ) : (
                <span>{buscando ? "Comprobando…" : "Comprueba cuando quieras."}</span>
              )}
            </span>
            <button
              onClick={() => void checkForUpdate(true)}
              disabled={buscando}
              className="hb-s2"
              style={{ flex: "0 0 auto", height: 36, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: "12.5px", fontWeight: 600, ...ocupadoStyle(buscando) }}
            >
              <RefreshCw size={14} style={buscando ? { animation: "canSpin 1s linear infinite" } : undefined} />
              Buscar actualizaciones
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
