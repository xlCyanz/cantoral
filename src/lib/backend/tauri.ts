// El backend de la app de escritorio: el núcleo en Rust, por `api.ts`.
//
// Solo delega. Cada llamada va a la función de `api.ts` en el momento, no a
// una copia guardada al cargar, para que las pruebas que sustituyen `api.ts`
// ejerzan este camino —el mismo que corre en producción— y no otro.

import * as api from "../api";
import type { Backend } from "./tipos";

/**
 * Lo que `api.ts` contesta, sin el `null` que reserva para el navegador.
 *
 * Aquí no hay navegador: este backend solo se elige dentro de Tauri. Un null
 * que llegara sería un núcleo contestando nada, y eso es un error que tiene
 * que verse, no una biblioteca vacía.
 */
function requerido<T>(valor: T | null, comando: string): T {
  if (valor === null) throw new Error(`${comando} no devolvió nada`);
  return valor;
}

export const tauri: Backend = {
  reproduceArchivos: true,

  getLibrary: async () => requerido(await api.getLibrary(), "get_library"),
  getTracksSince: async (after) => requerido(await api.getTracksSince(after), "get_tracks_since"),
  reconcileLibrary: async () => requerido(await api.reconcileLibraryCmd(), "reconcile_library"),
  setTrackFav: (id, fav) => api.setTrackFav(id, fav),
  setTracksFav: (ids, fav) => api.setTracksFavCmd(ids, fav),
  updateTrack: (id, artista, bpm, ocasion) => api.updateTrackCmd(id, artista, bpm, ocasion),
  deleteTrack: (id) => api.deleteTrackCmd(id),
  deleteTracks: async (ids) => requerido(await api.deleteTracksCmd(ids), "delete_tracks"),
  relocateTrack: async (id) => {
    const path = await api.pickMediaFile();
    return path ? api.relocateTrackCmd(id, path) : null;
  },
  revealFile: (path) => api.revealFile(path),

  pickFolder: () => api.pickFolder(),
  addAndScanFolder: (path, recursive) => api.addAndScanFolder(path, recursive),
  rescanFolder: (id) => api.rescanFolderCmd(id),
  cancelScan: () => api.cancelScanCmd(),
  onScanProgress: (cb) => api.onScanProgress(cb),
  removeFolder: (id) => api.removeFolderCmd(id),
  relocateFolder: async (id) => {
    const path = await api.pickFolder();
    return path ? api.relocateFolderCmd(id, path) : null;
  },

  getPlaylists: async () => requerido(await api.getPlaylistsCmd(), "get_playlists"),
  createPlaylist: (nombre, ocasion, desde) => api.createPlaylistCmd(nombre, ocasion, desde),
  duplicatePlaylist: (id) => api.duplicatePlaylistCmd(id),
  addTracksToPlaylist: async (playlist, ids) =>
    requerido(await api.addTracksToPlaylistCmd(playlist, ids), "add_tracks_to_playlist"),
  setPlaylistOrder: (playlist, ids) => api.setPlaylistOrderCmd(playlist, ids),
  setPlaylistTemplate: (playlist, plantilla) => api.setPlaylistTemplateCmd(playlist, plantilla),
  updatePlaylist: (playlist, nombre, ocasion) => api.updatePlaylistCmd(playlist, nombre, ocasion),
  touchPlaylist: (playlist) => api.touchPlaylistCmd(playlist),
  addPlaylistMomento: (playlist, tipo, titulo, texto) => api.addPlaylistMomentoCmd(playlist, tipo, titulo, texto),
  updatePlaylistMomento: (momento, tipo, titulo, texto) => api.updatePlaylistMomentoCmd(momento, tipo, titulo, texto),
  deletePlaylist: (playlist) => api.deletePlaylistCmd(playlist),

  getTrackSheet: async (id) => requerido(await api.getTrackSheet(id), "get_track_sheet"),
  getSheets: async (ids) => (await api.getSheets(ids)) ?? [],
  updateTrackSheet: (id, letra, acordes) => api.updateTrackSheet(id, letra, acordes),

  findDuplicates: async () => requerido(await api.findDuplicatesCmd(), "find_duplicates"),
  mergeDuplicates: async (keep, drop) => requerido(await api.mergeDuplicatesCmd(keep, drop), "merge_duplicates"),
  dismissDuplicates: async (signature) =>
    requerido(await api.dismissDuplicatesCmd(signature), "dismiss_duplicates"),
  restoreDismissedDuplicates: async () =>
    requerido(await api.restoreDismissedDuplicatesCmd(), "restore_dismissed_duplicates"),

  getSetting: (key) => api.getSetting(key),
  setSetting: (key, value) => api.setSetting(key, value),

  backup: async () => {
    const dest = await api.pickSavePath();
    if (!dest) return null;
    const cuando = requerido(await api.backupDatabase(dest), "backup_database");
    return { dest, cuando };
  },
  pickBackup: () => api.pickDbFile(),
  inspectBackup: (src) => api.inspectBackup(src),
  restoreDatabase: (src) => api.restoreDatabaseCmd(src),

  saveSheet: async (nombre, html) => {
    const dest = await api.pickExportPath(nombre);
    if (!dest) return false;
    await api.exportPlaylistCmd(dest, html);
    // Se abre en el navegador, donde Cmd/Ctrl+P la guarda como PDF. Si no se
    // abre, la hoja ya está escrita: eso no convierte el guardado en un fallo.
    await api.openExportedSheet(dest).catch((err) => console.error("could not open the exported sheet", err));
    return true;
  },
  saveSharedList: async (nombre, json) => {
    const dest = await api.pickShareExportPath(nombre);
    if (!dest) return false;
    await api.exportPlaylistJsonCmd(dest, json);
    return true;
  },
  openSharedList: async () => {
    const src = await api.pickPlaylistFile();
    return src ? api.readPlaylistFileCmd(src) : null;
  },
  revealLog: async () => {
    const ruta = await api.rutaDelLog();
    if (ruta) await api.revealFile(ruta);
  },
};
