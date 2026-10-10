import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ListPlus, Search } from "lucide-react";
import { useStore } from "../store";
import { ALTO_FILA, ALTO_LISTA, alternar, buscarCanciones, marcarRango, siguienteElegible, textoDeAgregar } from "../lib/elegirCanciones";
import { DESDE, aplanar, ventana } from "../lib/virtual";
import { botonDialogoPrimario, botonDialogoSecundario } from "../lib/styles";
import Modal from "./Modal";

/** Orden vacío compartido, para que un culto sin nada no estrene arreglo en cada lectura. */
const VACIA: string[] = [];

/**
 * Elegir varias canciones de la biblioteca y meterlas en el culto abierto.
 *
 * Es la dirección contraria a «Agregar a un culto»: allí se parte de la
 * biblioteca y se elige el culto; aquí se está armando el culto y se va a
 * buscar lo que falta, sin salir de él y sin ir canción por canción.
 *
 * Solo decide si está abierto. Lo de dentro es otro componente para que al
 * cerrar se desmonte y se lleve lo que se había marcado: volver a abrirlo
 * empieza de cero.
 */
export default function AgregarCancionesDialog() {
  const abierto = useStore((s) => s.dialog === "agregarCanciones");
  if (!abierto) return null;
  return <EleccionDeCanciones />;
}

function EleccionDeCanciones() {
  const tracks = useStore((s) => s.tracks);
  const nombre = useStore((s) => s.playlists.find((p) => p.id === s.curPlaylist)?.nombre ?? "");
  const orden = useStore((s) => s.plOrder[s.curPlaylist] || VACIA);
  const closeDialog = useStore((s) => s.closeDialog);
  const agregarAlCultoAbierto = useStore((s) => s.agregarAlCultoAbierto);

  const [consulta, setConsulta] = useState("");
  /** Las marcadas, en el orden en que se marcaron: así entran al culto. */
  const [elegidas, setElegidas] = useState<string[]>([]);
  /** Desde dónde mide un Mayúsculas + clic. */
  const [ancla, setAncla] = useState<string | null>(null);
  /** La fila que tiene (o tendrá) el foco del teclado; -1 si ninguna. */
  const [activo, setActivo] = useState(-1);
  const [desplazado, setDesplazado] = useState(0);

  const caja = useRef<HTMLDivElement>(null);
  const buscador = useRef<HTMLInputElement>(null);
  /** Si el clic o el Espacio que está cambiando una casilla llevaba Mayúsculas. */
  const conMayus = useRef(false);
  /** Si, tras pintar, el foco tiene que ir a la fila activa. */
  const enfocarActiva = useRef(false);

  const yaEstan = useMemo(() => new Set(orden), [orden]);
  const lista = useMemo(() => buscarCanciones(tracks, consulta), [tracks, consulta]);
  const ids = useMemo(() => lista.map((t) => t.id), [lista]);
  const plano = useMemo(
    () => aplanar([{ showHeader: false, clave: "", colapsado: false, tracks: lista.map((track, num) => ({ track, num })) }], { fila: ALTO_FILA, grupo: 0 }),
    [lista],
  );

  // Con miles de canciones solo existen las filas cerca de lo que se ve, como
  // en la tabla de la biblioteca. Por debajo de ese umbral, todas.
  const { desde, hasta } = lista.length > DESDE ? ventana(plano, desplazado, ALTO_LISTA) : { desde: 0, hasta: lista.length };
  // La parada del Tab en la lista: la activa, o la primera que se puede marcar.
  const parada = activo >= 0 && activo < ids.length ? activo : (siguienteElegible(ids, -1, 1, yaEstan) ?? -1);
  // La fila con el foco se pinta aunque se haya ido de la ventana con la
  // rueda: si se desmontara, el foco caería al documento y Tab se perdería.
  const indices: number[] = [];
  for (let i = desde; i < hasta; i++) indices.push(i);
  if (parada >= 0 && (parada < desde || parada >= hasta)) indices.push(parada);

  useEffect(() => {
    if (!enfocarActiva.current) return;
    enfocarActiva.current = false;
    caja.current?.querySelector<HTMLInputElement>(`input[data-indice="${activo}"]`)?.focus({ preventScroll: true });
  }, [activo, desde]);

  /** Llevar el foco a una fila, desplazando la lista lo justo para que se vea. */
  const irA = (i: number) => {
    const el = caja.current;
    if (el) {
      const arriba = i * ALTO_FILA;
      let top = el.scrollTop;
      if (arriba < top) top = arriba;
      else if (arriba + ALTO_FILA > top + ALTO_LISTA) top = arriba + ALTO_FILA - ALTO_LISTA;
      el.scrollTop = top;
      setDesplazado(top);
    }
    enfocarActiva.current = true;
    setActivo(i);
  };

  const buscar = (texto: string) => {
    setConsulta(texto);
    // Otra búsqueda es otra lista: arriba del todo y sin fila activa. Lo
    // marcado se queda; buscar «santo», marcar, buscar «gloria» y marcar es
    // justo para lo que sirve esto.
    setActivo(-1);
    setDesplazado(0);
    if (caja.current) caja.current.scrollTop = 0;
  };

  const pulsar = (id: string, i: number) => {
    const marcar = !elegidas.includes(id);
    setElegidas(conMayus.current && ancla ? marcarRango(ids, elegidas, ancla, id, marcar, yaEstan) : alternar(elegidas, id));
    conMayus.current = false;
    setAncla(id);
    setActivo(i);
  };

  const confirmar = () => {
    if (elegidas.length > 0) agregarAlCultoAbierto(elegidas);
  };

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    const enBuscador = el === buscador.current;
    const enFila = el instanceof HTMLInputElement && el.dataset.indice !== undefined;
    if (!enBuscador && !enFila) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const paso = e.key === "ArrowDown" ? 1 : -1;
      if (enBuscador) {
        // Desde el buscador solo se baja: es la puerta de entrada a la lista.
        if (paso === 1) {
          const i = siguienteElegible(ids, -1, 1, yaEstan);
          if (i !== null) irA(i);
        }
        return;
      }
      const i = siguienteElegible(ids, Number(el.dataset.indice), paso, yaEstan);
      if (i !== null) irA(i);
      // Por encima de la primera está el buscador, para afinar sin el ratón.
      else if (paso === -1) buscador.current?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      confirmar();
    } else if (e.key === " " && enFila) {
      // El Espacio lo resuelve la casilla; aquí solo se apunta si iba con
      // Mayúsculas, para marcar el tramo como con el ratón.
      conMayus.current = e.shiftKey;
    }
  };

  const n = elegidas.length;

  return (
    <Modal labelledBy="agregar-canciones-titulo" describedBy="agregar-canciones-ayuda" onClose={closeDialog} maxWidth={560}>
      <div onKeyDown={alTeclear}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--primary-soft)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
              <ListPlus size={19} color="var(--primary)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 id="agregar-canciones-titulo" style={{ fontSize: 17, fontWeight: 700, margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Agregar canciones a «{nombre}»
              </h2>
              {/* Dónde caen y en qué orden, antes de marcar nada. */}
              <p id="agregar-canciones-ayuda" style={{ fontSize: "12.5px", color: "var(--text-2)", margin: 0 }}>
                Entran al final del culto, en el orden en que las marques.
              </p>
            </div>
          </div>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={16} style={{ position: "absolute", left: 12, color: "var(--text-3)", pointerEvents: "none" }} />
            <input
              ref={buscador}
              type="search"
              value={consulta}
              onChange={(e) => buscar(e.target.value)}
              autoFocus
              aria-label="Buscar en la biblioteca"
              aria-controls="agregar-canciones-lista"
              placeholder="Buscar por título, artista o álbum…"
              className="in-focus"
              style={{ width: "100%", height: 38, border: "1px solid var(--border-2)", background: "var(--surface)", borderRadius: 10, padding: "0 12px 0 36px", fontSize: 13, color: "var(--text)" }}
            />
          </div>
        </div>

        <div
          ref={caja}
          id="agregar-canciones-lista"
          role="group"
          aria-label={lista.length === 1 ? "1 canción de la biblioteca" : `${lista.length} canciones de la biblioteca`}
          onScroll={(e) => setDesplazado(e.currentTarget.scrollTop)}
          style={{ height: ALTO_LISTA, overflowY: "auto", position: "relative" }}
        >
          {lista.length === 0 ? (
            <p style={{ margin: 0, padding: "28px 20px", textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>
              {tracks.length === 0 ? "La biblioteca está vacía. Agrega una carpeta de música primero." : `Nada coincide con «${consulta.trim()}».`}
            </p>
          ) : (
            <div style={{ position: "relative", height: lista.length * ALTO_FILA }}>
              {indices.map((i) => {
                const t = lista[i];
                const yaEsta = yaEstan.has(t.id);
                const puesto = elegidas.indexOf(t.id);
                const marcada = yaEsta || puesto >= 0;
                return (
                  <label
                    key={t.id}
                    className={yaEsta ? undefined : "casilla hb-s2"}
                    onClick={(e) => {
                      conMayus.current = e.shiftKey;
                    }}
                    style={{
                      position: "absolute",
                      top: i * ALTO_FILA,
                      left: 0,
                      right: 0,
                      height: ALTO_FILA,
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      padding: "0 20px",
                      cursor: yaEsta ? "default" : "pointer",
                      userSelect: "none",
                      ...(yaEsta ? { opacity: 0.55 } : t.missing ? { opacity: 0.7 } : {}),
                    }}
                  >
                    {/* Una casilla de verdad, escondida, debajo de la pintada,
                        como «Incluir subcarpetas» (#138): Tab llega, Espacio
                        la marca y el lector la anuncia como casilla. */}
                    <input
                      type="checkbox"
                      className="solo-lector"
                      data-indice={i}
                      tabIndex={i === parada ? 0 : -1}
                      checked={marcada}
                      disabled={yaEsta}
                      onChange={() => pulsar(t.id, i)}
                      onFocus={() => setActivo(i)}
                    />
                    {/* Marcada, dice en qué puesto entra; así se ve el orden
                        sin tener que recordarlo. */}
                    <span
                      aria-hidden
                      className="casilla-marca"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        flex: "0 0 auto",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        ...(yaEsta
                          ? { background: "var(--surface-3)", color: "var(--text-2)" }
                          : puesto >= 0
                            ? { background: "var(--primary-fill)", color: "var(--on-primary)" }
                            : { border: "1.5px solid var(--border-2)", background: "var(--surface)" }),
                      }}
                    >
                      {yaEsta ? <Check size={13} strokeWidth={3} /> : puesto >= 0 ? puesto + 1 : null}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: "13.5px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.titulo}</span>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.artista}
                      </span>
                    </span>
                    {yaEsta ? (
                      <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>Ya está en el culto</span>
                    ) : (
                      <span style={{ flex: "0 0 auto", fontSize: 12, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{t.dur}</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)" }}>
          <span aria-live="polite" style={{ flex: 1, minWidth: 0, fontSize: "12.5px", color: "var(--text-2)" }}>
            {n === 0 ? "Ninguna marcada" : n === 1 ? "1 marcada" : `${n} marcadas`}
          </span>
          <button onClick={closeDialog} className="hb-s3" style={botonDialogoSecundario}>Cancelar</button>
          <button
            onClick={confirmar}
            disabled={n === 0}
            className="hb-primary"
            style={{ ...botonDialogoPrimario, display: "flex", alignItems: "center", gap: 8, opacity: n ? 1 : 0.55, cursor: n ? "pointer" : "not-allowed" }}
          >
            <ListPlus size={16} />{textoDeAgregar(n)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
