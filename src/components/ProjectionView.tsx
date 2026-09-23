import { useEffect } from "react";
import { MonitorX, Pause, Presentation, Square } from "lucide-react";
import type { CSSProperties } from "react";
import { estrofasEnPantalla, filasDeLista, useStore } from "../store";
import { motivoNoProyectable } from "../lib/formatos";
import { fmt } from "../lib/covers";

/**
 * El panel de mandos de la proyección.
 *
 * Lo que se ve aquí no es lo que sale: aquí están los controles, y por el
 * proyector sale una ventana aparte que no muestra nada de esta. La cola es el
 * culto abierto en su orden, y lo que está en pantalla se señala en ella — en
 * un culto la pregunta no es «qué se está reproduciendo» sino «por dónde
 * vamos y qué viene ahora».
 *
 * Las dos ventanas están enganchadas en los dos sentidos: de aquí sale lo que
 * hay que mostrar, y de allí vuelve por dónde va, que es lo que llena el
 * tiempo de debajo del título.
 */
const tarjeta: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--surface)",
  padding: "10px 11px",
};

const rotulo: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

const botonBarra: CSSProperties = {
  height: 34,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid var(--border-2)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "12.5px",
  fontWeight: 600,
};

/** Un botón de ajuste, encendido o apagado. */
const mini = (activo: boolean): CSSProperties => ({
  height: 25,
  padding: "0 9px",
  border: `1px solid ${activo ? "var(--primary)" : "var(--border-2)"}`,
  borderRadius: 7,
  background: activo ? "var(--primary-soft)" : "var(--surface-2)",
  color: activo ? "var(--primary)" : "var(--text-2)",
  fontSize: 11,
  fontWeight: activo ? 600 : 400,
  whiteSpace: "nowrap",
});

const OPCIONES_AUDIO = [
  { valor: "negro" as const, etiqueta: "Negro", ayuda: "La pantalla se queda apagada mientras suena." },
  { valor: "portada" as const, etiqueta: "Portada y letra", ayuda: "La letra sobre la carátula de la pista, apagada de fondo." },
  { valor: "letra" as const, etiqueta: "Solo la letra", ayuda: "La letra sobre el negro." },
];

const OPCIONES_TRANSICION = [
  { valor: "negro" as const, etiqueta: "Negro 0,5 s", ayuda: "Medio segundo de negro antes de que arranque lo siguiente." },
  { valor: "cuenta" as const, etiqueta: "Cuenta atrás 3 s", ayuda: "Tres, dos, uno en la pantalla grande antes de arrancar." },
];

export default function ProjectionView() {
  const monitores = useStore((s) => s.monitores);
  const monitorSalida = useStore((s) => s.monitorSalida);
  const proyectando = useStore((s) => s.proyectando);
  const idxProy = useStore((s) => s.proyeccionIdx);
  const proyeccionLista = useStore((s) => s.proyeccionLista);
  const enNegro = useStore((s) => s.proyeccionEnNegro);
  const pos = useStore((s) => s.proyeccionPos);
  const dur = useStore((s) => s.proyeccionDur);
  const fallos = useStore((s) => s.proyeccionFallos);
  const filas = useStore(filasDeLista);
  const cargarMonitores = useStore((s) => s.cargarMonitores);
  const elegirMonitor = useStore((s) => s.elegirMonitor);
  const alternarProyeccion = useStore((s) => s.alternarProyeccion);
  const proyectarElemento = useStore((s) => s.proyectarElemento);
  const proyeccionSiguiente = useStore((s) => s.proyeccionSiguiente);
  const proyeccionNegro = useStore((s) => s.proyeccionNegro);
  const salidaDeAudio = useStore((s) => s.salidaDeAudio);
  const transicionProyeccion = useStore((s) => s.transicionProyeccion);
  const setSalidaDeAudio = useStore((s) => s.setSalidaDeAudio);
  const setTransicionProyeccion = useStore((s) => s.setTransicionProyeccion);
  const estrofa = useStore((s) => s.proyeccionEstrofa);
  const estrofas = useStore(estrofasEnPantalla);
  const loadSheets = useStore((s) => s.loadSheets);
  const openPlaylist = useStore((s) => s.openPlaylist);
  const curPlaylist = useStore((s) => s.curPlaylist);

  // Las pantallas se enchufan y se desenchufan mientras la app está abierta,
  // y normalmente el proyector se conecta justo antes de empezar.
  useEffect(() => {
    void cargarMonitores();
  }, [cargarMonitores]);

  // Las letras no viajan con el catálogo —serían megabytes en cada refresco—,
  // así que se piden al entrar aquí: sin ellas, proyectar la letra no tendría
  // nada que proyectar.
  const ids = filas.map((t) => t.id).join(",");
  useEffect(() => {
    if (ids) void loadSheets(ids.split(","));
  }, [ids, loadSheets]);

  const activo = monitores.find((m) => m.indice === monitorSalida);
  // El índice sólo señala una fila de esta cola si lo que está en el aire sale
  // de esta lista. Abrir otra para buscar algo en pleno culto no puede pintar
  // «en pantalla» sobre una pista que nadie está proyectando.
  const idx = proyeccionLista === curPlaylist ? idxProy : -1;
  const enPantalla = proyectando && idx >= 0 && !enNegro ? filas[idx] : undefined;
  const siguiente = filas[idx + 1];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, padding: "12px 18px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11.5px", color: "var(--text-2)" }}>
            {monitores.length === 0
              ? "No se detecta ninguna pantalla."
              : <>Sale en <strong style={{ color: "var(--text)" }}>{activo?.nombre ?? "—"}</strong></>}
          </div>
        </div>
        <span
          style={{
            flex: "0 0 auto",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            padding: "3px 9px",
            borderRadius: 20,
            background: proyectando ? "var(--danger-soft)" : "var(--surface-3)",
            color: proyectando ? "var(--danger)" : "var(--text-3)",
          }}
        >
          {proyectando ? "En vivo" : "Apagada"}
        </span>
        <button
          onClick={() => openPlaylist(curPlaylist)}
          disabled={!curPlaylist}
          className="hb-s2"
          style={{ flex: "0 0 auto", height: 28, padding: "0 11px", borderRadius: 7, border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)", fontSize: 12, opacity: curPlaylist ? 1 : 0.45 }}
        >
          Volver al culto
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, padding: "0 18px 14px", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <div style={{ width: 214, flex: "0 0 auto", display: "flex", flexDirection: "column", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", overflow: "hidden" }}>
          <div style={{ ...rotulo, flex: "0 0 auto", padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
            Cola del culto
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {filas.length === 0 ? (
              <p style={{ margin: 0, padding: "12px 10px", fontSize: "11.5px", color: "var(--text-2)", lineHeight: 1.55 }}>
                No hay ningún culto abierto. Abre uno en Cultos y su orden se proyecta desde aquí.
              </p>
            ) : (
              filas.map((t, i) => {
                const fallo = fallos[t.id] ?? motivoNoProyectable(t);
                const aqui = proyectando && i === idx && !enNegro;
                const estado = fallo
                  ? fallo
                  : aqui
                    ? "en pantalla"
                    : proyectando && i === idx + 1
                      ? "cargado en pausa"
                      : proyectando && idx >= 0 && (i < idx || (i === idx && enNegro))
                        ? "terminado"
                        : "";
                return (
                  <button
                    key={`${t.id}-${i}`}
                    onClick={() => proyectarElemento(i)}
                    disabled={!proyectando}
                    aria-current={aqui ? "true" : undefined}
                    className={aqui ? undefined : "hb-s2"}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 9px", borderBottom: "1px solid var(--border)", background: aqui ? "var(--primary-soft)" : "transparent", textAlign: "left", cursor: proyectando ? "pointer" : "default" }}
                  >
                    <span style={{ width: 26, height: 20, flex: "0 0 auto", borderRadius: 4, background: t.video ? "#1b1b1b" : "var(--surface-3)", color: t.video ? "rgba(255,255,255,.8)" : "var(--text-3)", display: "grid", placeItems: "center", fontSize: 8, fontWeight: 700, letterSpacing: ".04em" }}>
                      {t.video ? "VID" : "AUD"}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: "11.5px", fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.titulo}
                      </span>
                      {estado && (
                        <span style={{ display: "block", fontSize: 10, fontWeight: fallo || aqui ? 600 : 400, color: fallo ? "var(--danger)" : aqui ? "var(--primary)" : "var(--text-3)" }}>
                          {estado}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: "10.5px", color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{t.dur}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 10 }}>
            <div style={{ flex: 1.45, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ ...rotulo, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: proyectando && !enNegro ? "var(--danger)" : "var(--text-3)" }} />
                En pantalla
              </div>
              {/* Una reproducción de lo que sale, no la salida: es texto sobre
                  negro con el mismo título. Duplicar el video aquí sería
                  decodificarlo dos veces en el portátil que está proyectando. */}
              <div style={{ flex: 1, minHeight: 0, borderRadius: 9, background: "#000", border: "1px solid var(--border-2)", position: "relative", overflow: "hidden", display: "grid", placeItems: "center" }}>
                <div style={{ padding: 20, textAlign: "center", opacity: enPantalla ? 1 : 0, transition: "opacity 220ms" }}>
                  <div className="display" style={{ fontSize: 27, color: "rgba(255,255,255,.94)", lineHeight: 1.2, textWrap: "balance" }}>
                    {enPantalla?.titulo ?? ""}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 8 }}>
                    {enPantalla ? `${enPantalla.video ? "video" : "audio"} · ${fmt(pos)} de ${dur > 0 ? fmt(dur) : enPantalla.dur}` : ""}
                  </div>
                  {enPantalla && estrofas.length > 1 && (
                    <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,.4)", marginTop: 4 }}>
                      Estrofa {Math.min(estrofa + 1, estrofas.length)} de {estrofas.length}
                    </div>
                  )}
                </div>
                <div style={{ position: "absolute", left: 8, bottom: 7, fontSize: "9.5px", color: "rgba(255,255,255,.4)", fontFamily: "ui-monospace, Menlo, monospace" }}>
                  {activo ? `${activo.ancho} × ${activo.alto} · sin controles ni barra de título` : "sin pantalla de salida"}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={rotulo}>Siguiente · cargado en pausa</div>
              <div style={{ flex: 1, minHeight: 0, borderRadius: 9, background: "#0b0b0b", border: "1px dashed var(--border-2)", position: "relative", overflow: "hidden", display: "grid", placeItems: "center" }}>
                <div style={{ textAlign: "center", padding: 10 }}>
                  <div style={{ width: 30, height: 30, margin: "0 auto 8px", borderRadius: "50%", border: "1px solid rgba(255,255,255,.35)", display: "grid", placeItems: "center", color: "rgba(255,255,255,.7)" }}>
                    <Pause size={12} />
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.82)", fontWeight: 500 }}>
                    {siguiente ? siguiente.titulo : "Nada después"}
                  </div>
                  <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,.45)", marginTop: 3 }}>
                    {siguiente
                      ? motivoNoProyectable(siguiente) ?? "listo en 0:00 · arranca sin parpadeo"
                      : "el culto termina aquí"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: "0 0 auto", display: "flex", gap: 10 }}>
          <div style={{ ...tarjeta, flex: 1, minWidth: 0 }}>
            <div style={{ ...rotulo, marginBottom: 7 }}>Pantalla de salida</div>
            {monitores.length === 0 ? (
              <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-2)", lineHeight: 1.55 }}>
                Conecta el proyector y vuelve a entrar aquí. En el modo navegador no hay pantallas que ofrecer.
              </p>
            ) : (
              monitores.map((m) => {
                const elegido = m.indice === monitorSalida;
                return (
                  <button
                    key={m.indice}
                    onClick={() => elegirMonitor(m.indice)}
                    aria-pressed={elegido}
                    className={elegido ? undefined : "hb-s2"}
                    style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "7px 8px", borderRadius: 8, textAlign: "left", background: elegido ? "var(--primary-soft)" : "transparent" }}
                  >
                    <span style={{ width: 13, height: 13, flex: "0 0 auto", borderRadius: "50%", border: `1px solid ${elegido ? "var(--primary)" : "var(--border-2)"}`, display: "grid", placeItems: "center" }}>
                      {elegido && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)" }} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: "11.5px", fontWeight: 500, color: "var(--text)" }}>{m.nombre}</span>
                      <span style={{ display: "block", fontSize: 10, color: "var(--text-3)" }}>
                        {m.ancho} × {m.alto}
                        {m.principal ? " · donde está esta ventana" : ""}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div style={{ ...tarjeta, flex: 1, minWidth: 0 }}>
            <div style={{ ...rotulo, marginBottom: 7 }}>Si la pista es solo audio</div>
            <div style={{ display: "flex", gap: 5, marginBottom: 11, flexWrap: "wrap" }}>
              {OPCIONES_AUDIO.map((o) => (
                <button key={o.valor} onClick={() => setSalidaDeAudio(o.valor)} aria-pressed={salidaDeAudio === o.valor} title={o.ayuda} style={mini(salidaDeAudio === o.valor)}>
                  {o.etiqueta}
                </button>
              ))}
            </div>
            <div style={{ ...rotulo, marginBottom: 7 }}>Entre un elemento y otro</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {OPCIONES_TRANSICION.map((o) => (
                <button key={o.valor} onClick={() => setTransicionProyeccion(o.valor)} aria-pressed={transicionProyeccion === o.valor} title={o.ayuda} style={mini(transicionProyeccion === o.valor)}>
                  {o.etiqueta}
                </button>
              ))}
            </div>
          </div>
          </div>
        </div>
      </div>

      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8, padding: "11px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-2)" }}>
        <button
          onClick={alternarProyeccion}
          disabled={monitores.length === 0}
          className={proyectando ? "hb-danger-solid" : "hb-primary"}
          style={{
            ...botonBarra,
            border: 0,
            background: proyectando ? "var(--danger-fill)" : "var(--primary-fill)",
            color: proyectando ? "var(--on-danger)" : "var(--on-primary)",
            opacity: monitores.length === 0 ? 0.45 : 1,
            cursor: monitores.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {proyectando ? <MonitorX size={15} /> : <Presentation size={15} />}
          {proyectando ? "Cortar la salida" : "Proyectar"}
        </button>
        <button
          onClick={proyeccionNegro}
          disabled={!proyectando}
          className="hb-s2"
          style={{ ...botonBarra, opacity: proyectando ? 1 : 0.45, cursor: proyectando ? "pointer" : "not-allowed" }}
        >
          <Square size={13} />Pantalla en negro <span style={{ opacity: 0.6 }}>B</span>
        </button>
        <button
          onClick={proyeccionSiguiente}
          disabled={!proyectando || filas.length === 0}
          // «Siguiente» es un solo botón porque desde el atril no se quiere
          // elegir entre dos; el título dice a qué va a saltar esta vez.
          title={
            proyectando && estrofa + 1 < estrofas.length
              ? `Pasar a la estrofa ${estrofa + 2} de ${estrofas.length}`
              : siguiente
                ? `Pasar a «${siguiente.titulo}»`
                : "Cerrar el culto y dejar el proyector en negro"
          }
          className="hb-s2"
          style={{ ...botonBarra, opacity: proyectando && filas.length > 0 ? 1 : 0.45, cursor: proyectando && filas.length > 0 ? "pointer" : "not-allowed" }}
        >
          Siguiente <span style={{ opacity: 0.6 }}>→</span>
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--text-2)", textAlign: "right", lineHeight: 1.45 }}>
          La proyección no muestra nada de esta ventana.
          <br />
          <span style={{ color: "var(--text-3)" }}>Esc corta la salida y deja el proyector en negro.</span>
        </div>
      </div>
    </div>
  );
}
