import { useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import type { EstadoProyeccion, SalidaProyeccion, VistaProyeccion } from "../lib/api";
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

/** Cuánto dura el negro entre un elemento y otro. */
const NEGRO_MS = 500;
/** Desde dónde cuenta la cuenta atrás, y cada cuánto baja. */
const CUENTA_DESDE = 3;
const CUENTA_MS = 1000;

/** El mismo mensaje, en pausa: lo que se manda mientras corre la transición. */
function enPausa(p: SalidaProyeccion): SalidaProyeccion {
  return p.vista.modo === "media" ? { ...p, vista: { ...p.vista, reproduciendo: false } } : p;
}

export default function ProjectionOutput() {
  const [salida, setSalida] = useState<SalidaProyeccion>({ vista: { modo: "negro" } });
  /** `null` mientras no hay transición; `0` es el negro y 3..1 la cuenta. */
  const [cuenta, setCuenta] = useState<number | null>(null);

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

  /** Los temporizadores de la transición en curso, para poder cortarla. */
  const relojes = useRef<number[]>([]);

  useEffect(() => {
    const parar = () => {
      for (const id of relojes.current) window.clearTimeout(id);
      relojes.current = [];
    };
    const luego = (ms: number, fn: () => void) => {
      relojes.current.push(window.setTimeout(fn, ms));
    };

    const aplicar = (p: SalidaProyeccion) => {
      // Lo que llegue corta la transición que hubiera: un «negro» pulsado en
      // mitad de una cuenta atrás tiene que cortar ya, no dentro de dos
      // segundos.
      parar();
      if (!p.transicion) {
        setCuenta(null);
        setSalida(p);
        return;
      }
      // Se manda ya, pero en pausa: así el archivo se carga —o se reconoce
      // como ya cargado— detrás del negro, y al acabar la transición arranca
      // sin nada que esperar.
      setSalida(enPausa(p));
      if (p.transicion === "negro") {
        setCuenta(0);
        luego(NEGRO_MS, () => {
          setCuenta(null);
          setSalida(p);
        });
        return;
      }
      setCuenta(CUENTA_DESDE);
      for (let n = CUENTA_DESDE - 1; n >= 1; n--) {
        luego((CUENTA_DESDE - n) * CUENTA_MS, () => setCuenta(n));
      }
      luego(CUENTA_DESDE * CUENTA_MS, () => {
        setCuenta(null);
        setSalida(p);
      });
    };

    let soltar: (() => void) | undefined;
    void listen<SalidaProyeccion>("proyeccion", (e) => aplicar(e.payload)).then((f) => {
      soltar = f;
      // Después de suscribirse y no antes: lo que conteste la ventana
      // principal tiene que encontrar a alguien escuchando.
      void emit("proyeccion-lista", {});
    });
    return () => {
      soltar?.();
      parar();
    };
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

      ref(otro(cual)).current?.pause();
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
      refA.current?.pause();
      refB.current?.pause();
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
        // Sólo se ve el activo, y sólo si lo que trae es imagen: un audio no
        // pinta un rectángulo vacío, pinta lo que diga el ajuste de salida.
        opacity: cual === activo && vista.modo === "media" && vista.video ? 1 : 0,
      }}
      onTimeUpdate={() => reportar(cual, {})}
      onLoadedMetadata={() => reportar(cual, {})}
      onEnded={() => reportar(cual, { fin: true })}
      onError={() => reportar(cual, { error: ref(cual).current?.error?.code ?? 0 })}
    />
  );

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
      <Contenido vista={vista} />

      {/* La transición va encima de todo: mientras corre no se ve ni lo que se
          va ni lo que viene, que es de lo que se trata. */}
      {cuenta !== null && (
        <div style={{ position: "absolute", inset: 0, background: "#000", display: "grid", placeItems: "center" }}>
          {cuenta > 0 && (
            <div className="display" style={{ fontSize: "16vh", lineHeight: 1, color: "rgba(255,255,255,.5)", fontVariantNumeric: "tabular-nums" }}>
              {cuenta}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Lo que va encima del negro: el título, sobre la carátula si la lleva, o nada.
 *
 * Un video no pasa por aquí —ya llena la pantalla—, y con «Negro» elegido
 * tampoco se pinta nada: hay cultos donde lo que se quiere mientras suena la
 * ofrenda es una pantalla apagada.
 */
function Contenido({ vista }: { vista: VistaProyeccion }) {
  if (vista.modo === "negro") return null;
  if (vista.modo === "media" && vista.video) return null;

  const audio = vista.modo === "media" ? vista.audio : undefined;
  if (audio?.tipo === "negro") return null;

  // El título —también el de una pista cuyo archivo no se puede abrir—. Es
  // mejor que un negro con el que nadie sabe si la app se colgó.
  const sub = vista.modo === "titulo" || vista.modo === "media" ? vista.sub : undefined;
  return (
    <>
      {audio?.portada && <Portada src={audio.portada} />}
      <div style={{ position: "relative", padding: 40, textAlign: "center", maxWidth: "80vw" }}>
        <div className="display" style={{ fontSize: "5vw", lineHeight: 1.15, textWrap: "balance" }}>
          {vista.titulo}
        </div>
        {sub && <div style={{ marginTop: "1.2vw", fontSize: "1.8vw", color: "rgba(255,255,255,.55)" }}>{sub}</div>}
      </div>
    </>
  );
}

/** La carátula de la pista a pantalla completa, de fondo para el título. */
function Portada({ src }: { src: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url(${src})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        // Apagada y desenfocada: es un fondo para que el título se lea
        // encima, no una foto que compita con él.
        filter: "brightness(.32) blur(6px)",
        transform: "scale(1.06)",
      }}
    />
  );
}
