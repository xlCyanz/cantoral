import type { UpdateCheck, UpdateProgress } from "../lib/api";
import { checkForUpdateCmd, installUpdateCmd, onUpdateProgress } from "../lib/api";
import { modulo } from "./contexto";
import type { Contexto, Get, Set } from "./contexto";

// Parte del store (#134). Ver src/store/index.ts.
// Buscar e instalar versiones nuevas.

export interface ActualizacionesSlice {
  // ---- actualizaciones ----
  /** Lo último que se supo del actualizador. `null` = todavía sin preguntar. */
  update: UpdateCheck | null;
  updateState: "idle" | "checking" | "downloading" | "error";
  /** Por qué falló la última comprobación, para poder decirlo. */
  updateError: string | null;
  updateProgress: UpdateProgress | null;

  /**
   * Ask whether there is a newer Cantoral.
   *
   * `manual` is the difference between the check at startup and the button:
   * the first says nothing unless there is an update, the second always
   * answers, because silence after pressing a button reads as broken.
   */
  checkForUpdate: (manual?: boolean) => Promise<void>;
  /** Download, install and restart into the new version. */
  installUpdate: () => void;
}

export function crearActualizaciones(set: Set, get: Get, ctx: Contexto): ActualizacionesSlice {
  const { toast } = ctx;
  return {
    update: null,
    updateState: "idle",
    updateError: null,
    updateProgress: null,
    checkForUpdate: async (manual = false) => {
      if (get().updateState === "downloading") return;
      set({ updateState: "checking", updateError: null });
      try {
        const update = await checkForUpdateCmd();
        set({ update, updateState: "idle" });
        // Al arrancar solo se habla si hay algo que decir. “Estás al día” sin
        // que nadie lo haya preguntado es ruido en cada apertura.
        if (manual && update.estado === "alDia") toast("Cantoral está al día");
        if (manual && update.estado === "sinConfigurar") {
          toast("Esta compilación no trae actualizaciones automáticas", { tipo: "info" });
        }
      } catch (err) {
        console.error("update check failed", err);
        set({ updateState: "error", updateError: String(err) });
        if (manual) toast("No se pudo comprobar si hay actualizaciones", { tipo: "error" });
      }
    },
    installUpdate: () => {
      const s = get();
      if (s.update?.estado !== "disponible" || s.updateState === "downloading") return;
      set({ updateState: "downloading", updateProgress: { descargado: 0, total: null }, updateError: null });
      void onUpdateProgress((updateProgress) => set({ updateProgress })).then((parar) => {
        modulo.pararProgreso = parar;
      });
      installUpdateCmd()
        // No hay `then`: si funciona, la app se reinicia y nada de esto sigue vivo.
        .catch((err) => {
          console.error("update install failed", err);
          modulo.pararProgreso?.();
          modulo.pararProgreso = null;
          set({ updateState: "error", updateError: String(err), updateProgress: null });
          toast("No se pudo instalar la actualización", { tipo: "error" });
        });
    },
  };
}
