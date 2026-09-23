import { CalendarDays, Clock, Heart, Library, Plus, Settings } from "lucide-react";
import { useState } from "react";
import { proximoCulto, useStore } from "../store";
import { formatearFechaCorta, partirPorFecha } from "../lib/fechas";
import { navBtn, navCount, subBtn } from "../lib/styles";
import type { CSSProperties } from "react";
import type { Playlist } from "../lib/types";

/**
 * La barra lateral, en tres zonas.
 *
 * Arriba, lo que está pasando: el culto que viene y el botón que lo abre. En
 * medio, a dónde se va, con los filtros y las listas sangrados bajo la sección
 * a la que pertenecen —la sangría es la que lleva la jerarquía que una fila de
 * botones iguales no podía llevar—. Abajo, la máquina: la configuración y una
 * línea que dice de qué se ha enterado Cantoral.
 *
 * Las carpetas indexadas vivían aquí. Se fueron a Configuración: una carpeta
 * se elige una vez, no es un sitio al que se navega, y tenerlas aquí hacía que
 * la barra pareciera un árbol de archivos que responde a clics que no responde.
 */

/** El punto delante de «En vivo» y el de un filtro que pide atención. */
function punto(color: string, size = 6): CSSProperties {
  return { width: size, height: size, borderRadius: "50%", background: color, flex: "0 0 auto" };
}

const seccion: CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const etiquetaFila: CSSProperties = { display: "flex", alignItems: "center", gap: 6, minWidth: 0 };
const recorta: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

/** La tarjeta de arriba: el culto que viene y la forma de entrar en él. */
function EnVivo({ culto }: { culto: Playlist }) {
  const openPlaylist = useStore((s) => s.openPlaylist);
  const showProyeccion = useStore((s) => s.showProyeccion);
  const tracks = useStore((s) => s.tracks);
  const guardado = useStore((s) => s.plOrder[culto.id]);
  const orden = guardado ?? culto.ids;

  const total = orden.reduce((a, id) => a + (tracks.find((t) => t.id === id)?.durSec ?? 0), 0);
  const resumen = [
    `${orden.length} ${orden.length === 1 ? "pista" : "pistas"}`,
    total ? `${Math.round(total / 60)} min` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{
        flex: "0 0 auto",
        border: "1px solid var(--border-2)",
        borderRadius: 9,
        background: "var(--surface)",
        padding: "9px 10px 10px",
        boxShadow: "0 1px 0 var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={punto("var(--primary)")} />
        <span style={{ fontSize: "9.5px", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--primary)" }}>
          En vivo
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25, marginBottom: 1, ...recorta }} title={culto.nombre}>
        {culto.nombre}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 8, ...recorta }}>
        {[formatearFechaCorta(culto.fecha), resumen].filter(Boolean).join(" · ")}
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <button
          onClick={() => openPlaylist(culto.id)}
          className="hb-primary"
          style={{ flex: 1, height: 27, borderRadius: 6, background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: "11.5px", fontWeight: 600 }}
        >
          Abrir el culto
        </button>
        <button
          onClick={() => showProyeccion(culto.id)}
          className="hb-s3"
          style={{ flex: 1, height: 27, borderRadius: 6, border: "1px solid var(--border-2)", background: "var(--surface-2)", color: "var(--text)", fontSize: "11.5px", fontWeight: 600 }}
        >
          Proyectar
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const view = useStore((s) => s.view);
  const qf = useStore((s) => s.qf);
  const ocasion = useStore((s) => s.ocasion);
  const tracks = useStore((s) => s.tracks);
  const playlists = useStore((s) => s.playlists);
  const plOrder = useStore((s) => s.plOrder);
  const folders = useStore((s) => s.folders);
  const curPlaylist = useStore((s) => s.curPlaylist);
  const culto = useStore(proximoCulto);

  const showBiblioteca = useStore((s) => s.showBiblioteca);
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
  // «Todas» es la biblioteca sin nada que la estreche, que es justo lo que deja
  // `showBiblioteca`: por eso se enciende con el mismo estado.
  const todasActive = libActive && !qf && !ocasion;

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
      {culto && <EnVivo culto={culto} />}

      {/* La zona de en medio se desplaza sola, para que una iglesia con
          cuarenta cultos deje Configuración donde siempre está. */}
      <nav
        aria-label="Secciones"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, paddingTop: culto ? 6 : 0 }}
      >
        <button onClick={showBiblioteca} aria-current={libActive ? "page" : undefined} className={libActive ? undefined : "hb-s2"} style={navBtn(libActive)}>
          <span style={etiquetaFila}>
            <Library size={14} style={{ flex: "0 0 auto" }} />
            Biblioteca
          </span>
          <span style={navCount()}>{tracks.length}</span>
        </button>

        <div style={seccion}>
          <button onClick={showBiblioteca} aria-pressed={todasActive} className={todasActive ? undefined : "hb-s2"} style={subBtn(todasActive)}>
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
