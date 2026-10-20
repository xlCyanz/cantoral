import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Heart, MonitorX, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { cur, enElProyector, useStore } from "../store";
import { NOMBRE_REPETIR } from "../lib/cola";
import { useReproductor } from "../lib/media";
import { coverStyle, fmt } from "../lib/covers";
import GlifoDePista from "./GlifoDePista";
import type { Track } from "../lib/types";
import { valorDeDeslizador } from "../lib/teclado";
import { crearBusquedaDiferida } from "../lib/busqueda";

/**
 * Draggable progress / volume track (ported from dragBar).
 *
 * Also a slider for the keyboard and for a screen reader (#138): it takes the
 * focus, the arrows move it by `paso`, and it says what it is and where it
 * stands. The volume is something that gets changed every Sunday, and before
 * this it could only be done with a mouse.
 */
function DragBar({
  fraction,
  onChange,
  fillBg,
  thumbBg,
  thumbSize,
  etiqueta,
  texto,
  paso,
  onSoltar,
}: {
  fraction: number;
  onChange: (f: number, origen: "puntero" | "tecla") => void;
  fillBg: string;
  thumbBg: string;
  thumbSize: number;
  etiqueta: string;
  /** How a screen reader reads the value: «1:20 de 4:05», «60 %». */
  texto: string;
  /** What one arrow press moves, as a fraction of the whole. */
  paso: number;
  /**
   * Al soltar el ratón o la tecla. Con él, `onChange` dice además de dónde
   * viene cada movimiento, para quien quiera esperar a que se suelte.
   */
  onSoltar?: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = Math.min(100, Math.max(0, fraction * 100));

  const start = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const calc = (x: number) => Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    onChange(calc(e.clientX), "puntero");
    const mv = (ev: PointerEvent) => onChange(calc(ev.clientX), "puntero");
    const up = () => {
      document.removeEventListener("pointermove", mv);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      onSoltar?.();
    };
    document.addEventListener("pointermove", mv);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={texto}
      onPointerDown={start}
      onKeyDown={(e) => {
        const f = valorDeDeslizador(e.key, fraction, paso);
        if (f === null) return;
        // The arrows are also «previous / next track» for the whole app; on
        // the slider they belong to the slider.
        e.preventDefault();
        e.stopPropagation();
        onChange(f, "tecla");
      }}
      onKeyUp={(e) => {
        if (valorDeDeslizador(e.key, fraction, paso) !== null) onSoltar?.();
      }}
      style={{ flex: 1, height: 16, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}>
      <div ref={trackRef} style={{ width: "100%", height: 5, borderRadius: 4, background: "var(--surface-3)", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: pct + "%", borderRadius: 4, background: fillBg }} />
        <div style={{ position: "absolute", top: "50%", left: pct + "%", width: thumbSize, height: thumbSize, borderRadius: "50%", background: thumbBg, transform: "translate(-50%,-50%)", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
      </div>
    </div>
  );
}

// El rediseño baja la barra de 88 px a 60 y encoge todo lo de dentro con ella.
// Una barra de transporte que ocupa la novena parte de la ventana es lo normal
// en una app de música, donde es la pantalla; aquí lo que importa es la lista
// del culto que tiene encima, y la barra solo tiene que estar.
const transportBtn: CSSProperties = { width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--text)" };
const secundarioBtn: CSSProperties = { width: 24, height: 24, borderRadius: 6, display: "grid", placeItems: "center" };
const tiempo: CSSProperties = { fontSize: 10, color: "var(--text-3)", fontVariantNumeric: "tabular-nums", width: 30 };

/**
 * El tiempo y la barra de progreso.
 *
 * Lo único de la barra que cambia cada segundo, y por eso aparte: leyendo la
 * posición, la barra entera —carátula, botones, volumen— se volvía a pintar
 * con cada segundo que pasaba. Así solo se repinta esto.
 */
function Progreso({ track }: { track: Track | undefined }) {
  const storePos = useStore((s) => s.posSec);
  const alProyector = useStore(enElProyector);
  // Adónde se está arrastrando, mientras se arrastra hacia el proyector.
  const [arrastre, setArrastre] = useState<number | null>(null);
  // Un solo objeto por barra: guarda lo pendiente entre un evento y otro.
  const [busqueda] = useState(() => crearBusquedaDiferida((f) => useStore.getState().seekToFraction(f)));

  const durS = track?.durSec || 1;
  const durTexto = track ? track.dur : "0:00";
  const posSec = arrastre !== null ? Math.round(arrastre * durS) : storePos;
  const fraccion = arrastre ?? Math.min(100, (storePos / durS) * 100) / 100;

  // En el portátil cada movimiento salta en el `<audio>` en el acto. Hacia el
  // proyector la barra se mueve aquí y la salida recibe solo dónde se soltó
  // (ver `busqueda.ts`).
  const mover = (f: number, origen: "puntero" | "tecla") => {
    if (!alProyector) {
      useStore.getState().seekToFraction(f);
      return;
    }
    setArrastre(f);
    if (origen === "tecla") busqueda.tecla(f);
    else busqueda.arrastrar(f);
  };
  const soltar = () => {
    busqueda.soltar();
    setArrastre(null);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", maxWidth: 460 }}>
      <span style={{ ...tiempo, textAlign: "right" }}>{fmt(posSec)}</span>
      <DragBar
        fraction={fraccion}
        onChange={mover}
        onSoltar={soltar}
        fillBg="var(--primary)"
        thumbBg="var(--primary)"
        thumbSize={10}
        etiqueta="Posición en la pista"
        texto={`${fmt(posSec)} de ${durTexto}`}
        paso={5 / Math.max(durS, 1)}
      />
      <span style={tiempo}>{durTexto}</span>
    </div>
  );
}

export default function PlayerBar() {
  // This is the one component that has to re-render several times a second, so
  // it reads the fields it shows one by one — reading the whole store here used
  // to drag the entire library table along with every tick.
  //
  // Es la misma barra suene donde suene: un video que sale por el proyector
  // se pausa, se adelanta y se pasa desde aquí, igual que un audio.
  const alProyector = useStore(enElProyector);
  const track = useStore((s) => cur(s) ?? s.tracks[0]);
  const playing = useStore((s) => s.playing);
  const proyectando = useStore((s) => s.proyectando);
  const cerrarProyeccion = useStore((s) => s.cerrarProyeccion);
  const volume = useStore((s) => s.volume);
  const muted = useStore((s) => s.muted);
  const shuffle = useStore((s) => s.shuffle);
  const repeat = useStore((s) => s.repeat);
  const onFav = useStore((s) => s.onFav);
  const toggleShuffle = useStore((s) => s.toggleShuffle);
  const togglePlay = useStore((s) => s.togglePlay);
  const toggleRepeat = useStore((s) => s.toggleRepeat);
  const toggleMute = useStore((s) => s.toggleMute);
  const setVolume = useStore((s) => s.setVolume);
  const irAnterior = useStore((s) => s.prev);
  const irSiguiente = useStore((s) => s.next);
  const queueOrigen = useStore((s) => s.queueOrigen);
  // Con un culto delante y el transporte siguiendo la biblioteca, lo que suene
  // después no es lo que se está mirando: eso es lo que hay que ver de un
  // vistazo (#139).
  const otraCola = useStore((s) => s.view === "lista" && s.queueOrigen === "biblioteca");

  const volPct = (muted ? 0 : volume) * 100;

  // ---- reproducción integrada (solo en Tauri; el navegador usa el temporizador) ----
  //
  // Solo el audio. El video se reproduce en el proyector o en el `<video>` del
  // panel de detalle, que es donde se puede ver; aquí se queda sin `src` para
  // que los dos elementos no reclamen el mismo archivo a la vez.
  const audioRef = useRef<HTMLAudioElement>(null);
  const manejadores = useReproductor(audioRef, track, !!track && !track.video);
  const haSonado = useStore((s) => s.haSonado);
  const audio = <audio ref={audioRef} preload="metadata" {...manejadores} style={{ display: "none" }} />;

  // Sin nada que haya sonado, solo el `<audio>`: es el que reproduce, y tiene
  // que estar montado para la primera pista que se ponga a sonar.
  if (!haSonado) return audio;

  return (
    <footer style={{ height: 60, flex: "0 0 auto", background: "var(--bg-2)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, padding: "0 14px", zIndex: 6 }}>
      {audio}

      {/* lo que suena */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, width: 190, minWidth: 0 }}>
        <div style={coverStyle(track, 38)}>
          {/* Always the note, even for a video or a missing file: the bar is
              about what is sounding, and has shown it this way since before
              the other swatches learnt to tell tracks apart. */}
          <GlifoDePista t={track} size="barra" forma="nota" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track ? track.titulo : "—"}</div>
          <div style={{ fontSize: "10.5px", color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track ? track.artista : ""}</div>
        </div>
        <button onClick={() => track && onFav(track.id)} title="Favorita" aria-label="Favorita" aria-pressed={!!track?.fav} className="hb-s2t" style={{ ...secundarioBtn, flex: "0 0 auto", transition: "color .13s", color: track && track.fav ? "var(--primary)" : "var(--text-3)" }}>
          <Heart size={14} fill={track && track.fav ? "currentColor" : "none"} />
        </button>
      </div>

      {/* transporte y progreso */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={toggleShuffle} title="Aleatorio" aria-label="Aleatorio" aria-pressed={shuffle} className="hb-text" style={{ ...secundarioBtn, transition: "color .13s", color: shuffle ? "var(--primary)" : "var(--text-3)" }}>
            <Shuffle size={14} />
          </button>
          <button onClick={irAnterior} title="Anterior" aria-label="Anterior" className="hb-s2t" style={transportBtn}>
            <SkipBack size={15} fill="currentColor" />
          </button>
          <button onClick={togglePlay} title="Reproducir/Pausar" aria-label={playing ? "Pausar" : "Reproducir"} className="hb-primary hb-active-scale" style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--primary-fill)", color: "var(--on-primary)", display: "grid", placeItems: "center", transition: "transform .1s,background .14s" }}>
            {playing ? <Pause size={15} fill="currentColor" stroke="none" /> : <Play size={15} fill="currentColor" stroke="none" style={{ marginLeft: 1 }} />}
          </button>
          <button onClick={irSiguiente} title="Siguiente" aria-label="Siguiente" className="hb-s2t" style={transportBtn}>
            <SkipForward size={15} fill="currentColor" />
          </button>
          {/* Tres modos en un botón: sin repetir, la lista o la canción. El
              icono con el 1 es la canción, como en cualquier reproductor. */}
          <button onClick={toggleRepeat} title={NOMBRE_REPETIR[repeat]} aria-label={NOMBRE_REPETIR[repeat]} aria-pressed={repeat !== "no"} className="hb-text" style={{ ...secundarioBtn, transition: "color .13s", color: repeat !== "no" ? "var(--primary)" : "var(--text-3)" }}>
            {repeat === "una" ? <Repeat1 size={14} /> : <Repeat size={14} />}
          </button>
        </div>
        <Progreso track={track} />
      </div>

      {/* de dónde sale lo que suena, y el volumen */}
      <div style={{ width: 215, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {/* Qué cola está sonando. Poner una canción desde la biblioteca en
            mitad de un culto deja el transporte siguiendo la biblioteca, y sin
            esto no habría forma de notarlo hasta que sonara lo que no tocaba. */}
        {alProyector ? (
          // Lo que suena sale por el proyector. El volumen de al lado le
          // llega igual: es el mismo sonido, lo reproduce la otra ventana.
          <span style={{ fontSize: "10.5px", whiteSpace: "nowrap", color: "var(--danger)", background: "var(--danger-soft)", padding: "1px 6px", borderRadius: 5, fontWeight: 600 }}>
            En el proyector
          </span>
        ) : (
          <span
            title={otraCola ? "Lo que suena sigue el orden de la biblioteca, no el de esta lista" : undefined}
            style={{
              fontSize: "10.5px",
              whiteSpace: "nowrap",
              ...(otraCola
                ? { color: "var(--warning)", background: "var(--warning-soft)", padding: "1px 6px", borderRadius: 5, fontWeight: 600 }
                : { color: "var(--text-3)" }),
            }}
          >
            Suena: {queueOrigen === "culto" ? "la lista" : "la biblioteca"}
          </span>
        )}
        {proyectando && (
          <button onClick={cerrarProyeccion} title="Cerrar la proyección" aria-label="Cerrar la proyección" className="hb-s2t" style={{ ...secundarioBtn, color: "var(--danger)", flex: "0 0 auto" }}>
            <MonitorX size={14} />
          </button>
        )}
        {/* Siempre, suene donde suene: el volumen es lo que más se toca un
            domingo, y esconderlo con un video en el proyector dejaba sin
            forma de bajarlo justo cuando más falta hacía. */}
        <button onClick={toggleMute} title="Silenciar" aria-label="Silenciar" aria-pressed={muted} className="hb-s2t" style={{ ...secundarioBtn, color: "var(--text-2)", flex: "0 0 auto" }}>
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <div style={{ width: 54, display: "flex", alignItems: "center" }}>
          <DragBar
            fraction={volPct / 100}
            onChange={setVolume}
            fillBg="var(--text-2)"
            thumbBg="var(--text)"
            thumbSize={9}
            etiqueta="Volumen"
            texto={muted ? "silenciado" : `${Math.round(volPct)} %`}
            paso={0.05}
          />
        </div>
      </div>
    </footer>
  );
}
