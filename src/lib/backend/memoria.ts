// El backend del navegador: una base en memoria sobre los datos de ejemplo.
//
// Es lo que hace que `pnpm dev` enseñe la app entera sin el núcleo. Antes esa
// simulación vivía dentro del store, entremezclada con el camino de verdad, y
// cada acción tenía dos cuerpos que se iban separando (#135). Aquí hay una
// sola simulación, que contesta exactamente lo que contesta el núcleo, con las
// mismas reglas que SQLite hace cumplir allí: agregar a un culto no repite,
// quitar una pista la saca también de los cultos, fusionar copias pasa el
// favorito, la letra y el sitio en los cultos a la que se queda.
//
// Lo que un navegador no puede hacer —mostrar un archivo en el disco,
// restaurar una base— contesta con `NoDisponible`, que el store enseña como
// un aviso.

import { leerArchivoDelNavegador } from "../api";
import type { DuplicateReport, ScanProgressEvent, Sheet, Snapshot } from "../api";
import { buscarEnHojas } from "../buscarLetra";
import { nombreDeCopia } from "../copias";
import { SCAN_FILES, SEED_FOLDERS, SEED_PLAYLISTS, SEED_SHEETS, SEED_TRACKS, seedDuplicates } from "../seed";
import type { Folder, Playlist, Track } from "../types";
import { NoDisponible } from "./tipos";
import type { Backend } from "./tipos";

/** Lo que tarda cada paso del escaneo simulado. */
const PASO_ESCANEO_MS = 160;

/** La carpeta que «elige» el navegador, que no tiene selector de carpetas. */
export const CARPETA_DE_EJEMPLO = "C:\\Música\\Iglesia\\Nuevas";

/** Descarga un archivo desde la página: lo único que un navegador sabe guardar. */
function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** Si una hoja tiene algo escrito, como lo decide el núcleo. */
const tieneTexto = (h: Sheet | undefined) => !!h && !!(h.letra.trim() || h.acordes.trim());

/** Con qué datos empieza una base en memoria. */
export interface Semilla {
  tracks: Track[];
  folders: Folder[];
  playlists: Playlist[];
  sheets: Record<string, Sheet>;
}

/**
 * Base en memoria, nueva cada vez.
 *
 * Por defecto, los datos de ejemplo; las pruebas le pasan los suyos.
 */
export function crearMemoria(semilla: Partial<Semilla> = {}): Backend {
  const tracks: Track[] = structuredClone(semilla.tracks ?? SEED_TRACKS);
  let folders: Folder[] = structuredClone(semilla.folders ?? SEED_FOLDERS);
  let playlists: Playlist[] = structuredClone(semilla.playlists ?? SEED_PLAYLISTS);
  const sheets: Record<string, Sheet> = structuredClone(semilla.sheets ?? SEED_SHEETS);
  const settings = new Map<string, string>();
  const descartados = new Set<string>();
  const oyentes = new Set<(p: ScanProgressEvent) => void>();
  /** Lo que para el escaneo simulado en curso, si hay uno. */
  let cancelar: (() => void) | null = null;
  let siguienteId = 1;

  const ahora = () => new Date().toISOString();
  // Copias, siempre: el store no puede quedarse con los mismos objetos que
  // esta base sigue cambiando por dentro.
  const snapshot = (): Snapshot => structuredClone({ tracks, folders, playlists });
  const listas = (): Playlist[] => structuredClone(playlists);
  const lista = (id: string) => {
    const pl = playlists.find((p) => p.id === id);
    if (!pl) throw new Error(`No existe la lista ${id}`);
    return pl;
  };
  const pista = (id: string) => {
    const t = tracks.find((x) => x.id === id);
    if (!t) throw new Error(`No existe la pista ${id}`);
    return t;
  };
  const nuevoId = (prefijo: string, usados: readonly { id: string }[]) => {
    let id: string;
    do id = `${prefijo}${siguienteId++}`;
    while (usados.some((x) => x.id === id));
    return id;
  };

  /** Saca unas pistas del catálogo, de los cultos y sus letras: la cascada de SQLite. */
  const quitarPistas = (ids: readonly string[]) => {
    const fuera = new Set(ids);
    for (let i = tracks.length - 1; i >= 0; i--) if (fuera.has(tracks[i].id)) tracks.splice(i, 1);
    playlists = playlists.map((p) => ({ ...p, ids: p.ids.filter((id) => !fuera.has(id)) }));
    ids.forEach((id) => delete sheets[id]);
  };

  const informe = (): DuplicateReport => {
    const hay = new Set(tracks.map((t) => t.id));
    return {
      // Solo los grupos que siguen enteros: tras fusionar, el grupo ya no existe.
      groups: seedDuplicates().filter(
        (g) => !descartados.has(g.signature) && g.tracks.every((t) => hay.has(t.id)),
      ),
      dismissed: descartados.size,
    };
  };

  /**
   * Un escaneo de mentira: avisa del progreso como el núcleo y acaba con la
   * biblioteca. No añade pistas —no hay disco que leer—, pero la tarjeta, el
   * cancelar y el aviso final se pueden probar enteros.
   */
  const escanear = (folderId: string) =>
    new Promise<Snapshot>((resolve) => {
      cancelar?.();
      let pct = 0;
      // Un recorrido inventado de 40 archivos, para que la tarjeta tenga qué contar.
      const total = 40;
      const avisar = (done: boolean) => {
        const file = SCAN_FILES[Math.min(SCAN_FILES.length - 1, Math.floor((pct / 100) * SCAN_FILES.length))];
        const added = Math.round((pct / 100) * total);
        oyentes.forEach((cb) => cb({ folderId, pct, file: done ? "" : file, done, added, omitidos: 0, total }));
      };
      const terminar = () => {
        clearInterval(reloj);
        cancelar = null;
        const f = folders.find((x) => x.id === folderId);
        if (f) f.lastScan = ahora();
        // Como en el núcleo: lo nuevo es lo que trajo este escaneo, y este no
        // trae nada.
        tracks.forEach((t) => (t.nueva = false));
        avisar(true);
        resolve(snapshot());
      };
      const reloj = setInterval(() => {
        pct = Math.min(100, pct + Math.random() * 7 + 3);
        if (pct >= 100) terminar();
        else avisar(false);
      }, PASO_ESCANEO_MS);
      cancelar = terminar;
      avisar(false);
    });

  return {
    reproduceArchivos: false,

    getLibrary: async () => snapshot(),
    // Nada nuevo nunca: el escaneo simulado no añade pistas.
    getTracksSince: async () => ({ tracks: [], folders: structuredClone(folders) }),
    reconcileLibrary: async () => snapshot(),
    setTrackFav: async (id, fav) => {
      pista(id).fav = fav;
    },
    setTracksFav: async (ids, fav) => {
      ids.forEach((id) => (pista(id).fav = fav));
    },
    updateTrack: async (id, artista, bpm, ocasion) => {
      Object.assign(pista(id), { artista, bpm, ocasion });
    },
    deleteTrack: async (id) => {
      quitarPistas([id]);
      return snapshot();
    },
    deleteTracks: async (ids) => {
      quitarPistas(ids);
      return snapshot();
    },
    relocateTrack: async () => {
      throw new NoDisponible("Localizar archivos solo funciona en la app de escritorio");
    },
    revealFile: async () => {
      throw new NoDisponible("Mostrar el archivo solo funciona en la app de escritorio");
    },

    pickFolder: async () => CARPETA_DE_EJEMPLO,
    addAndScanFolder: (path, recursive) => {
      let f = folders.find((x) => x.ruta === path);
      if (!f) {
        f = {
          id: nuevoId("f", folders),
          nombre: path.split(/[\\/]/).filter(Boolean).pop() ?? path,
          ruta: path,
          count: 0,
          recursive,
        };
        folders = [...folders, f];
      }
      return escanear(f.id);
    },
    rescanFolder: (id) => {
      if (!folders.some((f) => f.id === id)) return Promise.reject(new Error(`No existe la carpeta ${id}`));
      return escanear(id);
    },
    cancelScan: async () => {
      cancelar?.();
    },
    onScanProgress: async (cb) => {
      oyentes.add(cb);
      return () => oyentes.delete(cb);
    },
    removeFolder: async (id) => {
      const f = folders.find((x) => x.id === id);
      if (!f) throw new Error(`No existe la carpeta ${id}`);
      // Como en SQLite: la carpeta se lleva sus pistas.
      quitarPistas(tracks.filter((t) => t.carpeta === f.nombre).map((t) => t.id));
      folders = folders.filter((x) => x.id !== id);
      return snapshot();
    },
    relocateFolder: async () => {
      throw new NoDisponible("Mover carpetas solo funciona en la app de escritorio");
    },

    getPlaylists: async () => listas(),
    createPlaylist: async (nombre, ocasion, desde) => {
      const id = nuevoId("p", playlists);
      const ids = desde ? [...(playlists.find((p) => p.id === desde)?.ids ?? [])] : [];
      playlists = [...playlists, { id, nombre, ocasion, ids, plantilla: false, tocada: ahora() }];
      return id;
    },
    duplicatePlaylist: async (id) => {
      const origen = lista(id);
      const nuevo = nuevoId("p", playlists);
      const nombre = nombreDeCopia(origen.nombre, playlists.map((p) => p.nombre));
      playlists = [
        ...playlists,
        { id: nuevo, nombre, ocasion: origen.ocasion, ids: [...origen.ids], plantilla: false, tocada: ahora() },
      ];
      return nuevo;
    },
    addTracksToPlaylist: async (playlist, ids) => {
      const pl = lista(playlist);
      // Lo que ya estaba no se repite, igual que la clave primaria de SQLite.
      const ya = new Set(pl.ids);
      pl.ids = [...pl.ids, ...ids.filter((id) => !ya.has(id) && ya.add(id))];
      return listas();
    },
    setPlaylistOrder: async (playlist, ids) => {
      lista(playlist).ids = [...ids];
    },
    setPlaylistTemplate: async (playlist, plantilla) => {
      lista(playlist).plantilla = plantilla;
      return listas();
    },
    updatePlaylist: async (playlist, nombre, ocasion) => {
      Object.assign(lista(playlist), { nombre, ocasion });
      return listas();
    },
    touchPlaylist: async (playlist) => {
      lista(playlist).tocada = ahora();
    },
    deletePlaylist: async (playlist) => {
      playlists = playlists.filter((p) => p.id !== playlist);
      return listas();
    },

    getTrackSheet: async (id) => structuredClone(sheets[id] ?? { trackId: id, letra: "", acordes: "" }),
    getSheets: async (ids) => structuredClone(ids.map((id) => sheets[id]).filter(tieneTexto) as Sheet[]),
    updateTrackSheet: async (id, letra, acordes) => {
      sheets[id] = { trackId: id, letra, acordes };
      pista(id).tieneHoja = tieneTexto(sheets[id]);
    },
    // Como el índice del núcleo: solo lo que está en el catálogo.
    searchLyrics: async (consulta) => {
      const hay = new Set(tracks.map((t) => t.id));
      return buscarEnHojas(
        Object.values(sheets).filter((h) => hay.has(h.trackId)),
        consulta,
      );
    },

    findDuplicates: async () => informe(),
    mergeDuplicates: async (keep, drop) => {
      const queda = pista(keep);
      const fuera = new Set(drop);
      drop.forEach((id) => (queda.fav = queda.fav || pista(id).fav));
      // Una que se queda sin letra hereda la de la primera copia que tenga, y
      // nunca pierde la suya (#126).
      if (!tieneTexto(sheets[keep])) {
        const heredada = [...drop].sort((a, b) => a.localeCompare(b, "es", { numeric: true })).find((id) => tieneTexto(sheets[id]));
        if (heredada) {
          sheets[keep] = { ...sheets[heredada], trackId: keep };
          queda.tieneHoja = true;
        }
      }
      // Los cultos siguen a la que se queda, y un culto que tenía dos copias
      // acaba con la canción una vez, no dos.
      playlists = playlists.map((p) => {
        const visto = new Set<string>();
        const ids: string[] = [];
        p.ids.forEach((id) => {
          const destino = fuera.has(id) ? keep : id;
          if (visto.has(destino)) return;
          visto.add(destino);
          ids.push(destino);
        });
        return { ...p, ids };
      });
      quitarPistas(drop);
      return snapshot();
    },
    dismissDuplicates: async (signature) => {
      descartados.add(signature);
      return informe();
    },
    restoreDismissedDuplicates: async () => {
      descartados.clear();
      return informe();
    },

    getSetting: async (key) => settings.get(key) ?? null,
    setSetting: async (key, value) => {
      settings.set(key, value);
    },

    // Nada que copiar: la base del navegador se va con la pestaña.
    backup: async () => ({ dest: "cantoral-backup.db", cuando: ahora() }),
    pickBackup: async () => {
      throw new NoDisponible("Restaurar una copia solo funciona en la app de escritorio");
    },
    inspectBackup: async () => {
      throw new NoDisponible("Restaurar una copia solo funciona en la app de escritorio");
    },
    restoreDatabase: async () => {
      throw new NoDisponible("Restaurar una copia solo funciona en la app de escritorio");
    },

    saveSheet: async (nombre, html) => {
      descargar(nombre, html, "text/html");
      return true;
    },
    saveSharedList: async (nombre, json) => {
      descargar(nombre, json, "application/json");
      return true;
    },
    openSharedList: () => leerArchivoDelNavegador(),
    revealLog: async () => {
      throw new NoDisponible("El registro solo existe en la app de escritorio");
    },
  };
}
