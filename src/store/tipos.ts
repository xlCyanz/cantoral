import type { ArchivoDeLista, Resultado } from "../lib/compartir";
import type { InterfazSlice } from "./interfaz";
import type { BibliotecaSlice } from "./biblioteca";
import type { DetalleSlice } from "./detalle";
import type { EscaneoSlice } from "./escaneo";
import type { CultosSlice } from "./cultos";
import type { ReproductorSlice } from "./reproductor";
import type { ProyeccionSlice } from "./proyeccion";
import type { HojasSlice } from "./hojas";
import type { DuplicadosSlice } from "./duplicados";
import type { ActualizacionesSlice } from "./actualizaciones";

// Parte del store (#134). Ver src/store/index.ts.

/**
 * A destructive action waiting to be confirmed.
 *
 * Every field is filled at the moment the user asks for the action, so the
 * dialog can name what is about to be lost with real numbers rather than a
 * generic «¿estás seguro?».
 */
export interface ConfirmRequest {
  title: string;
  /** What is about to happen, in plain words. */
  message: string;
  /** Exactly what is lost — counts, names. Rendered as a highlighted block. */
  detail?: string;
  /** Reassurance about what is *not* touched. */
  safe?: string;
  confirmLabel: string;
  onConfirm: () => void;
}

/** Lifecycle of an edit that saves itself. */
export type SaveState = "idle" | "saving" | "saved" | "error";

export type ToastType = "success" | "error" | "info";
/**
 * Un aviso de los de la esquina.
 *
 * Dos campos y no uno porque un aviso útil dice dos cosas: qué pasó y qué
 * significa. Metidas en una línea —«3 pistas agregadas a "Domingo"»— hay que
 * leerla entera para quedarse con el titular; separadas, el titular se lee de
 * un vistazo y el detalle está ahí si hace falta.
 */
export interface ToastNotice {
  titulo: string;
  /** La consecuencia, cuando hay algo que añadir. Muchos avisos no la tienen. */
  detalle?: string;
  type: ToastType;
}

/**
 * A shared playlist file, already read and matched against this catalogue.
 *
 * Held rather than acted on: the whole point of the import screen is that the
 * user sees which songs were found, and which ones this installation does not
 * have, before a list appears.
 */
export interface ImportPreview {
  archivo: ArchivoDeLista;
  resultado: Resultado;
}

/**
 * Todo el estado de la app: la suma de los slices. Un componente que solo
 * necesita un dominio puede importar el tipo de ese slice.
 */
export type CantoralState = InterfazSlice &
  BibliotecaSlice &
  DetalleSlice &
  EscaneoSlice &
  CultosSlice &
  ReproductorSlice &
  ProyeccionSlice &
  HojasSlice &
  DuplicadosSlice &
  ActualizacionesSlice;
