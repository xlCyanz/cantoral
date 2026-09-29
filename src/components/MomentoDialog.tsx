import { useState } from "react";
import { momentosPorId, useStore } from "../store";
import { TIPOS_DE_MOMENTO, etiquetaDeTipo } from "../lib/momentos";
import { botonDialogoPrimario, botonDialogoSecundario } from "../lib/styles";
import type { TipoMomento } from "../lib/types";
import IconoDeMomento from "./IconoDeMomento";
import Modal from "./Modal";

const label = { display: "block", fontSize: "12.5px", fontWeight: 600, color: "var(--text-2)", marginBottom: 7 } as const;
const field = {
  width: "100%",
  height: 42,
  border: "1px solid var(--border-2)",
  background: "var(--surface-2)",
  borderRadius: 10,
  padding: "0 12px",
  fontSize: "13.5px",
  color: "var(--text)",
  outline: "none",
} as const;

/**
 * Añadir un momento sin música al culto, o cambiar uno (#145).
 *
 * Como `NewListDialog`: esto solo decide si está abierto y con qué; el
 * formulario va aparte bajo una `key`, así que abrirlo sobre otro momento lo
 * vuelve a montar con sus valores.
 */
export default function MomentoDialog() {
  const abierto = useStore((s) => s.dialog === "momento");
  const editado = useStore((s) => (s.momentoEditado ? momentosPorId(s.playlists).get(s.momentoEditado) : undefined));
  if (!abierto) return null;
  return (
    <FormularioDeMomento
      key={editado?.id ?? "nuevo"}
      editando={!!editado}
      tipoInicial={editado?.tipo ?? "oracion"}
      tituloInicial={editado?.titulo ?? ""}
      textoInicial={editado?.texto ?? ""}
    />
  );
}

function FormularioDeMomento({
  editando,
  tipoInicial,
  tituloInicial,
  textoInicial,
}: {
  editando: boolean;
  tipoInicial: TipoMomento;
  tituloInicial: string;
  textoInicial: string;
}) {
  const closeDialog = useStore((s) => s.closeDialog);
  const guardarMomento = useStore((s) => s.guardarMomento);
  const [tipo, setTipo] = useState<TipoMomento>(tipoInicial);
  const [titulo, setTitulo] = useState(tituloInicial);
  const [texto, setTexto] = useState(textoInicial);

  // El título es opcional al escribir: vacío, el momento se llama como su
  // tipo. «Oración» es lo que pondría casi todo el mundo, y obligar a teclearlo
  // sería un paso de más cada domingo.
  const tituloFinal = titulo.trim() || etiquetaDeTipo(tipo);
  const submit = () => guardarMomento(tipo, tituloFinal, texto);

  return (
    <Modal labelledBy="momento-dialog-title" onClose={closeDialog} maxWidth={480}>
      <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 13 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <IconoDeMomento tipo={tipo} size={20} />
        </div>
        <div>
          <h2 id="momento-dialog-title" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 2px" }}>
            {editando ? "Editar momento" : "Añadir un momento"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>
            Sin música. En el proyector sale el título sobre negro y la proyección espera a «Siguiente».
          </p>
        </div>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div id="momento-tipo" style={label}>Qué es</div>
          <div role="group" aria-labelledby="momento-tipo" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TIPOS_DE_MOMENTO.map((t) => {
              const puesto = tipo === t.tipo;
              return (
                <button
                  key={t.tipo}
                  type="button"
                  onClick={() => setTipo(t.tipo)}
                  aria-pressed={puesto}
                  className="hb-s2"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    height: 34,
                    padding: "0 12px",
                    borderRadius: 9,
                    border: `1px solid ${puesto ? "var(--primary)" : "var(--border-2)"}`,
                    background: puesto ? "var(--primary-soft)" : "var(--surface-2)",
                    color: puesto ? "var(--primary)" : "var(--text)",
                    fontSize: "12.5px",
                    fontWeight: 600,
                  }}
                >
                  <IconoDeMomento tipo={t.tipo} size={14} />
                  {t.etiqueta}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label htmlFor="momento-titulo" style={label}>Título</label>
          <input
            id="momento-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            autoFocus
            placeholder={etiquetaDeTipo(tipo)}
            className="in-focus"
            style={field}
          />
        </div>
        <div>
          <label htmlFor="momento-texto" style={label}>
            Debajo del título <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span>
          </label>
          <input
            id="momento-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Salmo 23, quién predica…"
            className="in-focus"
            style={field}
          />
        </div>
      </div>

      <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--surface-2)" }}>
        <button onClick={closeDialog} className="hb-s3" style={botonDialogoSecundario}>Cancelar</button>
        <button onClick={submit} className="hb-primary" style={botonDialogoPrimario}>
          {editando ? "Guardar cambios" : "Añadir al culto"}
        </button>
      </div>
    </Modal>
  );
}
