import { getAutostartCmd, setAutostartCmd } from "../lib/api";
import type { Contexto, Get, Set } from "./contexto";

// Parte del store (#134). Ver src/store/index.ts.
// Lo que Cantoral le pide al sistema operativo: por ahora, abrirse solo al
// encender el equipo.

export interface SistemaSlice {
  /**
   * Si Cantoral se abre al encender el equipo, según el sistema.
   *
   * `null` mientras no se ha preguntado y donde no existe (el navegador). No
   * se guarda en las preferencias: se puede apagar también desde el sistema,
   * y entonces lo que vale es lo que dice el sistema.
   */
  abrirConElSistema: boolean | null;
  /** Pregunta al sistema cómo está. Se llama al abrir Configuración. */
  leerAbrirConElSistema: () => Promise<void>;
  /** Lo enciende o lo apaga; la casilla queda como lo dejó el sistema. */
  setAbrirConElSistema: (si: boolean) => Promise<void>;
  /** Mientras el sistema contesta, para no aceptar un segundo clic encima. */
  cambiandoAbrirConElSistema: boolean;
}

export function crearSistema(set: Set, get: Get, ctx: Contexto): SistemaSlice {
  const { toast } = ctx;
  return {
    abrirConElSistema: null,
    cambiandoAbrirConElSistema: false,
    leerAbrirConElSistema: async () => {
      try {
        set({ abrirConElSistema: await getAutostartCmd() });
      } catch (err) {
        // Sin respuesta, la opción no se ofrece: mejor que una casilla que
        // dice algo que no se sabe.
        console.error("could not read the autostart state", err);
        set({ abrirConElSistema: null });
      }
    },
    setAbrirConElSistema: async (si) => {
      if (get().cambiandoAbrirConElSistema) return;
      set({ cambiandoAbrirConElSistema: true });
      try {
        const quedo = await setAutostartCmd(si);
        set({ abrirConElSistema: quedo });
        if (quedo !== si) {
          // El sistema no hizo caso: pasa en PCs con políticas que lo impiden.
          toast("El sistema no dejó cambiarlo", {
            tipo: "error",
            detalle: "Puede que en este equipo lo controle quien lo administra.",
          });
        }
      } catch (err) {
        console.error("could not change autostart", err);
        toast(si ? "No se pudo hacer que Cantoral se abra al encender" : "No se pudo quitar el inicio automático", {
          tipo: "error",
          detalle: String(err),
        });
      } finally {
        set({ cambiandoAbrirConElSistema: false });
      }
    },
  };
}
