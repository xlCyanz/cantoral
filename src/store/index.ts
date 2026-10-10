import { create } from "zustand";
import { UI_PREFS_KEY, PREF_FIELDS, serialisePrefs } from "../lib/uiPrefs";
import { backend } from "../lib/backend";
import { crearContexto, modulo } from "./contexto";
import { crearInterfaz } from "./interfaz";
import { crearBiblioteca } from "./biblioteca";
import { crearDetalle } from "./detalle";
import { crearEscaneo } from "./escaneo";
import { crearCultos } from "./cultos";
import { crearReproductor } from "./reproductor";
import { crearProyeccion } from "./proyeccion";
import { crearDuplicados } from "./duplicados";
import { crearActualizaciones } from "./actualizaciones";
import { crearSistema } from "./sistema";
import type { CantoralState } from "./tipos";

// El store de Cantoral, partido por dominios (#134).
//
// Cada archivo de esta carpeta es un slice: su parte del estado, su tipo y sus
// acciones. Aquí solo se juntan. Los componentes siguen usando
// `useStore((s) => …)` y los selectores de siempre, que se re-exportan.

export * from "./tipos";
export * from "./selectores";
export { detalleDeOmitidos } from "./reglas";
export { filasProyectadas } from "../lib/proyeccion";
export type { InterfazSlice } from "./interfaz";
export type { BibliotecaSlice } from "./biblioteca";
export type { DetalleSlice } from "./detalle";
export type { EscaneoSlice } from "./escaneo";
export type { CultosSlice } from "./cultos";
export type { ReproductorSlice } from "./reproductor";
export type { ProyeccionSlice } from "./proyeccion";
export type { DuplicadosSlice } from "./duplicados";
export type { ActualizacionesSlice } from "./actualizaciones";
export type { SistemaSlice } from "./sistema";

export const useStore = create<CantoralState>((set, get) => {
  const ctx = crearContexto(set, get);
  return {
    ...crearInterfaz(set, get, ctx),
    ...crearBiblioteca(set, get, ctx),
    ...crearDetalle(set, get, ctx),
    ...crearEscaneo(set, get, ctx),
    ...crearCultos(set, get, ctx),
    ...crearReproductor(set, get, ctx),
    ...crearProyeccion(set, get, ctx),
    ...crearDuplicados(set, get, ctx),
    ...crearActualizaciones(set, get, ctx),
    ...crearSistema(set, get, ctx),
  };
});

// ============================================================
// Writing the interface preferences back
// ============================================================

/** How long a change waits before it is written. */
const PREFS_MS = 400;

function writePrefs() {
  if (modulo.prefsTimer) clearTimeout(modulo.prefsTimer);
  modulo.prefsTimer = null;
  void backend().setSetting(UI_PREFS_KEY, serialisePrefs(useStore.getState())).catch((err) =>
    console.error("could not save the interface preferences", err),
  );
}

function schedulePrefsSave() {
  if (modulo.prefsTimer) clearTimeout(modulo.prefsTimer);
  modulo.prefsTimer = setTimeout(writePrefs, PREFS_MS);
}

/**
 * Write a preference that is still waiting out the debounce, right now.
 *
 * Lowering the volume and closing the window is the exact sequence the whole
 * feature exists for, so it must not be the one that gets lost.
 */
export function flushUiPrefs() {
  if (modulo.prefsTimer) writePrefs();
}

/**
 * Watch the preferences instead of saving from each action that changes one.
 *
 * Nine fields are reached from a dozen places — a dragged volume bar, a clicked
 * column header, a list opened from the sidebar — and a save hung off each one
 * is a save that gets forgotten the next time somebody adds a tenth. This sees
 * the change wherever it came from.
 */
useStore.subscribe((s, previo) => {
  if (PREF_FIELDS.every((campo) => s[campo] === previo[campo])) return;
  schedulePrefsSave();
});

// ============================================================
// La barra del reproductor aparece al sonar algo
// ============================================================

/**
 * Mirando `playing` y no desde `play` o `togglePlay`, porque se pone a sonar
 * desde muchos sitios —la barra, el doble clic, Espacio, el culto, la
 * proyección—, y la barra tiene que aparecer en todos.
 */
useStore.subscribe((s) => {
  if (s.playing && !s.haSonado) useStore.setState({ haSonado: true });
});
