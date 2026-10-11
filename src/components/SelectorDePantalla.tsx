import { useStore } from "../store";
import { resolverPantalla } from "../lib/pantallas";

/**
 * Elegir la pantalla de proyección.
 *
 * Uno solo para Proyección y para Configuración: es un solo ajuste —por dónde
 * sale un culto y por dónde sale un video que se pone a sonar—, y dos
 * selectores que se pudieran contradecir harían dudar de cuál manda. Elegir
 * en cualquiera de los dos lo recuerda para los dos y para el próximo
 * arranque.
 *
 * Las pantallas las lee quien lo monta (`cargarMonitores`): se enchufan y se
 * desenchufan con la app abierta, y cada vista sabe cuándo volver a mirar.
 */
export default function SelectorDePantalla() {
  const monitores = useStore((s) => s.monitores);
  const monitorSalida = useStore((s) => s.monitorSalida);
  const guardada = useStore((s) => s.pantallaProyeccion);
  const elegirMonitor = useStore((s) => s.elegirMonitor);

  if (monitores.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-2)", lineHeight: 1.55 }}>
        Conecta el proyector y vuelve a entrar aquí. En el modo navegador no hay pantallas que ofrecer.
      </p>
    );
  }

  // La elegida otro día y que hoy no está: se dice, para que no parezca que
  // la app la olvidó. Sigue guardada y se vuelve a usar en cuanto se conecte.
  const ausente = guardada && resolverPantalla(monitores, guardada) === null;

  return (
    <>
      {monitores.map((m) => {
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
      })}
      {ausente && (
        <p role="status" style={{ margin: "6px 0 0", fontSize: "10.5px", lineHeight: 1.45, color: "var(--warning)" }}>
          La pantalla elegida ({guardada.ancho} × {guardada.alto}) no está conectada. Mientras tanto se usa la marcada; al conectarla, vuelve a ser la de proyección.
        </p>
      )}
    </>
  );
}
