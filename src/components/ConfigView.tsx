import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowUpCircle, CircleCheck, Download, Folder, HelpCircle, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { useStore } from "../store";
import { ocupadoStyle } from "../lib/styles";
import DuplicateGroups from "./DuplicateGroups";
import { getDbInfo, isMacOS, type DbInfo } from "../lib/api";
import { faltantesPorCarpetaDe, metaDeCarpeta } from "../lib/carpetas";
import type { ThemeMode } from "../lib/types";
import { Logotipo } from "./Logo";

// El rediseño pone cada cosa en su tarjeta en vez de encadenar secciones con
// títulos sueltos y 30 px de aire entre ellas. Configuración se mira entera de
// una sentada —qué carpetas hay, si hay duplicadas, cuándo fue la última
// copia—, y así entra sin tener que recorrerla.
const tarjeta: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--surface)",
  padding: "13px 14px",
  marginBottom: 12,
};
const h2Style: CSSProperties = { fontSize: "12.5px", fontWeight: 600, margin: "0 0 2px" };
const pStyle: CSSProperties = { fontSize: 11, color: "var(--text-2)", margin: 0, lineHeight: 1.55 };
/** Un botón de acción de los pequeños, los de las filas de carpeta. */
const botonFila: CSSProperties = {
  height: 25,
  padding: "0 9px",
  borderRadius: 6,
  border: "1px solid var(--border-2)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: 11,
  flex: "0 0 auto",
};

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
      style={{ flex: 1, padding: 0, borderRadius: 9, overflow: "hidden", textAlign: "left", transition: "all .14s", cursor: "pointer", border: `1px solid ${active ? "var(--primary)" : "var(--border-2)"}`, background: active ? "var(--primary-soft)" : "var(--surface-2)", color: "var(--text)" }}
    >
      <div style={{ width: "100%", height: 52, borderBottom: "1px solid var(--border)", overflow: "hidden", display: "flex" }}>
        {value === "light" && <MiniPreview p={LIGHT_P} />}
        {value === "dark" && <MiniPreview p={DARK_P} />}
        {value === "system" && (
          <>
            <MiniPreview p={LIGHT_P} half />
            <MiniPreview p={DARK_P} half />
          </>
        )}
      </div>
      <span style={{ display: "block", padding: "6px 8px", fontSize: "11.5px", fontWeight: 600 }}>{label}</span>
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
  const tracks = useStore((s) => s.tracks);
  const openAddFolder = useStore((s) => s.openAddFolder);
  const scanning = useStore((s) => s.scanning);
  const rescanFolder = useStore((s) => s.rescanFolder);
  const relocateFolder = useStore((s) => s.relocateFolder);
  const removeFolder = useStore((s) => s.removeFolder);
  const restore = useStore((s) => s.restore);
  const backup = useStore((s) => s.backup);
  const openHelp = useStore((s) => s.openHelp);

  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  useEffect(() => {
    void getDbInfo().then(setDbInfo);
  }, [folders.length, totalTracks]);

  const faltantesPorCarpeta = faltantesPorCarpetaDe(tracks, folders);

  const lastScan = folders
    .map((f) => f.lastScan)
    .filter((x): x is string => !!x)
    .sort()
    .pop();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 18px 24px" }}>
      <div style={tarjeta}>
        <h2 style={h2Style}>Apariencia</h2>
        <p style={{ ...pStyle, marginBottom: 10 }}>El oscuro está pensado para un templo con las luces bajas.</p>
        <div style={{ display: "flex", gap: 9 }}>
          <ThemeCard value="light" label="Claro" />
          <ThemeCard value="dark" label="Oscuro" />
          <ThemeCard value="system" label="Seguir al sistema" />
        </div>
      </div>

      <div style={tarjeta}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <h2 style={{ ...h2Style, margin: 0, flex: "0 0 auto" }}>Carpetas indexadas</h2>
          <p style={{ ...pStyle, minWidth: 0 }}>Cantoral las lee; los archivos no se tocan.</p>
          <div style={{ flex: 1 }} />
          <button onClick={openAddFolder} disabled={scanning} title={scanning ? "Hay un escaneo en curso" : undefined} className="hb-s2" style={{ ...botonFila, height: 26, display: "flex", alignItems: "center", gap: 6, fontSize: "11.5px", fontWeight: 600, ...ocupadoStyle(scanning) }}>
            <Plus size={13} strokeWidth={2.2} />Añadir carpeta…
          </button>
        </div>
        {folders.length === 0 && (
          <p style={{ ...pStyle, paddingTop: 9, borderTop: "1px solid var(--border)" }}>
            Todavía no hay ninguna. Señala la carpeta donde está la música y Cantoral la lee de ahí.
          </p>
        )}
        {folders.map((f) => (
          <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid var(--border)" }}>
            <Folder size={15} color="var(--text-3)" style={{ flex: "0 0 auto" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div title={f.ruta} style={{ fontSize: 12, fontFamily: "ui-monospace,Menlo,monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.ruta}</div>
              <div style={{ fontSize: "10.5px", color: "var(--text-3)" }}>{metaDeCarpeta(f, faltantesPorCarpeta[f.id] ?? 0, formatScan(f.lastScan))}</div>
            </div>
            {/* Con su nombre y no un icono: «reapuntar» no tiene dibujo que se
                entienda solo, y equivocarse de botón aquí quita una carpeta. */}
            <button onClick={() => rescanFolder(f.id)} disabled={scanning} title={scanning ? "Hay un escaneo en curso" : undefined} className="hb-s2" style={{ ...botonFila, ...ocupadoStyle(scanning) }}>
              Reescanear
            </button>
            <button onClick={() => relocateFolder(f.id)} title="La carpeta cambió de sitio: apuntarla al nuevo sin perder lo que lleven sus pistas" className="hb-s2" style={botonFila}>
              Reapuntar…
            </button>
            <button onClick={() => removeFolder(f.id)} className="hb-danger" style={{ ...botonFila, color: "var(--danger)" }}>
              Quitar…
            </button>
          </div>
        ))}
        {folders.length > 0 && (
          <div style={{ paddingTop: 9, borderTop: "1px solid var(--border)", fontSize: "10.5px", color: "var(--text-3)" }}>
            Última actualización: {formatScan(lastScan)} · {totalTracks} pistas en total
          </div>
        )}
      </div>

      <DuplicateGroups />

      <div style={tarjeta}>
        <h2 style={h2Style}>Base de datos</h2>
        <p style={{ ...pStyle, marginBottom: 10 }}>
          Tu catálogo, tus listas y las letras que escribas viven en un solo archivo.{" "}
          {dbInfo ? (
            <span title={dbInfo.path} style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: "10.5px", color: "var(--text-3)" }}>
              {dbInfo.path} · {formatSize(dbInfo.size)}
            </span>
          ) : (
            "Haz copias periódicas."
          )}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={backup} className="hb-s2" style={{ ...botonFila, height: 28, padding: "0 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
            <Download size={13} />Crear copia de seguridad
          </button>
          <button onClick={restore} className="hb-s2" style={{ ...botonFila, height: 28, padding: "0 12px", borderRadius: 7, fontSize: 12 }}>
            Restaurar una copia…
          </button>
        </div>
      </div>

      <div style={tarjeta}>
        <h2 style={h2Style}>Ayuda</h2>
        <p style={{ ...pStyle, marginBottom: 10 }}>¿Primera vez con Cantoral? Repasa cómo funciona en un minuto.</p>
        <button onClick={openHelp} className="hb-s2" style={{ ...botonFila, height: 28, padding: "0 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
          <HelpCircle size={13} />¿Cómo funciona?
        </button>
      </div>

      {/* actualizaciones */}
      <Actualizaciones />

      <div style={tarjeta}>
        <h2 style={h2Style}>Créditos</h2>
        <p style={{ ...pStyle, marginBottom: 10 }}>Quienes hacen posible Cantoral.</p>
        {PEOPLE.map((p, i) => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i ? "1px solid var(--border)" : undefined }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-grad)", display: "grid", placeItems: "center", flex: "0 0 auto", color: "#fff", fontSize: 11, fontWeight: 700 }}>{p.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: "10.5px", color: "var(--text-3)" }}>{p.role}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Lo más parecido a un «Acerca de» que tiene la app: el manual pone aquí
          el logotipo con el símbolo a 64 px. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: "var(--text-3)", fontSize: 11, padding: "14px 0 4px" }}>
        <Logotipo cuerpo={64 / (1.14 * (244 / 200))} />
        <span>Versión {__APP_VERSION__} · Hecho con cuidado para el ministerio de alabanza</span>
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
    <div style={tarjeta}>
      {/* El título, la versión y el botón de comprobar en una fila, como el
          resto de las tarjetas: lo que hay debajo solo aparece cuando hay algo
          que decir. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: hay || estado !== "idle" ? 10 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={h2Style}>Actualizaciones</h2>
          <p style={pStyle}>
            Versión {__APP_VERSION__} ·{" "}
            {update?.estado === "sinConfigurar"
              ? "esta compilación no trae actualizaciones automáticas: descárgalas desde GitHub."
              : "Cantoral mira si hay una versión nueva al abrirse, sin interrumpir."}
          </p>
        </div>
        <button
          onClick={() => void checkForUpdate(true)}
          disabled={buscando}
          className="hb-s2"
          style={{ ...botonFila, height: 26, display: "flex", alignItems: "center", gap: 6, fontSize: "11.5px", fontWeight: 600, ...ocupadoStyle(buscando) }}
        >
          <RefreshCw size={13} style={buscando ? { animation: "canSpin 1s linear infinite" } : undefined} />
          Buscar ahora
        </button>
      </div>

      <div style={{ display: hay || estado !== "idle" ? "block" : "none", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", padding: "10px 11px" }}>
        {hay && update.estado === "disponible" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <ArrowUpCircle size={15} color="var(--primary)" style={{ flex: "0 0 auto" }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Cantoral {update.version} está disponible</span>
            </div>
            {update.notas.trim() && (
              <pre style={{ fontSize: 11, color: "var(--text-2)", margin: "0 0 9px", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6, maxHeight: 150, overflowY: "auto" }}>
                {update.notas.trim()}
              </pre>
            )}
            {/* Hasta que exista el certificado de Apple, la app actualizada
                vuelve a quedar en cuarentena y macOS dirá que está dañada.
                Decirlo antes evita el susto. */}
            {isMacOS() && (
              <p style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: "10.5px", color: "var(--text-3)", margin: "0 0 9px", lineHeight: 1.55 }}>
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
              <button onClick={installUpdate} className="hb-primary" style={{ height: 27, display: "flex", alignItems: "center", gap: 7, padding: "0 12px", borderRadius: 7, background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: "11.5px", fontWeight: 600 }}>
                <Download size={13} />Reiniciar e instalar
              </button>
            )}
          </>
        ) : (
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-2)" }}>
            {estado === "error" ? (
              <>
                <TriangleAlert size={14} color="var(--danger)" style={{ flex: "0 0 auto" }} />
                <span style={{ minWidth: 0 }}>No se pudo comprobar{error ? `: ${error}` : "."}</span>
              </>
            ) : update?.estado === "alDia" ? (
              <>
                <CircleCheck size={14} color="var(--primary)" style={{ flex: "0 0 auto" }} />
                Estás en la última versión.
              </>
            ) : (
              <span>Comprobando…</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
