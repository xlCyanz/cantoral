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
import { isTauri, toAssetUrl, updateTrackDuration } from "./api";
import { fmt } from "./covers";
import { motivoDeError } from "./formatos";
import { useStore } from "../store";
import { volumenEfectivo } from "./proyeccion";
import type { Track } from "./types";

/** Manejadores para el elemento, que informan al store de lo que va pasando. */
export interface ManejadoresDeMedios {
  onTimeUpdate: (e: { currentTarget: HTMLMediaElement }) => void;
  onLoadedMetadata: (e: { currentTarget: HTMLMediaElement }) => void;
  onEnded: () => void;
  onError: () => void;
}

/**
 * Apunta en el store por dónde va lo que suena.
 *
 * El elemento avisa unas cuatro veces por segundo, pero la barra solo enseña
 * segundos enteros. Escribir el mismo valor despertaría igual a todos los
 * suscriptores del store —cientos con la biblioteca en pantalla—, así que solo
 * se escribe cuando cambia el segundo.
 */
export function informarPosicion(segundos: number): void {
  const pos = Math.floor(segundos);
  if (useStore.getState().posSec !== pos) useStore.setState({ posSec: pos });
}

/**
 * Pone la duración real del archivo en su pista.
 *
 * Casi siempre ya coincide, y entonces no se rehace el catálogo: reemplazarlo
 * entero volvería a pintar la biblioteca al dar al play.
 */
export function fijarDuracion(id: string, d: number): void {
  const actual = useStore.getState().tracks.find((t) => t.id === id);
  if (!actual || actual.durSec === d) return;
  useStore.setState((st) => ({
    tracks: st.tracks.map((t) => (t.id === id ? { ...t, durSec: d, dur: fmt(d) } : t)),
  }));
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
  const volume = useStore((s) => s.volume);
  const muted = useStore((s) => s.muted);

  // Solo la pista, no el objeto: el catálogo entero se reemplaza en cada
  // refresco y recargar el archivo en mitad de una canción la cortaría.
  const cargableId = activo && track && track.path && !track.missing ? track.id : null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.pause();
    el.removeAttribute("src");
    if (isTauri() && track && cargableId) {
      let cancelado = false;
      void toAssetUrl(track.path!).then((url) => {
        const actual = ref.current;
        if (cancelado || !actual) return;
        actual.src = url;
        // El de ahora y no el de cuando se pidió el archivo: entre una cosa y
        // otra se puede haber movido la barra —pasa al saltar de pista con el
        // dedo en el volumen—, y el efecto de abajo ya lo había puesto.
        actual.volume = volumenEfectivo(useStore.getState());
        if (useStore.getState().playing) actual.play().catch(() => {});
      });
      return () => {
        cancelado = true;
        el.pause();
        el.removeAttribute("src");
      };
    }
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
    if (el) el.volume = volumenEfectivo({ volume, muted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, muted]);

  // Un salto en `posSec` es alguien moviendo la barra. El margen evita pelearse
  // con el `timeupdate` que el propio elemento acaba de mandar.
  //
  // Suscrito al store y no leído con `useStore`: la posición cambia cada
  // segundo, y leída aquí volvía a pintar cada segundo al componente que usa
  // este hook —la barra del reproductor entera, o el panel de detalle— solo
  // para comprobar que no había ningún salto.
  useEffect(
    () =>
      useStore.subscribe((s, antes) => {
        if (s.posSec === antes.posSec) return;
        const el = ref.current;
        if (el && el.src && Math.abs(el.currentTime - s.posSec) > 1.5) el.currentTime = s.posSec;
      }),
    [ref],
  );

  return {
    onTimeUpdate: (e) => informarPosicion(e.currentTarget.currentTime),
    onLoadedMetadata: (e) => {
      if (!activo || !track || useStore.getState().playerId !== track.id) return;
      // La duración real del archivo manda sobre la que dijeron las etiquetas.
      const d = Math.round(e.currentTarget.duration);
      if (Number.isFinite(d) && d > 0) {
        if (track.video && track.path && track.durSec !== d) {
          void updateTrackDuration(track.id, track.path, d)
            .catch((error) => console.error("video duration failed", error));
        }
        fijarDuracion(track.id, d);
      }
    },
    onEnded: () => {
      const st = useStore.getState();
      st.advance();
      // Repetir la canción: el elemento ya disparó `ended`, así que hay que rebobinarlo
      // y arrancarlo a mano.
      if (st.repeat === "una") {
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
