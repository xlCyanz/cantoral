import { useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import type { EstadoProyeccion, SalidaProyeccion } from "../lib/api";
import { ERROR_AUTOPLAY } from "../lib/formatos";

/**
 * Lo que se ve por el proyector.
 *
 * Esta es toda la interfaz de la ventana de salida: no monta la app, no lee la
 * biblioteca y no puede tocar nada. Recibe por evento lo que tiene que
 * mostrar y lo muestra. Si la ventana principal se cuelga, aquí se queda lo
 * último que llegó en vez de aparecer un error delante de la congregación.
 *
 * Arranca en negro y vuelve a negro: en una proyección el fondo por defecto no
 * es blanco ni gris, es apagado.
 */

/** El elemento que no es este. */
const otro = (c: "a" | "b"): "a" | "b" => (c === "a" ? "b" : "a");

export default function ProjectionOutput() {
  const [salida, setSalida] = useState<SalidaProyeccion>({ vista: { modo: "negro" } });

  // Dos reproductores y no uno.
  //
  // Cambiar la `src` de un elemento que está en pantalla lo deja negro
  // mientras carga el archivo nuevo. Con dos, el siguiente del culto ya está
  // cargado y en pausa en el que no se ve, y pasar a él es enseñarlo y darle
  // al play: sin parpadeo, que es la única diferencia que nota la congregación.
  const refA = useRef<HTMLVideoElement>(null);
  const refB = useRef<HTMLVideoElement>(null);
  const ref = (cual: "a" | "b") => (cual === "a" ? refA : refB);
  /** Qué archivo tiene cargado cada uno, que no es lo mismo que su `src`
   *  resuelta: el navegador la convierte en absoluta y dejaría de coincidir. */
  const cargado = useRef<{ a: string | null; b: string | null }>({ a: null, b: null });
  const [activo, setActivo] = useState<"a" | "b">("a");

  useEffect(() => {
    let soltar: (() => void) | undefined;
    void listen<SalidaProyeccion>("proyeccion", (e) => setSalida(e.payload)).then((f) => {
      soltar = f;
      // Después de suscribirse y no antes: lo que conteste la ventana
      // principal tiene que encontrar a alguien escuchando.
      void emit("proyeccion-lista", {});
    });
    return () => soltar?.();
  }, []);

  const vista = salida.vista;
  const src = vista.modo === "media" ? vista.src : null;
  const reproduciendo = vista.modo === "media" && vista.reproduciendo;

  useEffect(() => {
    const poner = (cual: "a" | "b", archivo: string) => {
      const el = ref(cual).current;
      if (!el) return;
      cargado.current[cual] = archivo;
      el.src = archivo;
      el.load();
    };

    // Quién muestra lo pedido: el que ya lo tiene cargado si alguno lo tiene,
    // y sólo si no, se carga encima del que está en pantalla.
    let cual = activo;
    if (src) {
      if (cargado.current[activo] === src) cual = activo;
      else if (cargado.current[otro(activo)] === src) cual = otro(activo);
      else poner(activo, src);
      if (cual !== activo) setActivo(cual);

      const el = ref(cual).current;
      if (el) {
        if (reproduciendo) {
          // Un webview puede negarse a arrancar sin que nadie haya tocado la
          // ventana. Callarlo dejaría la pantalla grande en negro sin motivo,
          // así que se devuelve como cualquier otro fallo.
          void el.play().catch(() => {
            void emit("proyeccion-estado", {
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
      }
    } else {
      // Negro o un título: se para lo que hubiera sonando, pero no se descarga
      // — volver de un negro a lo mismo tiene que ser instantáneo.
      ref(activo).current?.pause();
    }

    // La precarga va siempre al que no se ve.
    const libre = otro(cual);
    const siguiente = salida.precarga ?? null;
    if (siguiente && cargado.current[libre] !== siguiente) poner(libre, siguiente);
  }, [src, reproduciendo, salida.precarga, activo]);

  /** Lo que se devuelve a quien opera, sólo del elemento que está en pantalla. */
  const reportar = (cual: "a" | "b", parcial: Partial<EstadoProyeccion>) => {
    if (cual !== activo) return;
    const el = ref(cual).current;
    void emit("proyeccion-estado", {
      src: cargado.current[cual] ?? "",
      pos: Math.floor(el?.currentTime ?? 0),
      dur: Number.isFinite(el?.duration) ? Math.round(el?.duration ?? 0) : 0,
      fin: false,
      ...parcial,
    } satisfies EstadoProyeccion);
  };

  const reproductor = (cual: "a" | "b") => (
    <video
      key={cual}
      ref={ref(cual)}
      preload="auto"
      playsInline
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        background: "#000",
        // Sólo se ve el activo, y sólo si lo que trae es imagen: un audio se
        // proyecta como su título sobre el negro, no como un rectángulo vacío.
        opacity: cual === activo && vista.modo === "media" && vista.video ? 1 : 0,
      }}
      onTimeUpdate={() => reportar(cual, {})}
      onLoadedMetadata={() => reportar(cual, {})}
      onEnded={() => reportar(cual, { fin: true })}
      onError={() => reportar(cual, { error: ref(cual).current?.error?.code ?? 0 })}
    />
  );

  const titulo = vista.modo === "titulo" || (vista.modo === "media" && !vista.video) ? vista.titulo : null;
  const sub = vista.modo === "titulo" || vista.modo === "media" ? vista.sub : undefined;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        color: "rgba(255,255,255,.94)",
        display: "grid",
        placeItems: "center",
        // Nada de esta ventana se puede tocar: es una pantalla, no una
        // interfaz. Sin cursor y sin selección, por si alguien mueve el ratón.
        cursor: "none",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      {reproductor("a")}
      {reproductor("b")}

      {titulo !== null && (
        <div style={{ position: "relative", padding: 40, textAlign: "center", maxWidth: "80vw" }}>
          <div className="display" style={{ fontSize: "5vw", lineHeight: 1.15, textWrap: "balance" }}>
            {titulo}
          </div>
          {sub && (
            <div style={{ marginTop: "1.2vw", fontSize: "1.8vw", color: "rgba(255,255,255,.55)" }}>{sub}</div>
          )}
        </div>
      )}
    </div>
  );
}
