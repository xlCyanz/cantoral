import { backend } from "../lib/backend";
import {
  DEPENDENCIAS_REALES,
  MUESTRAS,
  descartadosDe,
  probarFormatos,
  type Dependencias,
  type ResultadoDePrueba,
} from "../lib/pruebaDeFormatos";
import type { Contexto, Get, Set } from "./contexto";
import { AVISO_COPIA_AUTOMATICA } from "./reglas";

// Parte del store (#134). Ver src/store/index.ts.
// Qué formatos reproduce este equipo, y los videos que resultaron ser audio.

/** La clave del ajuste, la misma que lee el escáner en `db.rs`. */
export const CLAVE_FORMATOS_DESCARTADOS = "formatos_descartados";

/** Lo guardado, limpio. Algo ilegible cuenta como ninguno, como en el núcleo. */
export function leerDescartados(json: string | null): string[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((e): e is string => typeof e === "string").map((e) => e.toLowerCase()) : [];
  } catch {
    return [];
  }
}

export interface FormatosSlice {
  /** Las extensiones que la prueba descartó en este equipo. Ver `lib/pruebaDeFormatos.ts`. */
  formatosDescartados: string[];
  /** La prueba de Configuración: si está en marcha y lo que va dando. */
  pruebaDeFormatos: { estado: "sinHacer" | "probando" | "hecha"; resultados: ResultadoDePrueba[] };
  /**
   * Probar un archivo de cada formato en este equipo y descartar los que no
   * suenan. Si la biblioteca ya tiene pistas en ellos, pregunta si quitarlas.
   * `d` es para las pruebas; la app usa las muestras de verdad.
   */
  probarFormatos: (d?: Dependencias) => Promise<void>;
  /** Apuntar que un video no trae imagen: desde ahí es un audio, en la base y en pantalla. */
  apuntarSinImagen: (id: string, path: string) => Promise<void>;
}

export function crearFormatos(set: Set, get: Get, ctx: Contexto): FormatosSlice {
  const { toast, applyParche } = ctx;
  return {
    formatosDescartados: [],
    pruebaDeFormatos: { estado: "sinHacer", resultados: [] },

    probarFormatos: async (d = DEPENDENCIAS_REALES) => {
      if (get().pruebaDeFormatos.estado === "probando") return;
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", { tipo: "info" });
        return;
      }
      set({ pruebaDeFormatos: { estado: "probando", resultados: [] } });
      const resultados = await probarFormatos(d, (r) =>
        set((s) => ({ pruebaDeFormatos: { estado: "probando", resultados: [...s.pruebaDeFormatos.resultados, r] } })),
      );
      set({ pruebaDeFormatos: { estado: "hecha", resultados } });

      // El MP3 suena en cualquier motor. Si ni ese pasa, lo que falla es la
      // prueba —la muestra no llegó, el sistema no dejó abrir nada— y no los
      // formatos: descartar con eso vaciaría la biblioteca.
      if (!resultados.some((r) => r.ext === "mp3" && r.ok)) {
        toast("La prueba no pudo reproducir nada", {
          tipo: "error",
          detalle: "Ni siquiera un MP3: el problema es de la prueba, no de tus archivos. No se descartó ningún formato.",
        });
        return;
      }

      const descartados = descartadosDe(resultados);
      try {
        // Se guarda siempre, también vacío: un formato que antes falló y
        // ahora suena —se instaló un códec— vuelve a entrar al escanear.
        await backend().descartarFormatos(descartados, false);
      } catch (err) {
        console.error("descartar_formatos failed", err);
        toast("No se pudo guardar el resultado de la prueba", { tipo: "error", detalle: String(err) });
        return;
      }
      set({ formatosDescartados: descartados });

      const pasan = resultados.filter((r) => r.ok).length;
      const afectadas = get().tracks.filter((t) => descartados.includes(t.formato.toLowerCase()));
      if (afectadas.length === 0) {
        toast(
          descartados.length === 0
            ? "Este equipo reproduce todos los formatos"
            : `Este equipo reproduce ${pasan} de ${MUESTRAS.length} formatos`,
          descartados.length ? { detalle: `Los demás no se indexarán al escanear: ${listar(descartados)}.` } : undefined,
        );
        return;
      }
      const n = afectadas.length;
      get().askConfirm({
        title: "¿Quitar las pistas que este equipo no reproduce?",
        message: `La prueba descartó ${listar(descartados)}. Ya no se indexarán al escanear.`,
        detail: `Se quitarán ${n} ${n === 1 ? "pista" : "pistas"} de la biblioteca, con sus favoritos y su sitio en las listas.`,
        safe: `Los archivos no se tocan: siguen donde están, y convertidos a MP3 o MP4 vuelven a entrar al escanear. ${AVISO_COPIA_AUTOMATICA}`,
        confirmLabel: n === 1 ? "Quitar 1 pista" : `Quitar ${n} pistas`,
        onConfirm: () => {
          backend()
            .descartarFormatos(descartados, true)
            .then(applyParche)
            .then(() => toast(n === 1 ? "1 pista quitada" : `${n} pistas quitadas`))
            .catch((err) => {
              console.error(err);
              toast("No se pudieron quitar las pistas", { tipo: "error", detalle: String(err) });
            });
        },
      });
    },

    apuntarSinImagen: async (id, path) => {
      // En pantalla ya, sin esperar a la base: lo que importa es que deje de
      // ir al proyector ahora.
      set((s) => ({ tracks: s.tracks.map((t) => (t.id === id && t.path === path && t.video ? { ...t, video: false } : t)) }));
      await backend().marcarSinImagen(id, path);
    },
  };
}

/** `[".wma", ".avi"]` → «.wma y .avi». */
function listar(exts: readonly string[]): string {
  const con = exts.map((e) => `.${e}`);
  return con.length <= 1 ? con.join("") : `${con.slice(0, -1).join(", ")} y ${con[con.length - 1]}`;
}
