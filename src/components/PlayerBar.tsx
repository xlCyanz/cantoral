import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Heart, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, SquareArrowOutUpRight, Volume2, VolumeX } from "lucide-react";
import { cur, useStore } from "../store";
import { coverStyle, fmt, hasCover } from "../lib/covers";
import { isTauri, osShortName, toAssetUrl } from "../lib/api";

/** Draggable progress / volume track (ported from dragBar). */
function DragBar({
  fraction,
  onChange,
  fillBg,
  thumbBg,
  thumbSize,
}: {
  fraction: number;
  onChange: (f: number) => void;
  fillBg: string;
  thumbBg: string;
  thumbSize: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = Math.min(100, Math.max(0, fraction * 100));

  const start = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const calc = (x: number) => Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    onChange(calc(e.clientX));
    const mv = (ev: PointerEvent) => onChange(calc(ev.clientX));
    const up = () => {
      document.removeEventListener("pointermove", mv);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", mv);
    document.addEventListener("pointerup", up);
  };

  return (
    <div onPointerDown={start} style={{ flex: 1, height: 16, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}>
      <div ref={trackRef} style={{ width: "100%", height: 5, borderRadius: 4, background: "var(--surface-3)", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: pct + "%", borderRadius: 4, background: fillBg }} />
        <div style={{ position: "absolute", top: "50%", left: pct + "%", width: thumbSize, height: thumbSize, borderRadius: "50%", background: thumbBg, transform: "translate(-50%,-50%)", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
      </div>
    </div>
  );
}

const transportBtn: CSSProperties = { width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", color: "var(--text)" };

export default function PlayerBar() {
  // This is the one component that has to re-render several times a second, so
  // it reads the fields it shows one by one — reading the whole store here used
  // to drag the entire library table along with every tick.
  const track = useStore((s) => cur(s) ?? s.tracks[0]);
  const posSec = useStore((s) => s.posSec);
  const playing = useStore((s) => s.playing);
  const volume = useStore((s) => s.volume);
  const muted = useStore((s) => s.muted);
  const shuffle = useStore((s) => s.shuffle);
  const repeat = useStore((s) => s.repeat);
  const onFav = useStore((s) => s.onFav);
  const onOpenExternal = useStore((s) => s.onOpenExternal);
  const toggleShuffle = useStore((s) => s.toggleShuffle);
  const togglePlay = useStore((s) => s.togglePlay);
  const toggleRepeat = useStore((s) => s.toggleRepeat);
  const toggleMute = useStore((s) => s.toggleMute);
  const seekToFraction = useStore((s) => s.seekToFraction);
  const setVolume = useStore((s) => s.setVolume);
  const irAnterior = useStore((s) => s.prev);
  const irSiguiente = useStore((s) => s.next);

  const durS = track ? track.durSec : 1;
  const progPct = Math.min(100, (posSec / durS) * 100);
  const volPct = (muted ? 0 : volume) * 100;

  // ---- integrated audio playback (Tauri only; browser uses the timer) ----
  const audioRef = useRef<HTMLAudioElement>(null);
  const playableId = track && track.path && !track.video && !track.missing ? track.id : null;

  // Load the current track's asset URL when it becomes playable.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (isTauri() && track && playableId) {
      let cancelled = false;
      void toAssetUrl(track.path!).then((url) => {
        if (cancelled || !audioRef.current) return;
        audioRef.current.src = url;
        audioRef.current.volume = muted ? 0 : volume;
        if (useStore.getState().playing) audioRef.current.play().catch(() => {});
      });
      return () => { cancelled = true; };
    }
    a.removeAttribute("src");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playableId]);

  // Play / pause + volume follow store state.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !a.src) return;
    if (playing) a.play().catch(() => {});
    else a.pause();
  }, [playing]);
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = muted ? 0 : volume;
  }, [volume, muted]);
  // Sync a user seek (a jump in posSec) into the audio element.
  useEffect(() => {
    const a = audioRef.current;
    if (a && a.src && Math.abs(a.currentTime - posSec) > 1.5) a.currentTime = posSec;
  }, [posSec]);

  return (
    <footer style={{ height: 88, flex: "0 0 auto", background: "var(--bg-2)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, padding: "0 20px", zIndex: 6 }}>
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(e) => useStore.setState({ posSec: Math.floor((e.target as HTMLAudioElement).currentTime) })}
        onLoadedMetadata={(e) => {
          const d = Math.round((e.target as HTMLAudioElement).duration);
          if (Number.isFinite(d) && d > 0) {
            useStore.setState((st) => ({
              tracks: st.tracks.map((t) => (t.id === st.playerId ? { ...t, durSec: d, dur: fmt(d) } : t)),
            }));
          }
        }}
        onEnded={() => {
          const st = useStore.getState();
          st.advance();
          // Repeat-one: the element already fired `ended`, so rewind and restart it.
          if (st.repeat) {
            const a = audioRef.current;
            if (a) {
              a.currentTime = 0;
              void a.play().catch(() => {});
            }
          }
        }}
        onError={() => {
          if (audioRef.current?.src) useStore.getState().showToast("No se pudo reproducir el archivo", "error");
        }}
        style={{ display: "none" }}
      />
      {/* now playing */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, width: 280, minWidth: 0 }}>
        <div style={coverStyle(track, 56)}>
          {!hasCover(track) && (
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "13.5px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track ? track.titulo : "—"}</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track ? track.artista : ""}</div>
        </div>
        <button onClick={() => track && onFav(track.id)} title="Favorita" className="hb-s2" style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", flex: "0 0 auto", transition: "background .13s", color: track && track.fav ? "var(--primary)" : "var(--text-3)" }}>
          <Heart size={16} fill={track && track.fav ? "currentColor" : "none"} />
        </button>
      </div>

      {/* transport + progress */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={toggleShuffle} title="Aleatorio" className="hb-text" style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", transition: "color .13s", color: shuffle ? "var(--primary)" : "var(--text-3)" }}>
            <Shuffle size={16} />
          </button>
          <button onClick={irAnterior} title="Anterior" className="hb-s2" style={transportBtn}>
            <SkipBack size={17} fill="currentColor" />
          </button>
          <button onClick={togglePlay} title="Reproducir/Pausar" className="hb-primary hb-active-scale" style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--primary-fill)", color: "var(--on-primary)", display: "grid", placeItems: "center", boxShadow: "var(--sh-sm)", transition: "transform .1s,background .14s" }}>
            {playing ? <Pause size={19} fill="currentColor" stroke="none" /> : <Play size={20} fill="currentColor" stroke="none" style={{ marginLeft: 2 }} />}
          </button>
          <button onClick={irSiguiente} title="Siguiente" className="hb-s2" style={transportBtn}>
            <SkipForward size={17} fill="currentColor" />
          </button>
          <button onClick={toggleRepeat} title="Repetir" className="hb-text" style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", transition: "color .13s", color: repeat ? "var(--primary)" : "var(--text-3)" }}>
            <Repeat size={16} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
          <span style={{ fontSize: 11, color: "var(--text-2)", fontVariantNumeric: "tabular-nums", width: 34, textAlign: "right" }}>{fmt(posSec)}</span>
          <DragBar fraction={progPct / 100} onChange={seekToFraction} fillBg="var(--primary)" thumbBg="var(--primary)" thumbSize={12} />
          <span style={{ fontSize: 11, color: "var(--text-2)", fontVariantNumeric: "tabular-nums", width: 34 }}>{track ? track.dur : "0:00"}</span>
        </div>
      </div>

      {/* right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, width: 280, justifyContent: "flex-end" }}>
        <button onClick={() => track && onOpenExternal(track.id)} title="Abrir en el reproductor del sistema" className="hb-s2t" style={{ height: 32, display: "flex", alignItems: "center", gap: 7, padding: "0 11px", borderRadius: 9, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text-2)", fontSize: 12, fontWeight: 600, transition: "background .14s,color .14s" }}>
          <SquareArrowOutUpRight size={14} />{osShortName()}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: 132 }}>
          <button onClick={toggleMute} title="Silenciar" className="hb-s2t" style={{ width: 28, height: 28, display: "grid", placeItems: "center", color: "var(--text-2)", borderRadius: 7 }}>
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <DragBar fraction={volPct / 100} onChange={setVolume} fillBg="var(--text-2)" thumbBg="var(--text)" thumbSize={11} />
        </div>
      </div>
    </footer>
  );
}
