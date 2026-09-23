import { useStore } from "../store";
import Modal from "./Modal";

/**
 * Confirmation for the actions that cannot be undone: removing an indexed
 * folder, deleting a service list and restoring the database.
 *
 * The request carries real numbers (see `askConfirm` callers), so the dialog
 * names what is about to be lost instead of asking a generic «¿estás seguro?»
 * that everyone learns to click through.
 *
 * «Cancelar» is focused on open, so Enter or Space right after the dialog
 * appears backs out rather than confirming.
 */
export default function ConfirmDialog() {
  const req = useStore((s) => s.confirm);
  const accept = useStore((s) => s.acceptConfirm);
  const close = useStore((s) => s.closeConfirm);
  if (!req) return null;

  return (
    <Modal labelledBy="confirm-title" describedBy="confirm-body" role="alertdialog" onClose={close} maxWidth={420} overlayZ={50} overlayStyle={{ background: "rgba(25,18,12,.5)" }}>
      <div style={{ padding: "18px 18px 15px" }}>
        {/* Sin icono de alarma al lado: el titular ya dice que esto quita algo,
            y un triángulo rojo de 42 px empuja a pulsar «Cancelar» sin leer el
            resto — que es donde está lo que de verdad hay que decidir. */}
        <h2 id="confirm-title" className="display" style={{ fontSize: 21, lineHeight: 1.2, margin: "0 0 8px" }}>
          {req.title}
        </h2>
        <p id="confirm-body" style={{ fontSize: "12.5px", color: "var(--text-2)", margin: "0 0 8px", lineHeight: 1.6 }}>
          {req.message}
        </p>

        {req.detail && (
          <div style={{ background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 8, padding: "9px 11px", fontSize: "11.5px", fontWeight: 500, lineHeight: 1.55, whiteSpace: "pre-line", marginBottom: 8 }}>
            {req.detail}
          </div>
        )}

        {/* Lo que *no* pasa, en su propia caja y en el color normal. Es lo que
            quien duda está buscando, y en gris pequeño al pie no se leía. */}
        {req.safe && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", padding: "9px 11px", marginBottom: 14 }}>
            <div style={{ fontSize: "11.5px", lineHeight: 1.55, color: "var(--text)" }}>{req.safe}</div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {/* «Cancelar» con el foco puesto y el borde de dos píxeles del
              rediseño: pulsar Enter nada más abrirse tiene que echarse atrás,
              no confirmar. */}
          <button
            autoFocus
            onClick={close}
            className="hb-s3"
            style={{ height: 32, padding: "0 15px", borderRadius: 8, border: "2px solid var(--primary)", background: "var(--surface)", color: "var(--text)", fontSize: "12.5px", fontWeight: 600 }}
          >
            Cancelar
          </button>
          <button
            onClick={accept}
            className="hb-danger-solid"
            style={{ height: 32, padding: "0 15px", borderRadius: 8, background: "var(--danger-fill)", color: "var(--on-danger)", fontSize: "12.5px", fontWeight: 600, transition: "filter .14s" }}
          >
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
