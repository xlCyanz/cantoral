import { useEffect, useRef, useState } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import type { EstadoProyeccion, MensajeProyeccion, OrdenProyeccion, SalidaProyeccion } from "../lib/api";
import { ERROR_AUTOPLAY } from "../lib/formatos";
import { hayQueReportar } from "../lib/estadoDeSalida";

/**
 * Lo que se ve por el proyector.
 *
 * Esta es toda la interfaz de la ventana de salida: no monta la app, no lee la
 * biblioteca y no puede tocar nada. Recibe por evento lo que tiene que
 * mostrar —el video que suena en el reproductor, o negro— y lo muestra. Si la
 * ventana principal se cuelga, aquí se queda lo último que llegó en vez de
 * aparecer un error delante de la congregación.
 *
 * Arranca en negro y vuelve a negro: en una proyección el fondo por defecto no
 * es blanco ni gris, es apagado.
 */
export default function ProjectionOutput() {
  const [salida, setSalida] = useState<SalidaProyeccion>({ vista: { modo: "negro" } });
  const ref = useRef<HTMLVideoElement>(null);
  /** Qué archivo tiene cargado, que no es lo mismo que su `src` resuelta: el
   *  navegador la convierte en absoluta y dejaría de coincidir. */
  const cargado = useRef<string | null>(null);
  /** Lo último que se le contó a la principal, para no repetírselo. */
  const reportado = useRef<EstadoProyeccion | null>(null);
  // Lo mismo que `salida`, para quien escucha los eventos: se suscribe una vez
  // y vería siempre la del primer dibujo.
  const salidaRef = useRef(salida);
  useEffect(() => {
    salidaRef.current = salida;
  }, [salida]);

  useEffect(() => {
    /**
     * Saltar a un segundo de lo que está en pantalla, sin tocar qué se ve.
     *
     * Solo si lo que se ve es el archivo al que se refiere: una orden que
     * llega tarde, con lo siguiente ya en pantalla, no lo puede mover.
     */
    const buscar = (o: OrdenProyeccion) => {
      const el = ref.current;
      if (!el || cargado.current !== o.src) return;
      el.currentTime = o.pos;
      // Un video que ya había terminado se queda parado al rebobinarlo; si lo
      // que se pide es que suene, se arranca.
      const v = salidaRef.current.vista;
      if (v.modo === "media" && v.reproduciendo && el.paused) void el.play().catch(() => {});
    };

    const aplicar = (m: MensajeProyeccion) => {
      if ("orden" in m) buscar(m);
      else setSalida(m);
    };

    let soltar: (() => void) | undefined;
    void listen<MensajeProyeccion>("proyeccion", (e) => aplicar(e.payload)).then((f) => {
      soltar = f;
      // Después de suscribirse y no antes: lo que conteste la ventana
      // principal tiene que encontrar a alguien escuchando.
      void emitTo("main", "proyeccion-lista", {});
    });
    return () => soltar?.();
  }, []);

  const vista = salida.vista;
  const src = vista.modo === "media" ? vista.src : null;
  const reproduciendo = vista.modo === "media" && vista.reproduciendo;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!src) {
      // Negro: se para lo que hubiera sonando, pero no se descarga — volver
      // al mismo video tiene que ser instantáneo.
      el.pause();
      return;
    }
    if (cargado.current !== src) {
      cargado.current = src;
      el.src = src;
      el.load();
    }
    if (reproduciendo) {
      // Un webview puede negarse a arrancar sin que nadie haya tocado la
      // ventana. Callarlo dejaría la pantalla grande en negro sin motivo, así
      // que se devuelve como cualquier otro fallo.
      void el.play().catch(() => {
        void emitTo("main", "proyeccion-estado", {
          src,
          pos: 0,
          dur: 0,
          fin: false,
          error: ERROR_AUTOPLAY,
        } satisfies EstadoProyeccion);
      });
    } else {
      el.pause();
    }
  }, [src, reproduciendo]);

  /**
   * Lo que se devuelve a quien opera.
   *
   * Solo a la ventana principal, que es la única que escucha, y solo cuando
   * cambia algo que se ve (ver `estadoDeSalida.ts`): el `timeupdate` llega
   * unas cuatro veces por segundo y la principal enseña segundos enteros.
   */
  const reportar = (parcial: Partial<EstadoProyeccion>, forzar = false) => {
    const el = ref.current;
    const estado: EstadoProyeccion = {
      src: cargado.current ?? "",
      pos: Math.floor(el?.currentTime ?? 0),
      dur: Number.isFinite(el?.duration) ? Math.round(el?.duration ?? 0) : 0,
      fin: false,
      ...parcial,
    };
    if (!hayQueReportar(reportado.current, estado, forzar)) return;
    reportado.current = estado;
    void emitTo("main", "proyeccion-estado", estado);
  };

  return (
    // Una pantalla para la congregación, no una interfaz: que un lector de
    // pantalla no la anuncie al abrirse en el otro monitor (#138).
    <div
      aria-hidden
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        // Nada de esta ventana se puede tocar: es una pantalla, no una
        // interfaz. Sin cursor y sin selección, por si alguien mueve el ratón.
        cursor: "none",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      <video
        ref={ref}
        preload="auto"
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "#000",
          // En negro no se ve el último fotograma: se tapa, no se descarga.
          opacity: src ? 1 : 0,
        }}
        onTimeUpdate={() => reportar({})}
        onLoadedMetadata={() => reportar({}, true)}
        onPlay={() => reportar({}, true)}
        onPause={() => reportar({}, true)}
        onEnded={() => reportar({ fin: true })}
        onError={() => reportar({ error: ref.current?.error?.code ?? 0 })}
      />
    </div>
  );
}
