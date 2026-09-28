import type { Theme, ThemeMode, View } from "../lib/types";
import { onTemaDelSistema, temaDelSistema } from "../lib/api";
import { backend } from "../lib/backend";
import type { ConfirmRequest, ToastNotice, ToastType } from "./tipos";
import { modulo } from "./contexto";
import type { Contexto, Get, Set } from "./contexto";
import { estadoDeLaBiblioteca, resolveTheme } from "./reglas";

// Parte del store (#134). Ver src/store/index.ts.
// La cáscara: tema, vista, diálogos, avisos y confirmaciones.

export interface InterfazSlice {
  // ---- ui / navigation ----
  theme: Theme;
  themeMode: ThemeMode;
  view: View;

  // ---- dialog / scan ----
  dialog: "addFolder" | "newList" | "editList" | "help" | "importList" | "printPreview" | "addToList" | null;

  // ---- toast ----
  toast: ToastNotice | null;

  /** Destructive action awaiting confirmation, or null. */
  confirm: ConfirmRequest | null;

  // ---- actions ----
  /** Ir a la biblioteca, sin tocar lo que la esté filtrando. */
  showBiblioteca: () => void;
  /** Ir a la biblioteca y soltar todo lo que la esté estrechando. */
  verTodaLaBiblioteca: () => void;
  showColecciones: () => void;
  showConfig: () => void;
  onFolderClick: () => void;
  setThemeMode: (m: ThemeMode) => void;
  /**
   * Lo último que dijo la ventana nativa sobre el tema del sistema.
   *
   * `null` hasta que conteste, y siempre en el modo navegador. Se guarda
   * porque hace falta al volver a «Seguir al sistema» después de haber estado
   * en claro u oscuro: sin él habría que volver a preguntar.
   */
  temaSistema: Theme | null;
  applySystemTheme: () => void;
  /** Seguir el tema del sistema por el canal nativo. Devuelve cómo dejar de seguirlo. */
  seguirAlSistema: () => Promise<() => void>;
  openHelp: () => void;
  closeDialog: () => void;
  showToast: (titulo: string, opciones?: { detalle?: string; tipo?: ToastType }) => void;
  /** Quitar el aviso antes de que se vaya solo. */
  closeToast: () => void;

  askConfirm: (req: ConfirmRequest) => void;
  acceptConfirm: () => void;
  closeConfirm: () => void;
}

export function crearInterfaz(set: Set, get: Get, _ctx: Contexto): InterfazSlice {
  return {

    themeMode: "system",
    theme: resolveTheme("system"),
    temaSistema: null,
    view: "biblioteca",

    dialog: null,

    toast: null,
    confirm: null,

    showBiblioteca: () => set({ view: "biblioteca" }),

    // «Todas» y el propio «Biblioteca» de la barra lateral. No basta con
    // cambiar de vista: estando ya en la biblioteca con un filtro puesto, eso
    // no hacía absolutamente nada —ni se encendía el botón ni cambiaba la
    // tabla—, que es como se lee un botón roto. Suelta también la búsqueda,
    // porque «todas» quiere decir todas.
    verTodaLaBiblioteca: () =>
      set((s) => ({
        view: "biblioteca",
        libState: estadoDeLaBiblioteca(s),
        qf: null,
        ocasion: null,
        query: "",
      })),
    showColecciones: () => set({ view: "colecciones" }),
    showConfig: () => set({ view: "config" }),
    onFolderClick: () =>
      set((s) => ({ view: "biblioteca", libState: estadoDeLaBiblioteca(s), qf: null, ocasion: null })),
    setThemeMode: (m) => {
      const theme = resolveTheme(m, get().temaSistema);
      set({ themeMode: m, theme });
      // Only the log: the theme is already applied, and all a failed save costs
      // is the choice not surviving a restart.
      void backend().setSetting("themeMode", m).catch((err) => console.error("set_setting failed", err));
    },
    applySystemTheme: () => {
      if (get().themeMode === "system") set((st) => ({ theme: resolveTheme("system", st.temaSistema) }));
    },

    // Preguntar a la ventana nativa cuál es el tema del sistema, y quedarse
    // escuchando. Devuelve cómo dejar de hacerlo.
    //
    // Hace falta porque `prefers-color-scheme` no es de fiar dentro de la app:
    // en Windows, WebView2 lo resuelve contra el tema de la ventana y contesta
    // «claro» aunque el sistema esté en oscuro, así que «Seguir al sistema» no
    // seguía nada. La ventana sí lo sabe.
    seguirAlSistema: async () => {
      const aplicar = (t: Theme | null) => {
        if (!t) return;
        set((st) => (st.themeMode === "system" ? { temaSistema: t, theme: t } : { temaSistema: t }));
      };
      aplicar(await temaDelSistema());
      return onTemaDelSistema(aplicar);
    },
    openHelp: () => set({ dialog: "help" }),
    closeDialog: () => set({ dialog: null, importPreview: null }),

    askConfirm: (req) => set({ confirm: req }),
    closeConfirm: () => set({ confirm: null }),
    acceptConfirm: () => {
      const req = get().confirm;
      set({ confirm: null });
      req?.onConfirm();
    },

    showToast: (titulo, opciones) => {
      const type = opciones?.tipo ?? "success";
      if (modulo.toastTimer) clearTimeout(modulo.toastTimer);
      set({ toast: { titulo, detalle: opciones?.detalle, type } });
      // Un error aguanta más: quien lo lee suele tener que hacer algo con él.
      // Y un aviso con detalle también, porque hay dos líneas que leer.
      const ms = type === "error" ? 5000 : opciones?.detalle ? 3500 : 2200;
      modulo.toastTimer = setTimeout(() => set({ toast: null }), ms);
    },

    closeToast: () => {
      if (modulo.toastTimer) clearTimeout(modulo.toastTimer);
      set({ toast: null });
    },
  };
}
