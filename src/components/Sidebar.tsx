import { CalendarDays, Clock, Heart, Library, Plus, Settings } from "lucide-react";
import { useState } from "react";
import { useStore } from "../store";
import { partirPorFecha } from "../lib/fechas";
import { navBtn, navCount, subBtn } from "../lib/styles";
import type { CSSProperties } from "react";

/**
 * La barra lateral, en dos zonas.
 *
 * Arriba, a dónde se va, con los filtros y las listas sangrados bajo la
 * sección a la que pertenecen —la sangría es la que lleva la jerarquía que una
 * fila de botones iguales no podía llevar—. Abajo, la máquina: la
 * configuración y una línea que dice de qué se ha enterado Cantoral.
 *
 * Las carpetas indexadas vivían aquí. Se fueron a Configuración: una carpeta
 * se elige una vez, no es un sitio al que se navega, y tenerlas aquí hacía que
 * la barra pareciera un árbol de archivos que responde a clics que no responde.
 */

/** El punto de un filtro que pide atención. */
function punto(color: string, size = 6): CSSProperties {
  return { width: size, height: size, borderRadius: "50%", background: color, flex: "0 0 auto" };
}

const seccion: CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const etiquetaFila: CSSProperties = { display: "flex", alignItems: "center", gap: 6, minWidth: 0 };
const recorta: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export default function Sidebar() {
  const view = useStore((s) => s.view);
  const qf = useStore((s) => s.qf);
  const ocasion = useStore((s) => s.ocasion);
  const tracks = useStore((s) => s.tracks);
  const playlists = useStore((s) => s.playlists);
  const plOrder = useStore((s) => s.plOrder);
  const folders = useStore((s) => s.folders);
  const curPlaylist = useStore((s) => s.curPlaylist);

  const verTodaLaBiblioteca = useStore((s) => s.verTodaLaBiblioteca);
  const query = useStore((s) => s.query);
  const showColecciones = useStore((s) => s.showColecciones);
  const showConfig = useStore((s) => s.showConfig);
  const onQuickFilter = useStore((s) => s.onQuickFilter);
  const openPlaylist = useStore((s) => s.openPlaylist);
  const newList = useStore((s) => s.newList);

  const arrastrando = useStore((s) => s.dragFromLibrary.length);
  const bulkAddToPlaylist = useStore((s) => s.bulkAddToPlaylist);
  const endLibraryDrag = useStore((s) => s.endLibraryDrag);
  const [sobre, setSobre] = useState<string | null>(null);

  const favCount = tracks.filter((t) => t.fav).length;
  const missingCount = tracks.filter((t) => t.missing).length;

  const libActive = view === "biblioteca";
  const colActive = view === "colecciones" || view === "lista";
  const cfgActive = view === "config";
  // «Todas» está encendida cuando de verdad se están viendo todas: sin filtro
  // rápido, sin ocasión, sin etiquetas y sin búsqueda. Contaba solo las dos
  // primeras, así que con una etiqueta puesta decía que estaban todas.
  const todasActive = libActive && !qf && !ocasion && !query.trim();

  // El mismo orden en que se lee la vista de listas: primero lo que viene,
  // después lo que ya pasó. Una plantilla no es un culto y se queda fuera.
  const { proximos, pasados, sinFecha } = partirPorFecha(playlists.filter((p) => !p.plantilla));
  const cultos = [...proximos, ...pasados, ...sinFecha];

  const resumen = [
    folders.length
      ? `${folders.length} ${folders.length === 1 ? "carpeta indexada" : "carpetas indexadas"}`
      : "Sin carpetas indexadas",
    tracks.length ? `${tracks.length} ${tracks.length === 1 ? "pista" : "pistas"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <aside
      style={{
        width: 226,
        flex: "0 0 auto",
        background: "var(--bg-2)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        padding: "10px 8px 8px",
        gap: 4,
      }}
    >
      {/* La zona de en medio se desplaza sola, para que una iglesia con
          cuarenta cultos deje Configuración donde siempre está. */}
      <nav
        aria-label="Secciones"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}
      >
        <button onClick={verTodaLaBiblioteca} aria-current={libActive ? "page" : undefined} className={libActive ? undefined : "hb-s2"} style={navBtn(libActive)}>
          <span style={etiquetaFila}>
            <Library size={14} style={{ flex: "0 0 auto" }} />
            Biblioteca
          </span>
          <span style={navCount()}>{tracks.length}</span>
        </button>

        <div style={seccion}>
          <button onClick={verTodaLaBiblioteca} aria-pressed={todasActive} className={todasActive ? undefined : "hb-s2"} style={subBtn(todasActive)}>
            <span style={{ ...etiquetaFila, ...recorta }}>Todas</span>
            <span style={navCount(true)}>{tracks.length}</span>
          </button>
          <button onClick={() => onQuickFilter("fav")} aria-pressed={qf === "fav"} className={qf === "fav" ? undefined : "hb-s2"} style={subBtn(qf === "fav")}>
            <span style={etiquetaFila}>
              <Heart size={12} style={{ flex: "0 0 auto" }} />
              Favoritas
            </span>
            <span style={navCount(true)}>{favCount}</span>
          </button>
          <button onClick={() => onQuickFilter("recent")} aria-pressed={qf === "recent"} className={qf === "recent" ? undefined : "hb-s2"} style={subBtn(qf === "recent")}>
            <span style={etiquetaFila}>
              <Clock size={12} style={{ flex: "0 0 auto" }} />
              Recién agregadas
            </span>
          </button>
          <button onClick={() => onQuickFilter("missing")} aria-pressed={qf === "missing"} className={qf === "missing" ? undefined : "hb-s2"} style={subBtn(qf === "missing")}>
            <span style={etiquetaFila}>
              Archivos faltantes
              {missingCount > 0 && <span style={punto("var(--danger)", 5)} />}
            </span>
            <span style={navCount(true)}>{missingCount}</span>
          </button>
        </div>

        <div style={{ height: 6, flex: "0 0 auto" }} />

        <button onClick={showColecciones} aria-current={colActive ? "page" : undefined} className={colActive ? undefined : "hb-s2"} style={navBtn(colActive)}>
          <span style={etiquetaFila}>
            <CalendarDays size={14} style={{ flex: "0 0 auto" }} />
            Listas para cultos
          </span>
          {/* Cuenta lo que está justo debajo, no todo lo que hay: un 6 sobre
              cinco filas se lee como que falta una. Las plantillas se cuentan
              en su propia sección, dentro de la vista. */}
          <span style={navCount()}>{cultos.length}</span>
        </button>

        <div style={seccion}>
          {cultos.map((p) => {
            const activo = view === "lista" && curPlaylist === p.id;
            const encima = sobre === p.id && arrastrando > 0;
            return (
              <button
                key={p.id}
                onClick={() => openPlaylist(p.id)}
                title={p.nombre}
                aria-current={activo ? "page" : undefined}
                className={activo || encima ? undefined : "hb-s2"}
                // Siempre es un sitio donde soltar, no solo cuando ya hay algo
                // en el aire: un destino que aparece a mitad del arrastre es un
                // destino al que no se puede apuntar, porque no se sabía que
                // estaba ahí.
                //
                // Pero solo acepta lo que salió de la biblioteca. Sin este
                // guardia, arrastrar una carpeta del escritorio hasta aquí
                // agregaría las pistas que estuvieran seleccionadas, que no es
                // ni de lejos lo que esa persona pidió. Sin `preventDefault` el
                // navegador se queda el arrastre y `onDrop` ni se dispara.
                onDragOver={(e) => {
                  if (arrastrando === 0) return;
                  e.preventDefault();
                  setSobre(p.id);
                }}
                onDragLeave={() => setSobre((v) => (v === p.id ? null : v))}
                onDrop={(e) => {
                  if (arrastrando === 0) return;
                  e.preventDefault();
                  setSobre(null);
                  bulkAddToPlaylist(p.id);
                  endLibraryDrag();
                }}
                style={{
                  ...subBtn(activo),
                  ...(encima ? { background: "var(--primary-soft)", color: "var(--primary)", fontWeight: 600 } : {}),
                }}
              >
                <span style={{ ...recorta, minWidth: 0 }}>{p.nombre}</span>
                <span style={navCount(true)}>{(plOrder[p.id] ?? p.ids).length}</span>
              </button>
            );
          })}
          <button onClick={newList} className="hb-s2" style={{ ...subBtn(false), color: "var(--text-3)" }}>
            <span style={etiquetaFila}>
              <Plus size={12} style={{ flex: "0 0 auto" }} />
              Nueva lista
            </span>
          </button>
        </div>
      </nav>

      <div style={{ flex: "0 0 auto" }}>
        <button onClick={showConfig} aria-current={cfgActive ? "page" : undefined} className={cfgActive ? undefined : "hb-s2"} style={navBtn(cfgActive)}>
          <span style={etiquetaFila}>
            <Settings size={14} style={{ flex: "0 0 auto" }} />
            Configuración
          </span>
        </button>
        <div style={{ padding: "4px 10px 2px", fontSize: "10.5px", color: "var(--text-3)", lineHeight: 1.5 }}>
          {resumen}
        </div>
      </div>
    </aside>
  );
}
