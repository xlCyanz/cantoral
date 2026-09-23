// El cableado entre un elemento de medios y el transporte del store.
//
// Hay dos elementos y solo uno suena a la vez: el `<audio>` escondido de la
// barra del reproductor y el `<video>` del panel de detalle. La pista decide
// cuál — un video no cabe en un `<audio>`, y un `<video>` de 16:9 en la barra
// no tendría dónde verse.
//
// El cableado es el mismo para los dos, y por eso está aquí y no duplicado:
// cargar la ruta, seguir el play/pausa, el volumen y los saltos de posición, y
// devolver los manejadores que informan de vuelta. Dos copias de esto se
// habrían separado al primer arreglo que se hiciera solo en una.

import { useEffect } from "react";
import type { RefObject } from "react";
import { isTauri, toAssetUrl } from "./api";
import { fmt } from "./covers";
import { motivoDeError } from "./formatos";
import { useStore } from "../store";
import type { Track } from "./types";

/** Manejadores para el elemento, que informan al store de lo que va pasando. */
export interface ManejadoresDeMedios {
  onTimeUpdate: (e: { currentTarget: HTMLMediaElement }) => void;
  onLoadedMetadata: (e: { currentTarget: HTMLMediaElement }) => void;
  onEnded: () => void;
  onError: () => void;
}

/**
 * Engancha un elemento de medios al transporte.
 *
 * `activo` es lo que reparte el trabajo entre los dos elementos: solo el que
 * corresponde a la pista carga nada. El otro se queda sin `src`, que es lo que
 * hace que no suene — y no basta con pausarlo, porque un elemento con `src`
 * sigue reservando el archivo.
 */
export function useReproductor(
  ref: RefObject<HTMLMediaElement | null>,
  track: Track | null,
  activo: boolean,
): ManejadoresDeMedios {
  const playing = useStore((s) => s.playing);
  const posSec = useStore((s) => s.posSec);
  const volume = useStore((s) => s.volume);
  const muted = useStore((s) => s.muted);

  // Solo la pista, no el objeto: el catálogo entero se reemplaza en cada
  // refresco y recargar el archivo en mitad de una canción la cortaría.
  const cargableId = activo && track && track.path && !track.missing ? track.id : null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isTauri() && track && cargableId) {
      let cancelado = false;
      void toAssetUrl(track.path!).then((url) => {
        const actual = ref.current;
        if (cancelado || !actual) return;
        actual.src = url;
        actual.volume = muted ? 0 : volume;
        if (useStore.getState().playing) actual.play().catch(() => {});
      });
      return () => {
        cancelado = true;
      };
    }
    el.removeAttribute("src");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargableId]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !el.src) return;
    if (playing) el.play().catch(() => {});
    else el.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => {
    const el = ref.current;
    if (el) el.volume = muted ? 0 : volume;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, muted]);

  // Un salto en `posSec` es alguien moviendo la barra. El margen evita pelearse
  // con el `timeupdate` que el propio elemento acaba de mandar.
  useEffect(() => {
    const el = ref.current;
    if (el && el.src && Math.abs(el.currentTime - posSec) > 1.5) el.currentTime = posSec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posSec]);

  return {
    onTimeUpdate: (e) => useStore.setState({ posSec: Math.floor(e.currentTarget.currentTime) }),
    onLoadedMetadata: (e) => {
      // La duración real del archivo manda sobre la que dijeron las etiquetas.
      const d = Math.round(e.currentTarget.duration);
      if (Number.isFinite(d) && d > 0) {
        useStore.setState((st) => ({
          tracks: st.tracks.map((t) => (t.id === st.playerId ? { ...t, durSec: d, dur: fmt(d) } : t)),
        }));
      }
    },
    onEnded: () => {
      const st = useStore.getState();
      st.advance();
      // Repetir una: el elemento ya disparó `ended`, así que hay que rebobinarlo
      // y arrancarlo a mano.
      if (st.repeat) {
        const el = ref.current;
        if (el) {
          el.currentTime = 0;
          void el.play().catch(() => {});
        }
      }
    },
    onError: () => {
      const el = ref.current;
      if (!el?.src) return;
      // El mensaje importa más que antes: mientras existió el desvío al
      // reproductor del sistema, una pista que el webview no abría tenía una
      // segunda oportunidad. Ahora esta es la única explicación que va a
      // haber, así que dice qué formato era — que es lo que hay que convertir.
      useStore.getState().showToast(motivoDeError(el.error?.code, track?.path), {
        detalle: track ? `«${track.titulo}» se queda sin sonar.` : undefined,
        tipo: "error",
      });
    },
  };
}
