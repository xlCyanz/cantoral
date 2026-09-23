import { create } from "zustand";
import type {
  Densidad,
  Folder,
  GroupBy,
  LibState,
  Playlist,
  QuickFilter,
  SalidaDeAudio,
  SortKey,
  Theme,
  ThemeMode,
  Track,
  TrackEdit,
  TransicionProyeccion,
  View,
} from "./lib/types";

/**
 * La URL `asset://` de una pista, o cadena vacía si no hay nada que proyectar.
 *
 * Una sola función para las dos cosas que necesitan coincidir: lo que se manda
 * a la salida y lo que se compara cuando la salida contesta. Si fueran dos,
 * cualquier diferencia entre ellas tiraría los informes de progreso a la
 * basura sin que se notara.
 */
function rutaProyectable(t: Track | undefined): string {
  if (!t || motivoNoProyectable(t)) return "";
  return assetUrl(t.path!);
}

/**
 * Las pistas que se están proyectando, en su orden.
 *
 * `filasDeLista` mira la lista *abierta*; esta mira la que está en el aire, que
 * no tienen por qué ser la misma.
 */
export const filasProyectadas = recordar(
  (s: CantoralState): Track[] =>
    (s.plOrder[s.proyeccionLista] || [])
      .map((id) => s.tracks.find((t) => t.id === id))
      .filter((t): t is Track => !!t),
  (s: CantoralState) => [s.proyeccionLista, s.plOrder[s.proyeccionLista], s.tracks],
);

/** Lo que hay que ir cargando en silencio estando en `idx`: el siguiente. */
function precargaDe(s: CantoralState, idx: number): string | undefined {
  return rutaProyectable(filasProyectadas(s)[idx + 1]) || undefined;
}

/**
 * El mensaje para la salida con el elemento `idx` del culto abierto.
 *
 * Una pista sin archivo reproducible sale como su título sobre el negro, no
 * como un negro a secas: por el proyector se canta esa canción igual, y una
 * pantalla vacía no dice nada. El motivo se queda en la ventana de mandos —a
 * la congregación no le importa que falte un archivo.
 */
function salidaDelCulto(s: CantoralState, idx: number, reproduciendo: boolean): SalidaProyeccion {
  const t = filasProyectadas(s)[idx];
  const precarga = precargaDe(s, idx);
  if (!t) return { vista: { modo: "negro" }, precarga };
  const src = rutaProyectable(t);
  if (!src) return { vista: { modo: "titulo", titulo: t.titulo, sub: t.artista || undefined }, precarga };
  return {
    vista: {
      modo: "media",
      src,
      video: !!t.video,
      titulo: t.titulo,
      sub: t.artista || undefined,
      reproduciendo,
      // Un video ya llena la pantalla; lo de abajo es para el audio, que por
      // sí solo no pone nada delante de la congregación.
      ...(t.video ? {} : { audio: fondoDeAudio(s, t) }),
    },
    precarga,
  };
}

/** Lo que se dibuja mientras suena una pista sin imagen. */
function fondoDeAudio(s: CantoralState, t: Track): NonNullable<Extract<VistaProyeccion, { modo: "media" }>["audio"]> {
  const tipo = s.salidaDeAudio;
  if (tipo === "negro") return { tipo };
  const trozos = estrofasDeLaPista(s, t.id);
  const actual = trozos[Math.min(s.proyeccionEstrofa, Math.max(0, trozos.length - 1))];
  return {
    tipo,
    etiqueta: actual?.etiqueta || undefined,
    lineas: actual?.lineas,
    // La carátula ya viene como `asset://` del catálogo.
    portada: tipo === "portada" ? t.cover : undefined,
  };
}

/**
 * La letra de una pista, partida en estrofas.
 *
 * Recordada porque la mira cada mensaje que sale a la salida —y sale uno por
 * cada cambio de ajuste, de estrofa y de elemento—, y volver a leer la hoja
 * entera cada vez no hace falta.
 */
const estrofasDeLaPista = recordar(
  (s: CantoralState, id: string): Estrofa[] => {
    const hoja = s.sheets[id];
    return estrofasDe(hoja?.letra, hoja?.acordes);
  },
  (s: CantoralState, id: string) => [s.sheets[id], id],
);

/** Cuántas estrofas tiene lo que está en pantalla, o 0 si no se proyecta letra. */
export function estrofasEnPantalla(s: CantoralState): Estrofa[] {
  if (s.salidaDeAudio === "negro" || s.proyeccionIdx < 0) return VACIO_ESTROFAS;
  const t = filasProyectadas(s)[s.proyeccionIdx];
  if (!t || t.video) return VACIO_ESTROFAS;
  return estrofasDeLaPista(s, t.id);
}

const VACIO_ESTROFAS: Estrofa[] = [];

/**
 * La coletilla del aviso de escaneo, o cadena vacía.
 *
 * Va pegada al «Biblioteca actualizada» en vez de en un aviso aparte porque
 * son la misma noticia: esto es lo que entró y esto es lo que no.
 */
export function avisoDeOmitidos(n: number): string {
  if (n <= 0) return "";
  return n === 1
    ? " · 1 archivo en un formato que Cantoral no reproduce"
    : ` · ${n} archivos en formatos que Cantoral no reproduce`;
}

function osPrefersDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
/** Effective theme for a preference mode. */
function resolveTheme(mode: ThemeMode): Theme {
  return mode === "system" ? (osPrefersDark() ? "dark" : "light") : mode;
}
import { SCAN_FILES, SEED_FOLDERS, SEED_PLAYLISTS, SEED_SHEETS, SEED_TRACKS, seedDuplicates } from "./lib/seed";
import { nombreDeCopia } from "./lib/copias";
import { armarArchivo, emparejar, idsParaLaLista, nombreDeArchivo } from "./lib/compartir";
import type { ArchivoDeLista, Resultado } from "./lib/compartir";
import type { UpdateCheck, UpdateProgress } from "./lib/api";
import { ultimaPorOcasion } from "./lib/repetir";
import { partirPorFecha } from "./lib/fechas";
import type { MonitorInfo, SalidaProyeccion, VistaProyeccion } from "./lib/api";
import { motivoDeError, motivoNoProyectable } from "./lib/formatos";
import { carpetaReal } from "./lib/carpetas";
import { estrofasDe } from "./lib/estrofas";
import type { Estrofa } from "./lib/estrofas";
import { playlistSheetHtml, sheetFileName } from "./lib/exportSheet";
import { PREF_FIELDS, UI_PREFS_KEY, parsePrefs, resolveView, serialisePrefs } from "./lib/uiPrefs";
import { etiquetaEquivalente, normalizarEtiqueta } from "./lib/tags";
import { alHacerClic, enOrden, vigentes } from "./lib/selection";
import type { Modificadores } from "./lib/selection";
import {
  addAndScanFolder,
  addTracksToPlaylistCmd,
  assetUrl,
  cancelScanCmd,
  backupDatabase,
  checkForUpdateCmd,
  closeProjectionCmd,
  onProjectionReady,
  onProjectionState,
  openProjectionCmd,
  projectionMonitors,
  setProjectionCmd,
  createPlaylistCmd,
  deletePlaylistCmd,
  duplicatePlaylistCmd,
  deleteTrackCmd,
  exportPlaylistCmd,
  exportPlaylistJsonCmd,
  leerArchivoDelNavegador,
  pickPlaylistFile,
  pickShareExportPath,
  readPlaylistFileCmd,
  getLibrary,
  getSetting,
  getSheets,
  getTrackSheet,
  dismissDuplicatesCmd,
  findDuplicatesCmd,
  installUpdateCmd,
  inspectBackup,
  isTauri,
  mergeDuplicatesCmd,
  restoreDismissedDuplicatesCmd,
  openExportedSheet,
  onUpdateProgress,
  pickDbFile,
  pickExportPath,
  pickFolder,
  pickMediaFile,
  pickSavePath,
  reconcileLibraryCmd,
  renameTagCmd,
  deleteTagCmd,
  revealFile,
  relocateFolderCmd,
  relocateTrackCmd,
  removeFolderCmd,
  rescanFolderCmd,
  restoreDatabaseCmd,
  setPlaylistOrderCmd,
  setPlaylistTemplateCmd,
  setSetting,
  setTrackFav,
  setTracksFavCmd,
  tagTracksCmd,
  deleteTracksCmd,
  updatePlaylistCmd,
  updateTrackCmd,
  updateTrackSheet,
  type DuplicateGroup,
  type Sheet,
  type Snapshot,
} from "./lib/api";

// Module-scoped timers (kept out of React/zustand state).
let scanTimer: ReturnType<typeof setInterval> | null = null;
/** Poll that pulls in tracks a running scan has already indexed. */
let refreshTimer: ReturnType<typeof setInterval> | null = null;
/** True while a catalogue pull is in flight, so they cannot pile up. */
let refreshing = false;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let dragId: string | null = null;
/** Action to re-run from the error state — set whenever a backend call fails. */
let lastFailedAction: (() => void) | null = null;
/** Debounce for a sheet being typed into the editor. */
let sheetTimer: ReturnType<typeof setTimeout> | null = null;
/** Id of the track whose sheet is waiting out that debounce, if any. */
let pendingSheet: string | null = null;

/** Debounce for track edits, which now write themselves. */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** Id of the track whose edit is waiting out the debounce, if any. */
let pendingSave: string | null = null;
/** Debounce for writing the interface preferences back. */
let prefsTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Deja de escuchar el progreso de la descarga.
 *
 * Fuera del store porque no es estado que nadie pinte: solo hace falta para
 * soltar el listener si la instalación falla. Si funciona, la app se reinicia
 * y no queda nada que soltar.
 */
let pararProgreso: (() => void) | null = null;

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
export interface ToastNotice {
  message: string;
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

export interface CantoralState {
  // ---- data ----
  tracks: Track[];
  folders: Folder[];
  playlists: Playlist[];
  plOrder: Record<string, string[]>;
  /** Ordered track ids the transport walks through (a culto list, or the library). */
  queue: string[];

  // ---- ui / navigation ----
  theme: Theme;
  themeMode: ThemeMode;
  view: View;
  libState: LibState;

  // ---- library filters ----
  query: string;
  qf: QuickFilter;
  ocasion: string | null;
  /**
   * Tags the library is filtered by, ANDed together.
   *
   * Separate from `query` because a tag is the one field the user controls
   * completely, and folding it into the free-text search meant «lento» also
   * matched an album called «Lento».
   */
  tagFilter: string[];
  groupBy: GroupBy;
  densidad: Densidad;
  /**
   * Grupos plegados, por clave.
   *
   * Vive en la sesión y no en las preferencias: plegar «Himnos» es para dejar
   * de verlo *ahora*, mientras se arma un culto con lo de otra carpeta, no una
   * decisión que valga la pena recordar hasta la semana que viene.
   */
  gruposColapsados: string[];
  /** Las pantallas conectadas, leídas al entrar en Proyección. */
  monitores: MonitorInfo[];
  /** Por cuál sale. Vive en la sesión: el índice de una pantalla cambia al
   *  enchufar o desenchufar una, así que recordarlo entre arranques apuntaría
   *  a la de al lado. */
  monitorSalida: number;
  /** Si la ventana de salida está abierta. */
  proyectando: boolean;
  /**
   * Qué elemento del culto está en pantalla. `-1` es nada: el proyector en
   * negro con la salida abierta, que es como empieza y como se queda entre una
   * cosa y otra.
   *
   * Un índice en el orden del culto y no un id de pista: la cola es la lista
   * abierta en su orden, y la misma pista puede estar dos veces en un culto
   * —una canción que se repite al final— sin que sean el mismo momento.
   */
  proyeccionIdx: number;
  /**
   * De qué lista es ese índice.
   *
   * No es siempre la lista abierta. En pleno culto se abre otra para buscar
   * algo, y si «Siguiente» avanzara por la que se está mirando sacaría por el
   * proyector una pista de una lista que nadie pidió. Lo que está en el aire
   * sigue siendo de la lista con la que se empezó hasta que se proyecte otra
   * cosa a propósito.
   */
  proyeccionLista: string;
  /**
   * Si el proyector está en negro aunque haya un elemento apuntado.
   *
   * Dos cosas distintas: «no hay nada elegido» es `proyeccionIdx === -1`, y
   * «hay algo elegido pero no se está viendo» es esto. Pasa al cortar la
   * imagen a mano y al terminarse un elemento, y en los dos casos lo elegido
   * sigue ahí para volver.
   */
  proyeccionEnNegro: boolean;
  /**
   * En qué estrofa de la letra va lo que está en pantalla.
   *
   * Solo cuenta con una pista de audio proyectada como letra. `0` es la
   * primera; una pista sin letra tiene cero estrofas y se queda en `0`.
   */
  proyeccionEstrofa: number;
  /** Qué sale por el proyector con una pista de solo audio. Se recuerda. */
  salidaDeAudio: SalidaDeAudio;
  /** Qué pasa entre un elemento del culto y el siguiente. Se recuerda. */
  transicionProyeccion: TransicionProyeccion;
  /** Por dónde va lo que se está proyectando, en segundos. Lo dice la salida. */
  proyeccionPos: number;
  proyeccionDur: number;
  /**
   * Lo último que falló al proyectar, por `src`.
   *
   * Por id de pista y no un solo mensaje porque lo que interesa es *qué
   * elemento* de la cola no se puede proyectar: marcarlo en su fila se ve antes
   * de empezar el culto, y un aviso suelto se pierde.
   *
   * Sólo se apunta lo que falla estando en pantalla. Lo que falle mientras se
   * precarga se calla hasta que le toque, porque el elemento que precarga no
   * informa: si lo hiciera, un archivo roto al final del culto escribiría un
   * aviso rojo en la cola mientras suena tranquilamente el primero.
   */
  proyeccionFallos: Record<string, string>;
  /**
   * Si la tarjeta de escaneo de la esquina está escondida.
   *
   * Esconderla no cancela nada: son dos cosas distintas —quiero seguir
   * trabajando sin la tarjeta delante, y quiero que el escaneo pare—, y un
   * solo botón para las dos haría que quien quisiera lo primero perdiera el
   * escaneo. Se vuelve a mostrar en el siguiente escaneo.
   */
  tarjetaEscaneoOculta: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";

  // ---- selection ----
  /**
   * Rows picked in the library, for acting on several at once.
   *
   * Click order, not display order — what is done with them is put in display
   * order at the moment of doing it (see `seleccionVigente`).
   */
  selection: string[];
  /** Row a Shift-click measures its run from. */
  selAnchor: string | null;
  /** Ids being dragged out of the library, or empty. */
  dragFromLibrary: string[];
  /** Row whose context menu is open, and where to draw it. */
  rowMenu: { id: string; x: number; y: number } | null;

  // ---- detail panel ----
  selId: string | null;
  detailOpen: boolean;
  tagDraft: string;
  /** How the selected track's edit is doing. Edits write themselves. */
  saveState: SaveState;

  // ---- dialog / scan ----
  dialog: "addFolder" | "newList" | "editList" | "help" | "importList" | "printPreview" | "addToList" | null;
  /**
   * A shared playlist file that has been read and matched, waiting for the
   * user to look at what was found before anything is created.
   */
  importPreview: ImportPreview | null;

  // ---- actualizaciones ----
  /** Lo último que se supo del actualizador. `null` = todavía sin preguntar. */
  update: UpdateCheck | null;
  updateState: "idle" | "checking" | "downloading" | "error";
  /** Por qué falló la última comprobación, para poder decirlo. */
  updateError: string | null;
  updateProgress: UpdateProgress | null;
  /**
   * Whether a scan is walking the disk right now.
   *
   * Deliberately separate from `libState`: a scan runs *alongside* the library
   * instead of replacing it, so the catalogue stays searchable while its
   * folders are being indexed.
   */
  scanning: boolean;
  scanPct: number;
  /**
   * Archivos que el último escaneo reconoció y no indexó por el formato.
   *
   * Se dice al terminar. Saltárselos en silencio sería peor que no tenerlos:
   * quien ve que faltan tres canciones no tiene forma de saber si es por el
   * formato o porque el escaneo se rompió.
   */
  scanOmitidos: number;
  scanIdx: number;
  scanFile: string;
  /** Message from the last failed backend call, shown in the error state. */
  scanError: string | null;

  // ---- player ----
  playerId: string;
  playing: boolean;
  posSec: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: boolean;

  // ---- collections ----
  curPlaylist: string;
  draggingId: string | null;
  overId: string | null;
  /**
   * What just happened to the order, for a screen reader.
   *
   * Moving a row with the keyboard is silent otherwise: the list re-renders,
   * but nothing says where the song ended up.
   */
  reorderNotice: string;

  // ---- toast ----
  toast: ToastNotice | null;

  /** Destructive action awaiting confirmation, or null. */
  confirm: ConfirmRequest | null;

  // ---- lyrics and chords ----
  /**
   * Sheets already fetched, by track id.
   *
   * A cache rather than part of the catalogue: the snapshot travels whole and
   * has no business carrying a few thousand songs' worth of text.
   */
  sheets: Record<string, Sheet>;
  /** Track whose sheet is open in the editor, or null. */
  sheetDialog: string | null;
  /** How the sheet being edited is doing, reusing the panel's own states. */
  sheetState: SaveState;

  // ---- service view ----
  /** Whether the full-screen view for playing from the stand is up. */
  serviceOpen: boolean;
  /** Position within the open list's order. */
  serviceIdx: number;
  /** Semitones the sheets are shifted by, for the key the group sings in. */
  serviceSemitones: number;
  /** Text size multiplier, for the distance between the stand and the eyes. */
  serviceScale: number;

  // ---- duplicates ----
  /** Groups of tracks that look like the same song. Empty until searched. */
  duplicates: DuplicateGroup[];
  /** How many groups the user has waved off, so they can be offered back. */
  duplicatesDismissed: number;
  duplicatesState: "idle" | "buscando" | "listo";

  // ---- actions ----
  showBiblioteca: () => void;
  showColecciones: () => void;
  showConfig: () => void;
  onFolderClick: () => void;
  openPlaylist: (id: string) => void;
  toggleTheme: () => void;
  setThemeMode: (m: ThemeMode) => void;
  applySystemTheme: () => void;

  onQuery: (v: string) => void;
  clearQuery: () => void;
  onQuickFilter: (q: Exclude<QuickFilter, null>) => void;
  onOcasion: (o: string) => void;
  /** Add or remove a tag from the filter. Several tags narrow, never widen. */
  onTagFilter: (tag: string) => void;
  /** Rename a tag everywhere, folding it into an existing one if taken. */
  renameTag: (from: string, to: string) => void;
  /** Take a tag off every track that carried it, after confirming. */
  deleteTag: (name: string) => void;
  onGroupBy: (g: GroupBy) => void;
  setDensidad: (d: Densidad) => void;
  toggleGrupo: (clave: string) => void;
  showProyeccion: (playlistId?: string) => void;
  cargarMonitores: () => Promise<void>;
  elegirMonitor: (indice: number) => void;
  alternarProyeccion: () => void;
  proyectar: (salida: SalidaProyeccion) => void;
  /** Poner en pantalla el elemento `idx` del culto abierto. */
  proyectarElemento: (idx: number) => void;
  /** Pasar al siguiente del culto. */
  proyeccionSiguiente: () => void;
  /** Dejar el proyector en negro sin perder por dónde iba el culto. */
  proyeccionNegro: () => void;
  setSalidaDeAudio: (v: SalidaDeAudio) => void;
  setTransicionProyeccion: (v: TransicionProyeccion) => void;
  /** Volver a mandar a la salida lo que ya está en pantalla. */
  reproyectar: () => void;
  /** Empezar a escuchar lo que devuelve la salida. Devuelve cómo dejar de hacerlo. */
  escucharProyeccion: () => Promise<() => void>;
  ocultarTarjetaEscaneo: () => void;
  onSortHeader: (k: SortKey) => void;

  onRowClick: (id: string, mods?: Modificadores) => void;
  /** Pick every row the library is currently showing. */
  selectAllVisible: () => void;
  clearSelection: () => void;
  openRowMenu: (id: string, x: number, y: number) => void;
  closeRowMenu: () => void;
  /** Note that a drag out of the library started, carrying `ids`. */
  startLibraryDrag: (ids: string[]) => void;
  endLibraryDrag: () => void;

  /** Append the selection to a list, in the order it is shown. */
  agregarPistas: (playlistId: string, ids: readonly string[]) => void;
  bulkAddToPlaylist: (playlistId: string) => void;
  /** Mark or unmark the selection as favourites. */
  bulkFav: (fav: boolean) => void;
  /** Put a tag on the selection, or take it off it. */
  bulkTag: (tag: string, add: boolean) => void;
  /** Drop the selection from the catalogue, after confirming. */
  bulkDelete: () => void;
  onFav: (id: string) => void;

  play: (id: string, queue?: string[]) => void;
  togglePlay: () => void;
  /** Auto-advance when a track finishes (honours «repetir»). */
  advance: () => void;
  /** Poner el transporte en una pista, abriendo lo que haga falta para verla. */
  irAPista: (id: string) => void;
  prev: () => void;
  next: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleMute: () => void;
  seekToFraction: (f: number) => void;
  setVolume: (f: number) => void;

  /** Change one field of the selected track. It writes itself, debounced. */
  setEdit: (field: keyof TrackEdit, val: unknown) => void;
  onTagDraft: (v: string) => void;
  addTag: (v: string) => void;
  removeTag: (tag: string) => void;
  closeDetail: () => void;
  /** Write an edit still waiting out the debounce, right now. */
  flushEdit: () => void;

  openAddFolder: () => void;
  openHelp: () => void;
  closeDialog: () => void;
  confirmAddFolder: () => void;
  indexFolder: (path?: string, recursive?: boolean) => void;
  startScan: () => void;
  cancelScan: () => void;
  retryError: () => void;
  hydrate: () => Promise<void>;

  playAll: () => void;
  exportPl: () => void;
  /** Show the sheet as it will be printed, before anything leaves the app. */
  openPrintPreview: () => void;

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
  /**
   * Whether the printed sheet carries the lyrics and chords.
   *
   * Remembered between sessions: whoever prints for the music stand prints for
   * the music stand every week.
   */
  printWithLyrics: boolean;
  setPrintWithLyrics: (con: boolean) => void;
  newList: () => void;
  /** `desde` is the id of the template whose order the new list starts from. */
  createList: (nombre: string, fecha: string, ocasion: string, desde?: string) => void;
  editCurrentList: () => void;
  updateList: (nombre: string, fecha: string, ocasion: string) => void;
  openAddToList: () => void;
  addToListConfirm: (playlistId: string) => void;
  deleteCurrentList: () => void;
  /** Copy a list with its whole order and open the copy. */
  duplicateList: (id: string) => void;
  /** Copy the open list. */
  duplicateCurrentList: () => void;
  /** Keep the open list as a starting point for new ones, or stop doing so. */
  toggleCurrentTemplate: () => void;
  /** Write the open list as a file another installation can import. */
  shareCurrentList: () => void;
  /** Read a shared list and show what it matched, without creating anything. */
  importList: () => void;
  /** Create the list the import preview describes. */
  confirmImport: () => void;
  removeFromPl: (id: string) => void;
  reorderPl: (toId: string) => void;
  /** Move a track up or down the open list. The keyboard's way in. */
  moveInPlaylist: (id: string, delta: number) => void;
  setDragging: (id: string) => void;
  setOver: (id: string | null) => void;
  clearDrag: () => void;

  /** Show a track's file in the system file manager. */
  revealTrack: (id: string) => void;
  /** Point a track at its file's new location, keeping tags and favourite. */
  relocateTrack: (id: string) => void;
  /** Drop a track from the catalogue. The audio file is never touched. */
  deleteTrack: (id: string) => void;
  /** Point a whole indexed folder at its new location. */
  relocateFolder: (id: string) => void;
  removeFolder: (id: string) => void;
  rescanFolder: (id?: string) => void;
  backup: () => void;
  restore: () => void;

  tick: () => void;
  showToast: (m: string, type?: ToastType) => void;

  /** Fetch one track's sheet if it is not already in hand. */
  loadSheet: (id: string) => void;
  /** Fetch the sheets of a whole list, for the service view and the export. */
  loadSheets: (ids: string[]) => Promise<void>;
  /** Open the sheet editor on a track. */
  openSheetEditor: (id: string) => void;
  closeSheetEditor: () => void;
  /** Change one half of the open sheet. It writes itself, debounced. */
  setSheet: (campo: "letra" | "acordes", valor: string) => void;
  /** Write a sheet still waiting out the debounce, right now. */
  flushSheet: () => void;

  /** Open the full-screen view over the list that is open. */
  openService: () => void;
  closeService: () => void;
  serviceGo: (delta: number) => void;
  transposeService: (delta: number) => void;
  scaleService: (delta: number) => void;

  /** Look for tracks that are the same song. */
  findDuplicates: () => void;
  /** Fold a group's other copies into the one chosen, after confirming. */
  mergeDuplicates: (signature: string, keepId: string) => void;
  /** Mark a group as not duplicates, so it stops being offered. */
  dismissDuplicates: (signature: string) => void;
  /** Offer every dismissed group again. */
  restoreDismissedDuplicates: () => void;

  askConfirm: (req: ConfirmRequest) => void;
  acceptConfirm: () => void;
  closeConfirm: () => void;
}

const initialPlOrder: Record<string, string[]> = {};
SEED_PLAYLISTS.forEach((p) => (initialPlOrder[p.id] = p.ids.slice()));

/** True in a plain browser (`pnpm dev`), where the seed stands in for the backend. */
const MOCK = !isTauri();

export const useStore = create<CantoralState>((set, get) => {
  const toast = (m: string, type: ToastType = "success") => get().showToast(m, type);

  /** Replace the catalogue from a backend snapshot, preserving the player /
   *  playlist selection when the referenced ids still exist. */
  const applySnapshot = (snap: Snapshot) => {
    const plOrder: Record<string, string[]> = {};
    snap.playlists.forEach((p) => (plOrder[p.id] = p.ids.slice()));
    // Turn cover file paths into asset:// URLs the webview can load.
    const tracks = snap.tracks.map((t) => (t.cover ? { ...t, cover: assetUrl(t.cover) } : t));
    const st = get();
    const curPlaylist = snap.playlists.some((p) => p.id === st.curPlaylist)
      ? st.curPlaylist
      : snap.playlists[0]?.id || st.curPlaylist;
    const playerId = tracks.some((t) => t.id === st.playerId)
      ? st.playerId
      : tracks[0]?.id || st.playerId;
    // Drop queued ids whose track vanished in the rescan.
    const live = new Set(tracks.map((t) => t.id));
    const queue = st.queue.filter((id) => live.has(id));
    set({
      tracks,
      folders: snap.folders,
      playlists: snap.playlists,
      plOrder,
      curPlaylist,
      playerId,
      queue,
      // Any list of duplicates was computed against the catalogue that just
      // got replaced. Offering the user a choice about tracks that may no
      // longer exist is worse than asking them to search again.
      duplicates: [],
      duplicatesState: "idle",
    });
  };

  /** How often the catalogue is pulled in while a scan is running. */
  const REFRESCO_MS = 2000;

  /**
   * Pull the catalogue periodically while a scan walks the disk.
   *
   * The backend was built for exactly this — the scan runs on its own
   * connection and commits in batches of 200 — so what it has indexed so far is
   * already readable. Without this the library would sit frozen at whatever it
   * held when the scan started and only catch up at the very end.
   */
  const startLiveRefresh = () => {
    if (refreshTimer || !isTauri()) return;
    refreshTimer = setInterval(() => {
      // Never while a pull is already out, and never on top of an edit still
      // waiting out its debounce: the snapshot would overwrite what is being
      // typed with the value the backend has not been told about yet.
      if (refreshing || pendingSave) return;
      refreshing = true;
      void getLibrary()
        .then((snap) => {
          // A snapshot that arrives after the scan ended is stale by
          // definition — the final one has already landed.
          if (!snap || !get().scanning) return;
          applySnapshot(snap);
          // As soon as there is something to show, the library shows it: the
          // full-view scan card is only for having nothing at all.
          if (snap.tracks.length) set({ libState: "content" });
        })
        .catch((err) => console.error("live refresh failed", err))
        .finally(() => {
          refreshing = false;
        });
    }, REFRESCO_MS);
  };

  const stopLiveRefresh = () => {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  };

  /**
   * Build the printable page for a list and hand it wherever it goes.
   *
   * Split out of `exportPl` because that now has to wait for the lyrics before
   * it can build anything, and the waiting has two endings — with them, and
   * without them if they could not be read.
   */
  const escribirHoja = (pl: Playlist, rows: Track[], ord: string[]) => {
    const s = get();
    const html = playlistSheetHtml(pl, rows, plDur(s, ord), s.sheets);
    const name = sheetFileName(pl.nombre);
    if (!isTauri()) {
      // Browser fallback so the sheet is testable with `pnpm dev`.
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast("Hoja de la lista exportada");
      return;
    }
    void pickExportPath(name).then((dest) => {
      if (!dest) return;
      exportPlaylistCmd(dest, html)
        .then(() => {
          toast("Hoja de la lista exportada");
          // Opens in the default browser, where Cmd/Ctrl+P saves it as PDF.
          return openExportedSheet(dest);
        })
        .catch((err) => {
          console.error(err);
          toast("No se pudo exportar la lista", "error");
        });
    });
  };

  /** Write the sheet waiting out its debounce, reading the latest text. */
  const writePendingSheet = () => {
    const id = pendingSheet;
    pendingSheet = null;
    if (sheetTimer) clearTimeout(sheetTimer);
    sheetTimer = null;
    if (!id) return;
    const hoja = get().sheets[id];
    if (!hoja) return;
    updateTrackSheet(id, hoja.letra, hoja.acordes)
      .then(() => {
        if (get().sheetDialog === id) set({ sheetState: "saved" });
      })
      .catch((err) => {
        console.error("update_track_sheet failed", err);
        if (get().sheetDialog === id) set({ sheetState: "error" });
        toast("No se pudo guardar la letra", "error");
      });
  };

  const scheduleSheetSave = (id: string) => {
    if (pendingSheet && pendingSheet !== id) writePendingSheet();
    pendingSheet = id;
    if (sheetTimer) clearTimeout(sheetTimer);
    sheetTimer = setTimeout(writePendingSheet, 600);
  };

  /**
   * Write the track that is waiting out the debounce.
   *
   * Reads the values straight from the catalogue rather than from a copy taken
   * when the edit was made, so whatever the user ended up with is what gets
   * stored — including keystrokes that landed after the timer was set.
   */
  const writePendingEdit = () => {
    const id = pendingSave;
    pendingSave = null;
    if (!id) return;
    const t = get().tracks.find((x) => x.id === id);
    if (!t) return;

    updateTrackCmd(t.id, t.tono, t.bpm, t.ocasion, t.tags || [])
      .then(() => {
        // Only report success for the track still on screen; a stale reply from
        // a track the user has moved on from must not relabel this one.
        if (get().selId === id) set({ saveState: "saved" });
      })
      .catch((err) => {
        console.error("update_track failed", err);
        // The typed value is kept: yanking it back mid-edit would lose work for
        // a failure the user can do nothing about. The footer says so instead.
        if (get().selId === id) set({ saveState: "error" });
        get().showToast("No se pudieron guardar los cambios", "error");
      });
  };

  /** Push the write out by a beat, so a burst of typing is one round trip. */
  const scheduleSave = (id: string) => {
    // Moving to another track writes the previous one before taking its place.
    if (pendingSave && pendingSave !== id) writePendingEdit();
    pendingSave = id;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      writePendingEdit();
    }, 600);
  };

  /**
   * Apply a new playlist order at once and persist it, putting the previous one
   * back if the backend refuses.
   *
   * The order used to be saved with a bare `void setPlaylistOrderCmd(...)`, so a
   * write that failed left the screen showing an order the database never got —
   * and the user found out at the next launch, when their culto had reverted.
   */
  const saveOrder = (playlistId: string, next: string[], prev: string[]) => {
    set((st) => ({ plOrder: { ...st.plOrder, [playlistId]: next } }));
    setPlaylistOrderCmd(playlistId, next).catch((err) => {
      console.error("set_playlist_order failed", err);
      set((st) => ({ plOrder: { ...st.plOrder, [playlistId]: prev } }));
      get().showToast("No se pudo guardar el orden de la lista", "error");
    });
  };

  return {
    // The seed catalogue is browser-only scaffolding. Inside Tauri the store
    // starts empty and `hydrate()` fills it from SQLite, so demo data can never
    // flash on screen nor survive a failed load.
    tracks: MOCK ? SEED_TRACKS.map((t) => ({ ...t })) : [],
    folders: MOCK ? SEED_FOLDERS.map((f) => ({ ...f })) : [],
    playlists: MOCK ? SEED_PLAYLISTS : [],
    plOrder: MOCK ? initialPlOrder : {},
    queue: [],

    themeMode: "system",
    theme: resolveTheme("system"),
    view: "biblioteca",
    libState: MOCK ? "content" : "empty",

    query: "",
    qf: null,
    ocasion: null,
    tagFilter: [],
    groupBy: "none",
    densidad: "comoda",
    gruposColapsados: [],
    monitores: [],
    monitorSalida: 0,
    proyectando: false,
    proyeccionIdx: -1,
    proyeccionLista: "",
    proyeccionEnNegro: true,
    proyeccionEstrofa: 0,
    salidaDeAudio: "letra",
    transicionProyeccion: "negro",
    proyeccionPos: 0,
    proyeccionDur: 0,
    proyeccionFallos: {},
    tarjetaEscaneoOculta: false,
    sortKey: "titulo",
    sortDir: "asc",

    selection: [],
    selAnchor: null,
    dragFromLibrary: [],
    rowMenu: null,

    selId: null,
    detailOpen: false,
    tagDraft: "",
    saveState: "idle",

    dialog: null,
    importPreview: null,
    update: null,
    updateState: "idle",
    updateError: null,
    updateProgress: null,
    printWithLyrics: false,
    scanning: false,
    scanPct: 0,
    scanOmitidos: 0,
    scanIdx: 0,
    scanFile: "",
    scanError: null,

    playerId: MOCK ? "t1" : "",
    playing: false,
    posSec: MOCK ? 47 : 0,
    volume: 0.72,
    muted: false,
    shuffle: false,
    repeat: false,

    curPlaylist: MOCK ? "p1" : "",
    draggingId: null,
    overId: null,
    reorderNotice: "",

    toast: null,
    confirm: null,

    sheets: {},
    sheetDialog: null,
    sheetState: "idle",

    serviceOpen: false,
    serviceIdx: 0,
    serviceSemitones: 0,
    serviceScale: 1,

    duplicates: [],
    duplicatesDismissed: 0,
    duplicatesState: "idle",

    // ---------- nav ----------
    showBiblioteca: () => set({ view: "biblioteca" }),
    showColecciones: () => set({ view: "colecciones" }),
    showConfig: () => set({ view: "config" }),
    onFolderClick: () =>
      set({ view: "biblioteca", libState: "content", qf: null, ocasion: null }),
    openPlaylist: (id) => set({ view: "lista", curPlaylist: id }),
    toggleTheme: () => {
      get().setThemeMode(get().theme === "dark" ? "light" : "dark");
    },
    setThemeMode: (m) => {
      const theme = resolveTheme(m);
      set({ themeMode: m, theme });
      if (isTauri()) void setSetting("themeMode", m);
    },
    applySystemTheme: () => {
      if (get().themeMode === "system") set({ theme: osPrefersDark() ? "dark" : "light" });
    },

    // ---------- library filters ----------
    onQuery: (v) => set({ query: v }),
    clearQuery: () => set({ query: "" }),
    onQuickFilter: (q) =>
      set((s) => ({ qf: s.qf === q ? null : q, view: "biblioteca", libState: "content" })),
    onOcasion: (o) => set((s) => ({ ocasion: s.ocasion === o ? null : o || null })),
    onTagFilter: (tag) =>
      set((st) => ({
        // A new array every time: the memoised selectors key on its identity.
        tagFilter: st.tagFilter.includes(tag)
          ? st.tagFilter.filter((t) => t !== tag)
          : [...st.tagFilter, tag],
        view: "biblioteca",
      })),
    // Cambiar el eje deja las claves plegadas sin sentido —«f1/Clásicos» no
    // quiere decir nada cuando se agrupa por álbum—, así que se olvidan.
    onGroupBy: (g) => set({ groupBy: g, gruposColapsados: [] }),
    setDensidad: (d) => set({ densidad: d }),
    ocultarTarjetaEscaneo: () => set({ tarjetaEscaneoOculta: true }),

    showProyeccion: (playlistId) => {
      // La tarjeta «En vivo» nombra un culto concreto, así que su «Proyectar»
      // abre ese y no el que estuviera abierto de antes: proyectar una lista
      // distinta de la que se acaba de leer en el botón sería lo último que
      // quien opera va a revisar antes de empezar.
      set(playlistId ? { view: "proyeccion", curPlaylist: playlistId } : { view: "proyeccion" });
      void get().cargarMonitores();
    },

    cargarMonitores: async () => {
      const lista = await projectionMonitors().catch((err) => {
        console.error("projection_monitors failed", err);
        return [] as MonitorInfo[];
      });
      set((st) => ({
        monitores: lista,
        // Por defecto, la primera pantalla que no sea en la que está la
        // ventana: en un culto el proyector es siempre la otra. Si solo hay
        // una, se queda esa y quien opera verá la salida encima — que es lo
        // que pasa cuando se prepara sin el proyector conectado.
        monitorSalida:
          lista.some((m) => m.indice === st.monitorSalida) && st.proyectando
            ? st.monitorSalida
            : (lista.find((m) => !m.principal) ?? lista[0])?.indice ?? 0,
      }));
    },

    elegirMonitor: (indice) => {
      set({ monitorSalida: indice });
      // En marcha, elegir otra pantalla la mueve: pedir que se cierre y se
      // vuelva a abrir sería un parpadeo delante de la congregación.
      if (get().proyectando) {
        void openProjectionCmd(indice).catch((err) => {
          console.error("open_projection failed", err);
          toast("No se pudo mover la proyección a esa pantalla", "error");
        });
      }
    },

    alternarProyeccion: () => {
      if (get().proyectando) {
        // Cortar deja la cola donde estaba. Quien corta suele cortar para
        // arreglar algo —el proyector, el cable, un archivo— y volver al
        // mismo sitio, no para empezar el culto otra vez.
        set({ proyectando: false, proyeccionPos: 0, proyeccionDur: 0 });
        void closeProjectionCmd().catch(console.error);
        return;
      }
      void openProjectionCmd(get().monitorSalida)
        .then(() => {
          set({ proyectando: true });
          // Salir al aire es salir con algo. Con un culto a medias vuelve a
          // donde estaba —y a la lista en la que estaba—; si no, empieza por
          // el principio del que esté abierto.
          const st = get();
          if (st.proyeccionIdx >= 0 && filasProyectadas(st).length > st.proyeccionIdx) {
            set({ proyeccionEnNegro: false, proyeccionPos: 0, proyeccionDur: 0 });
            get().proyectar(salidaDelCulto(get(), st.proyeccionIdx, true));
          } else if (filasDeLista(st).length > 0) {
            get().proyectarElemento(0);
          } else {
            get().proyeccionNegro();
          }
        })
        .catch((err) => {
          console.error("open_projection failed", err);
          toast("No se pudo abrir la proyección", "error");
        });
    },

    proyectar: (salida) => {
      if (!get().proyectando) return;
      void setProjectionCmd(salida).catch((err) => console.error("set_projection failed", err));
    },

    proyectarElemento: (idx) => {
      // Se proyecta desde la lista abierta, y a partir de aquí esa pasa a ser
      // la que está en el aire.
      if (idx < 0 || idx >= filasDeLista(get()).length) return;
      // Y se calla lo que estuviera sonando en el portátil. Hay una sola salida
      // de audio: dos cosas a la vez por los altavoces del culto no es algo que
      // nadie quiera, y ahora que el video suena dentro de la app es fácil
      // acabar ahí sin darse cuenta.
      if (get().playing) set({ playing: false });
      const veniaDeOtro = get().proyeccionIdx !== idx || get().proyeccionEnNegro;
      set({
        proyeccionIdx: idx,
        proyeccionLista: get().curPlaylist,
        proyeccionEnNegro: false,
        proyeccionEstrofa: 0,
        proyeccionPos: 0,
        proyeccionDur: 0,
      });
      get().proyectar({
        ...salidaDelCulto(get(), idx, true),
        // Volver a poner lo mismo que ya estaba —pulsar su fila otra vez— no
        // lleva transición: sería medio segundo de negro sin motivo.
        ...(veniaDeOtro ? { transicion: get().transicionProyeccion } : {}),
      });
    },

    proyeccionSiguiente: () => {
      const st = get();
      // Primero la letra, después la cola. «Siguiente» es un solo botón y una
      // sola tecla porque desde el atril no se quiere elegir entre dos: se
      // quiere pasar a lo que viene, sea la estrofa de abajo o la canción de
      // después.
      const trozos = estrofasEnPantalla(st);
      if (!st.proyeccionEnNegro && st.proyeccionEstrofa + 1 < trozos.length) {
        set({ proyeccionEstrofa: st.proyeccionEstrofa + 1 });
        get().proyectar(salidaDelCulto(get(), st.proyeccionIdx, true));
        return;
      }
      const filas = filasProyectadas(st);
      const siguiente = st.proyeccionIdx + 1;
      if (siguiente >= filas.length) {
        // Se acabó el culto. Negro y no volver al principio: nadie quiere que
        // la última canción arranque otra vez sola delante de todos.
        get().proyeccionNegro();
        return;
      }
      set({ proyeccionIdx: siguiente, proyeccionEnNegro: false, proyeccionEstrofa: 0, proyeccionPos: 0, proyeccionDur: 0 });
      get().proyectar({ ...salidaDelCulto(get(), siguiente, true), transicion: get().transicionProyeccion });
    },

    setSalidaDeAudio: (v) => {
      set({ salidaDeAudio: v });
      // En marcha, el cambio se ve al momento: quien lo está tocando lo toca
      // para ver el efecto, no para que se aplique en la siguiente canción.
      get().reproyectar();
    },

    setTransicionProyeccion: (v) => set({ transicionProyeccion: v }),

    /** Volver a mandar lo que ya está en pantalla, con lo que haya cambiado. */
    reproyectar: () => {
      const st = get();
      if (!st.proyectando || st.proyeccionEnNegro || st.proyeccionIdx < 0) return;
      get().proyectar(salidaDelCulto(st, st.proyeccionIdx, true));
    },

    proyeccionNegro: () => {
      set({ proyeccionEnNegro: true, proyeccionPos: 0, proyeccionDur: 0 });
      // El negro se lleva la precarga del siguiente: volver del negro tiene
      // que ser inmediato, y lo que venga después ya está cargado.
      get().proyectar({ vista: { modo: "negro" }, precarga: precargaDe(get(), get().proyeccionIdx) });
    },

    escucharProyeccion: async () => {
      // La salida acaba de engancharse: se le manda lo que debería estar
      // viendo. Sin esto, lo primero del culto se pierde en el arranque.
      // `proyectar` ya no manda nada con la salida cortada, así que un aviso
      // que llegue tarde no hace falta filtrarlo aquí también.
      const soltarLista = await onProjectionReady(() => {
        const st = get();
        get().proyectar(
          st.proyeccionIdx >= 0 && filasProyectadas(st).length > st.proyeccionIdx
            ? salidaDelCulto(st, st.proyeccionIdx, true)
            : { vista: { modo: "negro" } },
        );
      });
      const soltarEstado = await onProjectionState((e) => {
        const st = get();
        const actual = filasProyectadas(st)[st.proyeccionIdx];
        // Lo que llega de un archivo que ya no está en pantalla es de antes de
        // pasar de elemento y se descarta: escribirlo pondría el tiempo de la
        // canción anterior debajo de la que acaba de empezar.
        if (!actual || !st.proyectando || rutaProyectable(actual) !== e.src) return;
        if (e.fin) {
          // Se acabó lo que había en pantalla. Negro, y no pasar solo al
          // siguiente: en un culto el video se termina mientras alguien está
          // hablando, y arrancar la canción de después por su cuenta delante
          // de la congregación no lo puede decidir la app. Lo siguiente queda
          // cargado y en pausa, a un botón de distancia.
          set({ proyeccionEnNegro: true, proyeccionPos: e.dur || get().proyeccionDur });
          get().proyectar({ vista: { modo: "negro" }, precarga: precargaDe(get(), get().proyeccionIdx) });
          return;
        }
        if (e.error !== undefined) {
          const motivo = motivoDeError(e.error, actual.path);
          set((prev) => ({ proyeccionFallos: { ...prev.proyeccionFallos, [actual.id]: motivo } }));
          toast(`«${actual.titulo}»: ${motivo.toLocaleLowerCase("es")}`, "error");
          return;
        }
        set((prev) => {
          // Un archivo que va se quita de la lista de fallos: pasa al
          // reapuntarlo o al convertirlo sin cerrar la app.
          const fallos = prev.proyeccionFallos[actual.id]
            ? Object.fromEntries(Object.entries(prev.proyeccionFallos).filter(([k]) => k !== actual.id))
            : prev.proyeccionFallos;
          return { proyeccionPos: e.pos, proyeccionDur: e.dur || prev.proyeccionDur, proyeccionFallos: fallos };
        });
      });
      return () => {
        soltarLista();
        soltarEstado();
      };
    },
    toggleGrupo: (clave) =>
      set((st) => ({
        gruposColapsados: st.gruposColapsados.includes(clave)
          ? st.gruposColapsados.filter((c) => c !== clave)
          : [...st.gruposColapsados, clave],
      })),
    onSortHeader: (k) =>
      set((s) => ({
        sortKey: k,
        sortDir: s.sortKey === k ? (s.sortDir === "asc" ? "desc" : "asc") : "asc",
      })),

    // ---------- rows ----------
    onRowClick: (id, mods) => {
      const st = get();
      const visibles = applyFilters(st).map((t) => t.id);
      const r = alHacerClic(visibles, st.selection, st.selAnchor, id, mods);
      set({ selection: r.seleccion, selAnchor: r.ancla, rowMenu: null });
      if (!r.abrirDetalle) return;
      // Moving to another track must not leave the previous one's edit in limbo.
      if (st.selId !== id) get().flushEdit();
      set({ selId: id, detailOpen: true, tagDraft: "", saveState: "idle" });
    },

    selectAllVisible: () => {
      const visibles = applyFilters(get()).map((t) => t.id);
      set({ selection: visibles, selAnchor: visibles[0] ?? null });
    },

    clearSelection: () => set({ selection: [], selAnchor: null }),

    openRowMenu: (id, x, y) =>
      set((st) => ({
        rowMenu: { id, x, y },
        // A menu opened on a row outside the selection is about that row, so
        // the selection follows the click rather than the other way round.
        selection: st.selection.includes(id) ? st.selection : [id],
        selAnchor: st.selection.includes(id) ? st.selAnchor : id,
      })),

    closeRowMenu: () => set({ rowMenu: null }),

    startLibraryDrag: (ids) => set({ dragFromLibrary: ids }),
    endLibraryDrag: () => set({ dragFromLibrary: [] }),

    // ---------- bulk actions ----------
    // Todo lo que agrega pistas a una lista pasa por aquí: el diálogo, y los
    // dos sitios donde se puede soltar un arrastre. Antes había dos acciones
    // con dos comportamientos —una para una pista, otra para la selección— y
    // la de una pista decía «Ya está en la lista» mientras la otra se callaba.
    agregarPistas: (playlistId, ids) => {
      if (ids.length === 0) return;
      const nombre = get().playlists.find((p) => p.id === playlistId)?.nombre ?? "la lista";
      const hecho = (n: number) => {
        set({ rowMenu: null });
        // Cero es un resultado, no un fallo: significa que ya estaban todas, y
        // decir «0 pistas agregadas» sería contarlo como si algo hubiera ido
        // mal.
        if (n === 0) {
          toast(ids.length === 1 ? `Ya estaba en «${nombre}»` : `Ya estaban todas en «${nombre}»`, "info");
          return;
        }
        toast(n === 1 ? `1 pista agregada a «${nombre}»` : `${n} pistas agregadas a «${nombre}»`);
      };
      if (!isTauri()) {
        // Browser stand-in: the same outcome, minus what is already on the list.
        set((st) => {
          const ya = st.plOrder[playlistId] || [];
          const nuevas = ids.filter((id) => !ya.includes(id));
          hecho(nuevas.length);
          return { plOrder: { ...st.plOrder, [playlistId]: [...ya, ...nuevas] } };
        });
        return;
      }
      const yaEstaban = (get().plOrder[playlistId] || []).length;
      addTracksToPlaylistCmd(playlistId, [...ids])
        .then((snap) => {
          if (snap) applySnapshot(snap);
          hecho((get().plOrder[playlistId] || []).length - yaEstaban);
        })
        .catch((err) => {
          console.error("add_tracks_to_playlist failed", err);
          toast("No se pudieron agregar las pistas", "error");
        });
    },

    bulkAddToPlaylist: (playlistId) => get().agregarPistas(playlistId, seleccionVigente(get())),

    /**
     * Abre el único sitio desde el que se agrega a un culto.
     *
     * No abre nada si no hay qué agregar: un diálogo vacío con un «Cancelar»
     * es peor que no responder al atajo.
     */
    openAddToList: () => {
      if (pistasParaAgregar(get()).length === 0) return;
      set({ dialog: "addToList", rowMenu: null });
    },

    addToListConfirm: (playlistId) => {
      const ids = pistasParaAgregar(get());
      get().agregarPistas(playlistId, ids);
      // La selección se deshace al terminar: lo que se quería hacer con ella
      // ya está hecho, y dejarla puesta deja la fila de herramientas ocupada
      // por una barra que ya no tiene trabajo.
      set({ dialog: null, selection: [], selAnchor: null });
    },

    bulkFav: (fav) => {
      const ids = seleccionVigente(get());
      if (ids.length === 0) return;
      const marcadas = new Set(ids);
      set((st) => ({
        tracks: st.tracks.map((t) => (marcadas.has(t.id) ? { ...t, fav } : t)),
        rowMenu: null,
      }));
      if (!isTauri()) return;
      void setTracksFavCmd(ids, fav).catch((err) => {
        console.error("set_tracks_fav failed", err);
        toast("No se pudo guardar el cambio", "error");
      });
    },

    bulkTag: (tag, add) => {
      const ids = seleccionVigente(get());
      const nombre = normalizarEtiqueta(tag);
      if (ids.length === 0 || !nombre) return;
      // The same snapping as the detail panel: a bulk edit must not be what
      // invents a second spelling of an existing tag.
      const existente = etiquetaEquivalente(nombre, etiquetas(get()).map((e) => e.nombre));
      const final = add ? (existente ?? nombre) : nombre;
      const tocadas = new Set(ids);
      set((st) => ({
        tracks: st.tracks.map((t) => {
          if (!tocadas.has(t.id)) return t;
          const tags = t.tags || [];
          if (add) return tags.includes(final) ? t : { ...t, tags: [...tags, final].sort() };
          return { ...t, tags: tags.filter((x) => x !== final) };
        }),
        rowMenu: null,
      }));
      toast(add ? `Etiqueta «${final}» agregada` : `Etiqueta «${final}» quitada`);
      if (!isTauri()) return;
      void tagTracksCmd(ids, final, add).catch((err) => {
        console.error("tag_tracks failed", err);
        toast("No se pudo guardar la etiqueta", "error");
      });
    },

    bulkDelete: () => {
      const ids = seleccionVigente(get());
      if (ids.length === 0) return;
      // Cuántas *pistas* están en alguna lista, no cuántas apariciones suman:
      // una pista en tres listas es una pista, y contarla tres veces daba un
      // número mayor que la propia selección.
      const enAlgunaLista = new Set(Object.values(get().plOrder).flat());
      const enListas = ids.filter((id) => enAlgunaLista.has(id)).length;
      get().askConfirm({
        title: ids.length === 1 ? "¿Quitar esta pista?" : `¿Quitar ${ids.length} pistas?`,
        message: "Salen de la biblioteca y de todas las listas para culto donde estén.",
        detail:
          `Se pierden sus etiquetas, favoritos, tono, tempo, ocasión y la letra que tengan escrita.` +
          (enListas ? `\n${enListas} ${enListas === 1 ? "está" : "están"} en alguna lista.` : ""),
        safe: "Los archivos de audio no se borran del disco. Volverán a aparecer si escaneas su carpeta.",
        confirmLabel: ids.length === 1 ? "Quitar pista" : `Quitar ${ids.length} pistas`,
        onConfirm: () => {
          set({ rowMenu: null, selection: [], selAnchor: null });
          if (!isTauri()) {
            const fuera = new Set(ids);
            set((st) => {
              const plOrder: Record<string, string[]> = {};
              Object.entries(st.plOrder).forEach(([pid, orden]) => {
                plOrder[pid] = orden.filter((id) => !fuera.has(id));
              });
              return { tracks: st.tracks.filter((t) => !fuera.has(t.id)), plOrder };
            });
            toast(ids.length === 1 ? "Pista quitada" : `${ids.length} pistas quitadas`);
            return;
          }
          deleteTracksCmd(ids)
            .then((snap) => {
              if (snap) applySnapshot(snap);
              toast(ids.length === 1 ? "Pista quitada" : `${ids.length} pistas quitadas`);
            })
            .catch((err) => {
              console.error("delete_tracks failed", err);
              toast("No se pudieron quitar las pistas", "error");
            });
        },
      });
    },
    onFav: (id) => {
      const t = get().tracks.find((x) => x.id === id);
      if (!t) return;
      const nf = !t.fav;
      set((s) => ({ tracks: s.tracks.map((x) => (x.id === id ? { ...x, fav: nf } : x)) }));
      void setTrackFav(id, nf);
    },
    // ---------- player ----------
    play: (id, queue) => {
      const s = get();
      const t = s.tracks.find((x) => x.id === id);
      if (!t) return;
      if (t.missing) {
        toast("El archivo no se encuentra en el disco", "error");
        return;
      }
      // Playing from a culto list queues that list, so the transport follows the
      // service order instead of falling back to whatever the library shows.
      //
      // Un video se reproduce dentro, como cualquier otra pista. Esto se lo
      // pasaba al reproductor del sistema, que en mitad de un culto significaba
      // otra ventana encima de la proyección, otro volumen y otra cola — con la
      // lista del culto quedándose atrás.
      set({ queue: queue ?? queueForView(s), playing: true });
      get().irAPista(id);
    },
    togglePlay: () => set((s) => ({ playing: !s.playing })),
    advance: () => {
      // «Repetir» loops the current track; the queue already wraps by itself.
      if (get().repeat) {
        set({ posSec: 0, playing: true });
        return;
      }
      get().next();
    },
    prev: () => {
      const s = get();
      const ids = playQueue(s);
      const i = ids.indexOf(s.playerId);
      const n = ids.length ? ids[(i - 1 + ids.length) % ids.length] : s.playerId;
      get().irAPista(n);
    },
    next: () => {
      const s = get();
      const ids = playQueue(s);
      const i = ids.indexOf(s.playerId);
      let n: string;
      if (s.shuffle && ids.length > 1) {
        do {
          n = ids[Math.floor(Math.random() * ids.length)];
        } while (n === s.playerId);
      } else {
        n = ids.length ? ids[(i + 1) % ids.length] : s.playerId;
      }
      get().irAPista(n);
    },

    irAPista: (id) => {
      // La única superficie de video de esta ventana está en el panel de
      // detalle, así que llegar a un video sin el panel abierto sería llegar a
      // una pista que suena y no se ve. Se abre solo, y en la pista que toca.
      const t = get().tracks.find((x) => x.id === id);
      set(t?.video ? { playerId: id, posSec: 0, detailOpen: true, selId: id } : { playerId: id, posSec: 0 });
    },
    toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
    toggleRepeat: () => set((s) => ({ repeat: !s.repeat })),
    toggleMute: () => set((s) => ({ muted: !s.muted })),
    seekToFraction: (f) => {
      const t = cur(get());
      if (t) set({ posSec: Math.round(Math.min(1, Math.max(0, f)) * t.durSec) });
    },
    setVolume: (f) => set({ volume: Math.min(1, Math.max(0, f)), muted: false }),

    // ---------- detail edit ----------
    setEdit: (field, val) => {
      const id = get().selId;
      if (!id) return;
      // Straight into the catalogue. There is no pending-edit overlay any more,
      // so nothing can be shown as though it were stored while it is not.
      set((s) => ({
        tracks: s.tracks.map((t) => (t.id === id ? { ...t, [field]: val } : t)),
        saveState: "saving",
      }));
      scheduleSave(id);
    },
    onTagDraft: (v) => set({ tagDraft: v }),
    addTag: (v) => {
      const val = normalizarEtiqueta(v);
      if (!val) return;
      const s = get();
      if (!s.selId) return;
      // A tag that already exists but for its capitalisation is the same tag to
      // everyone except SQLite, so the one in the catalogue wins and the pair
      // never forms in the first place.
      const yaExiste = etiquetaEquivalente(val, etiquetas(s).map((e) => e.nombre));
      const nombre = yaExiste ?? val;
      const curT = s.tracks.find((x) => x.id === s.selId);
      const tags = (curT?.tags || []).slice();
      if (!tags.includes(nombre)) tags.push(nombre);
      s.setEdit("tags", tags);
      set({ tagDraft: "" });
      if (nombre !== val) toast(`Se usó «${nombre}», que ya existía`, "info");
    },
    removeTag: (tag) => {
      const s = get();
      if (!s.selId) return;
      const curT = s.tracks.find((x) => x.id === s.selId);
      s.setEdit("tags", (curT?.tags || []).filter((t) => t !== tag));
    },
    closeDetail: () => {
      // Nothing may stay waiting out the debounce once the panel is gone.
      get().flushEdit();
      set({ detailOpen: false });
    },
    flushEdit: () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      writePendingEdit();
    },

    // ---------- dialog / states ----------
    openAddFolder: () => {
      // The buttons that get here are disabled while a scan runs, but the
      // store is where the rule actually lives — only one scan at a time, and
      // the dialog's only outcome is starting one.
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", "info");
        return;
      }
      set({ dialog: "addFolder" });
    },
    openHelp: () => set({ dialog: "help" }),
    closeDialog: () => set({ dialog: null, importPreview: null }),
    confirmAddFolder: () => {
      set({ dialog: null });
      get().indexFolder();
    },
    indexFolder: (path, recursive = true) => {
      set({ dialog: null });
      // The backend refuses a second scan outright, and an error screen is a
      // harsh answer to what is usually a double click.
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", "info");
        return;
      }
      if (isTauri() && path) {
        if (scanTimer) clearInterval(scanTimer);
        scanTimer = null;
        // The view does move to the library here — the user just asked for a
        // folder from the add dialog, so that is where they expect to land.
        // What it no longer does is *replace* the library with the scan.
        set({ view: "biblioteca", scanning: true, scanPct: 0, scanIdx: 0, scanFile: "", scanOmitidos: 0, tarjetaEscaneoOculta: false });
        startLiveRefresh();
        addAndScanFolder(path, recursive)
          .then((snap) => {
            applySnapshot(snap);
            set({ scanning: false, libState: snap.tracks.length ? "content" : "empty", scanPct: 100 });
            toast(`Biblioteca actualizada${avisoDeOmitidos(get().scanOmitidos)}`);
          })
          .catch((err) => {
            console.error(err);
            lastFailedAction = () => get().indexFolder(path, recursive);
            set({ scanning: false, libState: "error", scanError: String(err) });
          })
          .finally(stopLiveRefresh);
      } else {
        set({ view: "biblioteca" });
        get().startScan();
      }
    },
    // Browser stand-in for a real scan. It deliberately does not touch `view`:
    // it stands in for both adding a folder and re-scanning one, and only the
    // first of those has any business moving the user.
    startScan: () => {
      if (scanTimer) clearInterval(scanTimer);
      set({ scanning: true, scanPct: 0, scanIdx: 0, scanOmitidos: 0, tarjetaEscaneoOculta: false });
      scanTimer = setInterval(() => {
        const p = get().scanPct + Math.random() * 7 + 3;
        if (p >= 100) {
          if (scanTimer) clearInterval(scanTimer);
          scanTimer = null;
          set({ scanPct: 100, scanning: false, libState: "content" });
          toast("Biblioteca actualizada");
        } else {
          set({
            scanPct: p,
            scanIdx: Math.min(SCAN_FILES.length - 1, Math.floor((p / 100) * SCAN_FILES.length)),
          });
        }
      }, 160);
    },
    cancelScan: () => {
      if (scanTimer) clearInterval(scanTimer);
      scanTimer = null;
      stopLiveRefresh();
      // Stop the backend walk too — clearing the timer only ever hid the
      // browser simulation, leaving a real scan running to completion.
      void cancelScanCmd().catch(console.error);
      // `libState` is left alone: whatever the library was showing is still
      // what it holds. A cancelled first scan goes back to the empty state on
      // its own, because nothing was ever indexed.
      set({ scanning: false });
    },
    retryError: () => {
      set({ scanError: null });
      // In the browser there is no backend, so replay the simulated scan.
      if (isTauri()) {
        const retry = lastFailedAction;
        lastFailedAction = null;
        if (retry) retry();
        else void get().hydrate();
        return;
      }
      get().startScan();
    },
    hydrate: async () => {
      if (!isTauri()) return;
      // Belt and braces: `MOCK` is decided at module-eval time. If that ever ran
      // before Tauri injected its globals, drop the seed before the real
      // catalogue lands so demo rows can never reach the screen.
      if (MOCK) set({ tracks: [], folders: [], playlists: [], plOrder: {}, queue: [], playerId: "", curPlaylist: "", posSec: 0 });
      try {
        const snap = await getLibrary();
        if (snap) {
          applySnapshot(snap);
          set({ libState: snap.tracks.length ? "content" : "empty", scanError: null });
        }
        // Restore saved preferences.
        // `openExt` ya no se lee. La fila que dejó en `settings` una
        // instalación anterior se queda ahí sin hacer nada: borrarla sería
        // tocar datos del usuario para ganar nada, y si el ajuste volviera
        // alguna vez, volvería con su valor.
        const [modeS, themeS, uiS] = await Promise.all([
          getSetting("themeMode"),
          getSetting("theme"),
          getSetting(UI_PREFS_KEY),
        ]);
        const patch: Partial<CantoralState> = {};
        const mode: ThemeMode | null =
          modeS === "light" || modeS === "dark" || modeS === "system"
            ? modeS
            : themeS === "light" || themeS === "dark"
              ? themeS // migrate legacy "theme" setting
              : null;
        if (mode) {
          patch.themeMode = mode;
          patch.theme = resolveTheme(mode);
        }
        // The rest of the interface: volume, transport, sorting, grouping and
        // where the user was. Only the fields that survived validation, over
        // whatever the defaults are, and settled against the lists that exist.
        const prefs = parsePrefs(uiS);
        Object.assign(patch, prefs, resolveView(prefs, snap?.playlists ?? get().playlists));
        if (Object.keys(patch).length) {
          set(patch);
          // Nothing read at startup is worth writing back, and `applySnapshot`
          // ran a moment ago and may already have queued a write of a
          // `curPlaylist` it picked on its own. What was just restored is the
          // newer truth, so whatever is queued goes.
          if (prefsTimer) {
            clearTimeout(prefsTimer);
            prefsTimer = null;
          }
        }

        // Callada y sin bloquear: si hay algo, aparece en Configuración; si no,
        // nadie se entera. Una app que interrumpe al abrirse para decir que no
        // pasa nada es una app que se aprende a ignorar.
        void get().checkForUpdate();

        // Files can disappear while the app is closed; re-check them once the
        // catalogue is on screen rather than blocking the first paint.
        void reconcileLibraryCmd()
          .then((fresh) => {
            if (fresh) applySnapshot(fresh);
          })
          .catch((err) => console.error("reconcile failed", err));
      } catch (err) {
        console.error("hydrate failed", err);
        lastFailedAction = () => void get().hydrate();
        set({ libState: "error", scanError: String(err) });
      }
    },

    // ---------- collections ----------
    playAll: () => {
      const ord = get().plOrder[get().curPlaylist] || [];
      if (ord.length) {
        get().play(ord[0], ord.slice());
        toast("Reproduciendo la lista completa");
      }
    },
    exportPl: () => {
      const s = get();
      const pl = s.playlists.find((p) => p.id === s.curPlaylist);
      const ord = s.plOrder[s.curPlaylist] || [];
      const rows = ord
        .map((id) => s.tracks.find((t) => t.id === id))
        .filter((t): t is Track => !!t);
      if (!pl || rows.length === 0) {
        toast("La lista está vacía");
        return;
      }
      // The sheets are not part of the catalogue, so they are fetched for this
      // list before the page is built. Whoever prints this is the person who
      // wanted the lyrics on paper.
      void get()
        .loadSheets(ord)
        .then(() => escribirHoja(pl, rows, ord))
        .catch((err) => {
          console.error("could not read the lyrics for the export", err);
          // The table is still worth printing without them.
          escribirHoja(pl, rows, ord);
        });
    },
    openPrintPreview: () => {
      const s = get();
      const ord = s.plOrder[s.curPlaylist] || [];
      const hay = ord.some((id) => s.tracks.some((t) => t.id === id));
      if (!s.playlists.some((p) => p.id === s.curPlaylist) || !hay) {
        toast("La lista está vacía");
        return;
      }
      // Open first, fetch after: the table is the whole sheet for a list with
      // nothing written, and waiting on a round trip to show it would make the
      // button feel broken.
      set({ dialog: "printPreview" });
      // `loadSheets` answers for its own failure — it logs and tells the user —
      // and never rejects, so there is nothing here to catch. The preview stays
      // open either way: the table is what whoever leads the service reads.
      void get().loadSheets(ord);
    },
    setPrintWithLyrics: (con) => set({ printWithLyrics: con }),
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
          toast("Esta compilación no trae actualizaciones automáticas", "info");
        }
      } catch (err) {
        console.error("update check failed", err);
        set({ updateState: "error", updateError: String(err) });
        if (manual) toast("No se pudo comprobar si hay actualizaciones", "error");
      }
    },
    installUpdate: () => {
      const s = get();
      if (s.update?.estado !== "disponible" || s.updateState === "downloading") return;
      set({ updateState: "downloading", updateProgress: { descargado: 0, total: null }, updateError: null });
      void onUpdateProgress((updateProgress) => set({ updateProgress })).then((parar) => {
        pararProgreso = parar;
      });
      installUpdateCmd()
        // No hay `then`: si funciona, la app se reinicia y nada de esto sigue vivo.
        .catch((err) => {
          console.error("update install failed", err);
          pararProgreso?.();
          pararProgreso = null;
          set({ updateState: "error", updateError: String(err), updateProgress: null });
          toast("No se pudo instalar la actualización", "error");
        });
    },
    newList: () => set({ dialog: "newList" }),
    createList: (nombre, fecha, ocasion, desde) => {
      set({ dialog: null });
      const name = nombre.trim() || "Lista sin título";
      if (isTauri()) {
        createPlaylistCmd(name, fecha, ocasion, desde)
          .then(async (id) => {
            const snap = await getLibrary();
            if (snap) applySnapshot(snap);
            set({ view: "lista", curPlaylist: id });
            toast(desde ? "Lista creada desde la plantilla" : "Lista creada");
          })
          .catch((err) => {
            console.error(err);
            toast("No se pudo crear la lista", "error");
          });
      } else {
        const id = "new-" + Date.now();
        const base = desde ? get().plOrder[desde] ?? [] : [];
        const ids = base.slice();
        const pl: Playlist = { id, nombre: name, fecha, ocasion, ids, plantilla: false };
        set((s) => ({
          playlists: [...s.playlists, pl],
          plOrder: { ...s.plOrder, [id]: ids },
          view: "lista",
          curPlaylist: id,
        }));
        toast(desde ? "Lista creada desde la plantilla" : "Lista creada");
      }
    },
    duplicateList: (id) => {
      const st = get();
      const pl = st.playlists.find((p) => p.id === id);
      if (!pl) return;
      if (isTauri()) {
        duplicatePlaylistCmd(id)
          .then(async (nuevo) => {
            const snap = await getLibrary();
            if (snap) applySnapshot(snap);
            set({ view: "lista", curPlaylist: nuevo });
            toast("Lista duplicada");
          })
          .catch((err) => {
            console.error(err);
            toast("No se pudo duplicar la lista", "error");
          });
      } else {
        const nuevo = "copy-" + Date.now();
        const ids = (st.plOrder[id] ?? pl.ids).slice();
        const copia: Playlist = {
          id: nuevo,
          nombre: nombreDeCopia(pl.nombre, st.playlists.map((p) => p.nombre)),
          // No date: a copy is the *next* service, not the one it came from.
          fecha: "",
          ocasion: pl.ocasion,
          ids,
          plantilla: false,
        };
        set((s) => ({
          playlists: [...s.playlists, copia],
          plOrder: { ...s.plOrder, [nuevo]: ids },
          view: "lista",
          curPlaylist: nuevo,
        }));
        toast("Lista duplicada");
      }
    },
    duplicateCurrentList: () => get().duplicateList(get().curPlaylist),
    shareCurrentList: () => {
      const s = get();
      const pl = s.playlists.find((p) => p.id === s.curPlaylist);
      const rows = (s.plOrder[s.curPlaylist] || [])
        .map((id) => s.tracks.find((t) => t.id === id))
        .filter((t): t is Track => !!t);
      if (!pl) return;
      if (rows.length === 0) {
        toast("La lista está vacía");
        return;
      }
      const json = JSON.stringify(armarArchivo(pl, rows), null, 2);
      const name = nombreDeArchivo(pl.nombre);
      if (!isTauri()) {
        // Browser fallback, so the whole round trip is testable with `pnpm dev`.
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        toast("Lista exportada para otra instalación");
        return;
      }
      void pickShareExportPath(name).then((dest) => {
        if (!dest) return;
        exportPlaylistJsonCmd(dest, json)
          .then(() => toast("Lista exportada para otra instalación"))
          .catch((err) => {
            console.error(err);
            toast("No se pudo exportar la lista", "error");
          });
      });
    },
    importList: () => {
      // Read and match before anything is created: the screen that follows is
      // the whole point, and it cannot say «faltan dos» after the fact.
      const mostrar = (archivo: ArchivoDeLista) => {
        const resultado = emparejar(archivo.pistas, get().tracks);
        set({ importPreview: { archivo, resultado }, dialog: "importList" });
      };
      if (!isTauri()) {
        void leerArchivoDelNavegador()
          .then((archivo) => {
            if (archivo) mostrar(archivo);
          })
          .catch((err) => {
            console.error(err);
            toast(String(err), "error");
          });
        return;
      }
      void pickPlaylistFile().then(async (src) => {
        if (!src) return;
        try {
          mostrar(await readPlaylistFileCmd(src));
        } catch (err) {
          console.error(err);
          toast(String(err), "error");
        }
      });
    },
    confirmImport: () => {
      const previo = get().importPreview;
      if (!previo) return;
      const ids = idsParaLaLista(previo.resultado.encontradas);
      if (ids.length === 0) return;
      const { nombre, fecha, ocasion } = previo.archivo.lista;
      set({ dialog: null, importPreview: null });
      const aviso = () => {
        const faltan = previo.resultado.faltantes.length;
        toast(
          faltan === 0
            ? "Lista importada"
            : `Lista importada · ${faltan} ${faltan === 1 ? "pista no está" : "pistas no están"} en esta biblioteca`,
          faltan === 0 ? "success" : "info",
        );
      };
      if (isTauri()) {
        createPlaylistCmd(nombre, fecha, ocasion)
          .then(async (id) => {
            await setPlaylistOrderCmd(id, ids);
            const snap = await getLibrary();
            if (snap) applySnapshot(snap);
            set({ view: "lista", curPlaylist: id });
            aviso();
          })
          .catch((err) => {
            console.error(err);
            toast("No se pudo importar la lista", "error");
          });
      } else {
        const id = "imp-" + Date.now();
        const pl: Playlist = { id, nombre, fecha, ocasion, ids, plantilla: false };
        set((st) => ({
          playlists: [...st.playlists, pl],
          plOrder: { ...st.plOrder, [id]: ids },
          view: "lista",
          curPlaylist: id,
        }));
        aviso();
      }
    },
    toggleCurrentTemplate: () => {
      const st = get();
      const id = st.curPlaylist;
      const pl = st.playlists.find((p) => p.id === id);
      if (!pl) return;
      const plantilla = !pl.plantilla;
      const aviso = plantilla ? "Guardada como plantilla" : "Ya no es una plantilla";
      if (isTauri()) {
        setPlaylistTemplateCmd(id, plantilla)
          .then((snap) => {
            applySnapshot(snap);
            toast(aviso);
          })
          .catch((err) => {
            console.error(err);
            toast("No se pudo cambiar la plantilla", "error");
          });
      } else {
        set((s) => ({
          playlists: s.playlists.map((p) => (p.id === id ? { ...p, plantilla } : p)),
        }));
        toast(aviso);
      }
    },
    editCurrentList: () => set({ dialog: "editList" }),
    updateList: (nombre, fecha, ocasion) => {
      const id = get().curPlaylist;
      const name = nombre.trim() || "Lista sin título";
      set({ dialog: null });
      if (isTauri()) {
        updatePlaylistCmd(id, name, fecha, ocasion)
          .then((snap) => {
            applySnapshot(snap);
            toast("Lista actualizada");
          })
          .catch((err) => {
            console.error(err);
            toast("No se pudo actualizar la lista", "error");
          });
      } else {
        set((st) => ({
          playlists: st.playlists.map((p) =>
            p.id === id ? { ...p, nombre: name, fecha, ocasion } : p,
          ),
        }));
        toast("Lista actualizada");
      }
    },
    deleteCurrentList: () => {
      const st = get();
      const id = st.curPlaylist;
      const pl = st.playlists.find((p) => p.id === id);
      if (!pl) return;
      const n = (st.plOrder[id] || []).length;
      st.askConfirm({
        title: "¿Eliminar esta lista?",
        message: `«${pl.nombre}» se borrará de las listas para cultos.`,
        detail:
          n > 0
            ? `La lista tiene ${n} ${n === 1 ? "pista" : "pistas"} en su orden de culto. Ese orden se pierde y no se puede deshacer.`
            : "La lista está vacía.",
        safe: "Las pistas siguen en tu biblioteca; solo se borra la lista.",
        confirmLabel: "Eliminar lista",
        onConfirm: () => {
          if (isTauri()) {
            deletePlaylistCmd(id)
              .then((snap) => {
                applySnapshot(snap);
                set({ view: "colecciones" });
                toast("Lista eliminada");
              })
              .catch((err) => {
                console.error(err);
                toast("No se pudo eliminar la lista", "error");
              });
          } else {
            set((s) => {
              const playlists = s.playlists.filter((p) => p.id !== id);
              const plOrder = { ...s.plOrder };
              delete plOrder[id];
              return { playlists, plOrder, view: "colecciones", curPlaylist: playlists[0]?.id || s.curPlaylist };
            });
            toast("Lista eliminada");
          }
        },
      });
    },
    removeFromPl: (id) => {
      const cur2 = get().curPlaylist;
      const prev = get().plOrder[cur2] || [];
      const next = prev.filter((x) => x !== id);
      saveOrder(cur2, next, prev);
      toast("Quitada de la lista");
    },
    setDragging: (id) => {
      dragId = id;
      set({ draggingId: id });
    },
    setOver: (id) => set((s) => (id !== s.overId ? { overId: id } : {})),
    reorderPl: (toId) => {
      const from = dragId;
      const cur2 = get().curPlaylist;
      if (from && toId && from !== toId) {
        const arr = (get().plOrder[cur2] || []).slice();
        const fi = arr.indexOf(from);
        const ti = arr.indexOf(toId);
        if (fi > -1 && ti > -1) {
          const prev = (get().plOrder[cur2] || []).slice();
          arr.splice(fi, 1);
          arr.splice(ti, 0, from);
          saveOrder(cur2, arr, prev);
        }
      }
      set({ draggingId: null, overId: null });
      dragId = null;
    },
    moveInPlaylist: (id, delta) => {
      const pid = get().curPlaylist;
      const prev = (get().plOrder[pid] || []).slice();
      const desde = prev.indexOf(id);
      const hasta = desde + delta;
      // Silently at the ends: the buttons are disabled there, and a keypress
      // that cannot move anything should do nothing rather than wrap around.
      if (desde < 0 || hasta < 0 || hasta >= prev.length) return;
      const next = prev.slice();
      next.splice(desde, 1);
      next.splice(hasta, 0, id);
      saveOrder(pid, next, prev);
      const titulo = get().tracks.find((t) => t.id === id)?.titulo ?? "La pista";
      set({ reorderNotice: `«${titulo}», posición ${hasta + 1} de ${next.length}` });
    },
    clearDrag: () => {
      set({ draggingId: null, overId: null });
      dragId = null;
    },

    // ---------- config ----------
    revealTrack: (id) => {
      const t = get().tracks.find((x) => x.id === id);
      if (!t?.path) return;
      if (!isTauri()) {
        toast("Mostrar el archivo solo funciona en la app de escritorio", "info");
        return;
      }
      revealFile(t.path).catch((err) => {
        console.error("revealItemInDir failed", err);
        toast("No se pudo mostrar el archivo", "error");
      });
    },
    relocateTrack: (id) => {
      const t = get().tracks.find((x) => x.id === id);
      if (!t) return;
      if (!isTauri()) {
        toast("Localizar archivos solo funciona en la app de escritorio", "info");
        return;
      }
      void pickMediaFile().then((path) => {
        if (!path) return;
        relocateTrackCmd(id, path)
          .then((snap) => {
            applySnapshot(snap);
            toast(`«${t.titulo}» vuelve a estar localizada`);
          })
          .catch((err) => {
            console.error(err);
            toast(String(err), "error");
          });
      });
    },
    deleteTrack: (id) => {
      const st = get();
      const t = st.tracks.find((x) => x.id === id);
      if (!t) return;
      const listas = st.playlists.filter((p) => (st.plOrder[p.id] || []).includes(id));
      st.askConfirm({
        title: "¿Quitar esta pista de la biblioteca?",
        message: `«${t.titulo}» dejará de aparecer en el catálogo.`,
        detail:
          `Se pierden sus etiquetas, favorito, tono, tempo y ocasión.` +
          (listas.length
            ? ` También sale de ${listas.length === 1 ? "la lista" : "las listas"} ${listas
                .map((p) => `«${p.nombre}»`)
                .join(", ")}.`
            : ""),
        safe: "El archivo de audio no se borra: solo deja de estar indexado.",
        confirmLabel: "Quitar de la biblioteca",
        onConfirm: () => {
          if (!isTauri()) {
            set((s) => ({ tracks: s.tracks.filter((x) => x.id !== id) }));
            toast("Pista quitada de la biblioteca");
            return;
          }
          deleteTrackCmd(id)
            .then((snap) => {
              applySnapshot(snap);
              set({ detailOpen: false, selId: null });
              toast("Pista quitada de la biblioteca");
            })
            .catch((err) => {
              console.error(err);
              toast("No se pudo quitar la pista", "error");
            });
        },
      });
    },
    relocateFolder: (id) => {
      const f = get().folders.find((x) => x.id === id);
      if (!f) return;
      if (!isTauri()) {
        toast("Mover carpetas solo funciona en la app de escritorio", "info");
        return;
      }
      void pickFolder().then((path) => {
        if (!path) return;
        relocateFolderCmd(id, path)
          .then((snap) => {
            applySnapshot(snap);
            toast(`«${f.nombre}» ahora apunta a su nueva ubicación`);
          })
          .catch((err) => {
            console.error(err);
            toast(String(err), "error");
          });
      });
    },
    removeFolder: (id) => {
      const f = get().folders.find((x) => x.id === id);
      if (!f) return;
      const n = f.count;
      get().askConfirm({
        title: "¿Quitar esta carpeta?",
        message: `«${f.nombre}» dejará de estar indexada.`,
        detail:
          n > 0
            ? `Se borrarán ${n} ${n === 1 ? "pista" : "pistas"} de la biblioteca, junto con sus etiquetas, favoritos, tono y ocasión. Eso no se puede deshacer.`
            : "La carpeta no tiene pistas indexadas.",
        safe: "Tus archivos de audio no se tocan: siguen donde están.",
        confirmLabel: "Quitar carpeta",
        onConfirm: () => {
          if (isTauri()) {
            removeFolderCmd(id)
              .then(applySnapshot)
              .then(() => toast("Carpeta quitada de la biblioteca"))
              .catch((err) => {
                console.error(err);
                toast("No se pudo quitar la carpeta", "error");
              });
          } else {
            set((s) => ({ folders: s.folders.filter((x) => x.id !== id) }));
            toast("Carpeta quitada de la biblioteca");
          }
        },
      });
    },
    rescanFolder: (id) => {
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", "info");
        return;
      }
      if (isTauri() && id) {
        // No `view` here on purpose. A re-scan is started from Configuración,
        // and yanking the user out of the screen they are working on is the
        // whole complaint this change exists to fix.
        set({ scanning: true, scanPct: 0, scanIdx: 0, scanFile: "", scanOmitidos: 0, tarjetaEscaneoOculta: false });
        startLiveRefresh();
        rescanFolderCmd(id)
          .then((snap) => {
            applySnapshot(snap);
            set({ scanning: false, libState: snap.tracks.length ? "content" : "empty", scanPct: 100 });
            toast(`Biblioteca actualizada${avisoDeOmitidos(get().scanOmitidos)}`);
          })
          .catch((err) => {
            console.error(err);
            lastFailedAction = () => get().rescanFolder(id);
            set({ scanning: false, libState: "error", scanError: String(err) });
          })
          .finally(stopLiveRefresh);
      } else {
        get().startScan();
      }
    },
    backup: () => {
      if (isTauri()) {
        void pickSavePath().then((dest) => {
          if (dest) void backupDatabase(dest).then(() => toast("Copia de seguridad creada correctamente")).catch(console.error);
        });
      } else {
        toast("Copia de seguridad creada correctamente");
      }
    },
    restore: () => {
      if (!isTauri()) {
        toast("Selecciona un archivo de respaldo…", "info");
        return;
      }
      void pickDbFile().then(async (src) => {
        if (!src) return;
        // Read the backup before asking anything: a file that is not a Cantoral
        // database is rejected here, so the question is never even posed.
        let info;
        try {
          info = await inspectBackup(src);
        } catch (err) {
          console.error(err);
          toast(String(err), "error");
          return;
        }
        const st = get();
        const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
        get().askConfirm({
          title: "¿Restaurar este respaldo?",
          message: "Tu biblioteca actual se reemplaza por completo con la del respaldo.",
          detail:
            `Ahora: ${plural(st.tracks.length, "pista", "pistas")}, ` +
            `${plural(st.folders.length, "carpeta", "carpetas")} y ` +
            `${plural(st.playlists.length, "lista", "listas")}.\n` +
            `Respaldo: ${plural(info.tracks, "pista", "pistas")}, ` +
            `${plural(info.folders, "carpeta", "carpetas")} y ` +
            `${plural(info.playlists, "lista", "listas")}.`,
          safe: "Tus archivos de audio no se tocan. Si la restauración falla, la biblioteca actual vuelve intacta.",
          confirmLabel: "Restaurar",
          onConfirm: () => {
            restoreDatabaseCmd(src)
              .then((snap) => {
                applySnapshot(snap);
                set({ libState: snap.tracks.length ? "content" : "empty", scanError: null });
                toast("Base de datos restaurada");
              })
              .catch((err) => {
                console.error(err);
                toast("No se pudo restaurar la base de datos", "error");
              });
          },
        });
      });
    },

    // ---------- player tick / toast ----------
    tick: () => {
      const s = get();
      if (!s.playing) return;
      const t = cur(s);
      if (!t) return;
      // When a real audio file is loaded (Tauri), the <audio> element drives
      // posSec via timeupdate — the simulated timer only runs in the browser.
      if (isTauri() && t.path && !t.video && !t.missing) return;
      const p = s.posSec + 1;
      if (p >= t.durSec) get().advance();
      else set({ posSec: p });
    },
    // ---------- lyrics and chords ----------
    loadSheet: (id) => {
      if (get().sheets[id]) return;
      if (!isTauri()) {
        const semilla = SEED_SHEETS[id];
        set((st) => ({
          sheets: { ...st.sheets, [id]: semilla ?? { trackId: id, letra: "", acordes: "" } },
        }));
        return;
      }
      getTrackSheet(id)
        .then((hoja) => {
          if (hoja) set((st) => ({ sheets: { ...st.sheets, [id]: hoja } }));
        })
        .catch((err) => {
          console.error("get_track_sheet failed", err);
          toast("No se pudo leer la letra de esta pista", "error");
        });
    },

    loadSheets: async (ids) => {
      const faltan = ids.filter((id) => !get().sheets[id]);
      if (faltan.length === 0) return;
      // Tracks with nothing written do not come back, so they are seeded empty
      // here — otherwise every view of them would ask again.
      const vacias = Object.fromEntries(
        faltan.map((id) => [id, { trackId: id, letra: "", acordes: "" }] as const),
      );
      if (!isTauri()) {
        const deSemilla = Object.fromEntries(
          faltan.filter((id) => SEED_SHEETS[id]).map((id) => [id, SEED_SHEETS[id]] as const),
        );
        set((st) => ({ sheets: { ...st.sheets, ...vacias, ...deSemilla } }));
        return;
      }
      try {
        const hojas = await getSheets(faltan);
        const traidas = Object.fromEntries((hojas ?? []).map((h) => [h.trackId, h] as const));
        set((st) => ({ sheets: { ...st.sheets, ...vacias, ...traidas } }));
      } catch (err) {
        console.error("get_sheets failed", err);
        toast("No se pudieron leer las letras de esta lista", "error");
      }
    },

    openSheetEditor: (id) => {
      get().loadSheet(id);
      set({ sheetDialog: id, sheetState: "idle" });
    },

    closeSheetEditor: () => {
      writePendingSheet();
      set({ sheetDialog: null });
    },

    setSheet: (campo, valor) => {
      const id = get().sheetDialog;
      if (!id) return;
      const actual = get().sheets[id] ?? { trackId: id, letra: "", acordes: "" };
      const siguiente = { ...actual, [campo]: valor };
      set((st) => ({
        sheets: { ...st.sheets, [id]: siguiente },
        // The catalogue only carries whether there is a sheet, so it is kept in
        // step here rather than waiting for the next snapshot.
        tracks: st.tracks.map((t) =>
          t.id === id
            ? { ...t, tieneHoja: !!(siguiente.letra.trim() || siguiente.acordes.trim()) }
            : t,
        ),
        sheetState: "saving",
      }));
      scheduleSheetSave(id);
    },

    flushSheet: () => writePendingSheet(),

    // ---------- service view ----------
    openService: () => {
      const ids = get().plOrder[get().curPlaylist] || [];
      if (ids.length === 0) {
        toast("Esta lista está vacía", "info");
        return;
      }
      void get().loadSheets(ids);
      // Starts on whatever is playing if it belongs to this list, so opening
      // the view mid-song lands on the song.
      const enCurso = ids.indexOf(get().playerId);
      set({
        serviceOpen: true,
        serviceIdx: enCurso >= 0 ? enCurso : 0,
        serviceSemitones: 0,
      });
    },

    closeService: () => set({ serviceOpen: false }),

    serviceGo: (delta) => {
      const ids = get().plOrder[get().curPlaylist] || [];
      if (ids.length === 0) return;
      const siguiente = Math.min(ids.length - 1, Math.max(0, get().serviceIdx + delta));
      // Moving to another song drops the transposition: it belonged to the one
      // being left, and carrying it over would silently put the next song in a
      // key nobody asked for.
      set({ serviceIdx: siguiente, serviceSemitones: 0 });
    },

    transposeService: (delta) =>
      set((st) => ({ serviceSemitones: Math.max(-11, Math.min(11, st.serviceSemitones + delta)) })),

    scaleService: (delta) =>
      set((st) => ({ serviceScale: Math.max(0.7, Math.min(2.4, +(st.serviceScale + delta).toFixed(2))) })),

    // ---------- tags ----------
    renameTag: (from, to) => {
      const nombre = normalizarEtiqueta(to);
      if (!nombre || nombre === from) return;
      const fusion = etiquetas(get()).some((e) => e.nombre !== from && e.nombre === nombre);
      const aplicar = () => {
        // The filter follows the rename, or it would be pinned to a tag that
        // no longer exists and quietly show nothing.
        set((st) => ({ tagFilter: st.tagFilter.map((t) => (t === from ? nombre : t)) }));
        if (!isTauri()) {
          set((st) => ({
            tracks: st.tracks.map((t) => {
              const tags = t.tags || [];
              if (!tags.includes(from)) return t;
              return { ...t, tags: [...new Set(tags.map((x) => (x === from ? nombre : x)))].sort() };
            }),
          }));
          toast(fusion ? `«${from}» se unió a «${nombre}»` : "Etiqueta renombrada");
          return;
        }
        renameTagCmd(from, nombre)
          .then((snap) => {
            if (snap) applySnapshot(snap);
            toast(fusion ? `«${from}» se unió a «${nombre}»` : "Etiqueta renombrada");
          })
          .catch((err) => {
            console.error("rename_tag failed", err);
            toast(String(err), "error");
          });
      };

      if (!fusion) {
        aplicar();
        return;
      }
      // Folding two tags together cannot be undone by renaming back, so it is
      // asked rather than assumed.
      const cuantas = etiquetas(get()).find((e) => e.nombre === from)?.cuenta ?? 0;
      get().askConfirm({
        title: "¿Unir las dos etiquetas?",
        message: `Ya existe una etiqueta «${nombre}». Las pistas de «${from}» pasarán a ella y «${from}» desaparecerá.`,
        detail: `${cuantas} ${cuantas === 1 ? "pista lleva" : "pistas llevan"} «${from}».`,
        safe: "Ninguna pista sale de la biblioteca; solo cambia la etiqueta.",
        confirmLabel: "Unir",
        onConfirm: aplicar,
      });
    },

    deleteTag: (name) => {
      const cuantas = etiquetas(get()).find((e) => e.nombre === name)?.cuenta ?? 0;
      get().askConfirm({
        title: "¿Quitar esta etiqueta?",
        message: `«${name}» se quitará de todas las pistas que la llevan.`,
        detail: `${cuantas} ${cuantas === 1 ? "pista la lleva" : "pistas la llevan"}.`,
        safe: "Las pistas se quedan en la biblioteca con el resto de sus etiquetas.",
        confirmLabel: "Quitar etiqueta",
        onConfirm: () => {
          set((st) => ({ tagFilter: st.tagFilter.filter((t) => t !== name) }));
          if (!isTauri()) {
            set((st) => ({
              tracks: st.tracks.map((t) =>
                (t.tags || []).includes(name) ? { ...t, tags: (t.tags || []).filter((x) => x !== name) } : t,
              ),
            }));
            toast("Etiqueta quitada");
            return;
          }
          deleteTagCmd(name)
            .then((snap) => {
              if (snap) applySnapshot(snap);
              toast("Etiqueta quitada");
            })
            .catch((err) => {
              console.error("delete_tag failed", err);
              toast(String(err), "error");
            });
        },
      });
    },

    // ---------- duplicates ----------
    findDuplicates: () => {
      set({ duplicatesState: "buscando" });
      if (!isTauri()) {
        // Fixture, not a search: the real grouping reads file sizes and lengths
        // the browser mock does not have.
        set({ duplicates: seedDuplicates(), duplicatesDismissed: 0, duplicatesState: "listo" });
        return;
      }
      findDuplicatesCmd()
        .then((r) => {
          if (r) set({ duplicates: r.groups, duplicatesDismissed: r.dismissed, duplicatesState: "listo" });
        })
        .catch((err) => {
          console.error("find_duplicates failed", err);
          set({ duplicatesState: "idle" });
          toast(String(err), "error");
        });
    },

    mergeDuplicates: (signature, keepId) => {
      const grupo = get().duplicates.find((g) => g.signature === signature);
      const queda = grupo?.tracks.find((t) => t.id === keepId);
      if (!grupo || !queda) return;
      const copias = grupo.tracks.filter((t) => t.id !== keepId);
      if (copias.length === 0) return;

      get().askConfirm({
        title: "¿Fusionar estas copias?",
        message: `Se queda «${queda.titulo}» (${queda.formato}, ${queda.carpeta}). Las demás salen de la biblioteca.`,
        detail: copias.map((c) => `${c.formato} · ${c.carpeta}\n${c.path}`).join("\n\n"),
        safe:
          "Sus etiquetas, su favorito y su sitio en las listas para culto pasan a la que se queda. " +
          "Los archivos de audio no se borran del disco.",
        confirmLabel: "Fusionar",
        onConfirm: () => {
          const ids = copias.map((c) => c.id);
          if (!isTauri()) {
            // Browser stand-in: the same visible outcome, none of the SQL.
            set((st) => {
              const fuera = new Set(ids);
              const etiquetas = new Set<string>();
              let fav = false;
              st.tracks.forEach((t) => {
                if (t.id === keepId || fuera.has(t.id)) {
                  (t.tags || []).forEach((x) => etiquetas.add(x));
                  fav = fav || t.fav;
                }
              });
              // Lists follow the survivor, and a list that held two copies
              // ends up with the song once, not twice.
              const plOrder: Record<string, string[]> = {};
              Object.entries(st.plOrder).forEach(([pid, orden]) => {
                const visto = new Set<string>();
                const nuevo: string[] = [];
                orden.forEach((id) => {
                  const destino = fuera.has(id) ? keepId : id;
                  if (visto.has(destino)) return;
                  visto.add(destino);
                  nuevo.push(destino);
                });
                plOrder[pid] = nuevo;
              });
              return {
                tracks: st.tracks
                  .filter((t) => !fuera.has(t.id))
                  .map((t) => (t.id === keepId ? { ...t, tags: [...etiquetas].sort(), fav } : t)),
                plOrder,
                duplicates: st.duplicates.filter((g) => g.signature !== signature),
              };
            });
            toast(ids.length === 1 ? "1 copia fusionada" : `${ids.length} copias fusionadas`);
            return;
          }
          mergeDuplicatesCmd(keepId, ids)
            .then((snap) => {
              if (snap) applySnapshot(snap);
              toast(ids.length === 1 ? "1 copia fusionada" : `${ids.length} copias fusionadas`);
              // `applySnapshot` cleared the list; fill it with what is left.
              get().findDuplicates();
            })
            .catch((err) => {
              console.error("merge_duplicates failed", err);
              toast(String(err), "error");
            });
        },
      });
    },

    dismissDuplicates: (signature) => {
      if (!isTauri()) {
        set((st) => ({
          duplicates: st.duplicates.filter((g) => g.signature !== signature),
          duplicatesDismissed: st.duplicatesDismissed + 1,
        }));
        return;
      }
      dismissDuplicatesCmd(signature)
        .then((r) => {
          if (r) set({ duplicates: r.groups, duplicatesDismissed: r.dismissed });
        })
        .catch((err) => {
          console.error("dismiss_duplicates failed", err);
          toast(String(err), "error");
        });
    },

    restoreDismissedDuplicates: () => {
      if (!isTauri()) {
        set({ duplicates: seedDuplicates(), duplicatesDismissed: 0 });
        return;
      }
      restoreDismissedDuplicatesCmd()
        .then((r) => {
          if (r) set({ duplicates: r.groups, duplicatesDismissed: r.dismissed });
        })
        .catch((err) => {
          console.error("restore_dismissed_duplicates failed", err);
          toast(String(err), "error");
        });
    },

    askConfirm: (req) => set({ confirm: req }),
    closeConfirm: () => set({ confirm: null }),
    acceptConfirm: () => {
      const req = get().confirm;
      set({ confirm: null });
      req?.onConfirm();
    },

    showToast: (m, type = "success") => {
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: { message: m, type } });
      toastTimer = setTimeout(() => set({ toast: null }), type === "error" ? 4000 : 2200);
    },
  };
});

// ============================================================
// Writing the interface preferences back
// ============================================================

/** How long a change waits before it is written. */
const PREFS_MS = 400;

function writePrefs() {
  if (prefsTimer) clearTimeout(prefsTimer);
  prefsTimer = null;
  void setSetting(UI_PREFS_KEY, serialisePrefs(useStore.getState())).catch((err) =>
    console.error("could not save the interface preferences", err),
  );
}

function schedulePrefsSave() {
  if (prefsTimer) clearTimeout(prefsTimer);
  prefsTimer = setTimeout(writePrefs, PREFS_MS);
}

/**
 * Write a preference that is still waiting out the debounce, right now.
 *
 * Lowering the volume and closing the window is the exact sequence the whole
 * feature exists for, so it must not be the one that gets lost.
 */
export function flushUiPrefs() {
  if (prefsTimer) writePrefs();
}

/**
 * Watch the preferences instead of saving from each action that changes one.
 *
 * Nine fields are reached from a dozen places — a dragged volume bar, a clicked
 * column header, a list opened from the sidebar — and a save hung off each one
 * is a save that gets forgotten the next time somebody adds a tenth. This sees
 * the change wherever it came from.
 */
if (isTauri()) {
  useStore.subscribe((s, previo) => {
    if (PREF_FIELDS.every((campo) => s[campo] === previo[campo])) return;
    schedulePrefsSave();
  });
}

// ============================================================
// Derived selectors (pure) — used by components against a state snapshot.
// ============================================================

/**
 * Wrap a pure selector so it only recomputes when what it reads changes.
 *
 * The library is filtered, sorted and grouped by more than one component on
 * every render, while the player writes `posSec` several times a second — so
 * without this the whole catalogue is walked a few dozen times a second to
 * produce a result that did not change. Keeping the previous result also keeps
 * its **identity**, which is what lets `useStore(applyFilters)` skip a render
 * instead of handing React a new array that merely looks the same.
 *
 * One entry is enough: every call inside a render pass reads the same
 * snapshot, and a snapshot that has been replaced is never read again.
 *
 * The cached value is shared between callers, so treat it as read-only.
 */
function recordar<A extends unknown[], T>(
  calcular: (...args: A) => T,
  leer: (...args: A) => unknown[],
): (...args: A) => T {
  let deps: unknown[] | null = null;
  let valor!: T;
  return (...args: A): T => {
    const ahora = leer(...args);
    if (deps && deps.length === ahora.length && deps.every((d, i) => Object.is(d, ahora[i]))) return valor;
    deps = ahora;
    valor = calcular(...args);
    return valor;
  };
}

/**
 * Whether the scan takes over the library view instead of a corner card.
 *
 * Only for a scan that has nothing behind it: a first scan of an empty
 * library, where a corner card would float over a blank screen. The moment
 * there is a catalogue to show — even one the running scan is still filling —
 * the table wins and the scan moves to the corner.
 *
 * Shared by the view and the card so the two can never both decide they are
 * the one showing the progress.
 */
export function escaneoAPantallaCompleta(s: CantoralState): boolean {
  return s.scanning && s.libState === "empty" && s.view === "biblioteca";
}

/** Currently loaded player track. */
export function cur(s: CantoralState): Track | null {
  return s.tracks.find((x) => x.id === s.playerId) ?? null;
}

/**
 * Occasions actually present in the catalogue, for the filter chips.
 *
 * Derived rather than hardcoded so a custom occasion shows up as a filter as
 * soon as a track carries it — the detail panel writes occasions straight into
 * the catalogue, so there is no half-saved state to reason about here.
 */
export const ocasiones = recordar(
  (s: CantoralState): string[] => {
    const found = new Set<string>();
    s.tracks.forEach((t) => {
      const o = t.ocasion?.trim();
      if (o) found.add(o);
    });
    // Keep the active filter listed even if its last track just changed occasion,
    // otherwise its chip vanishes and the filter can no longer be switched off.
    if (s.ocasion) found.add(s.ocasion);
    return [...found].sort((a, b) => a.localeCompare(b, "es"));
  },
  (s: CantoralState) => [s.tracks, s.ocasion],
);

/**
 * Tracks of the open culto list, in its order, skipping ids whose track is gone.
 *
 * Remembered like the others: the view reads it on every render, and a fresh
 * array each time would re-render the whole list once a second.
 */
export const filasDeLista = recordar(
  (s: CantoralState): Track[] =>
    (s.plOrder[s.curPlaylist] || [])
      .map((id) => s.tracks.find((t) => t.id === id))
      .filter((t): t is Track => !!t),
  (s: CantoralState) => [s.curPlaylist, s.plOrder[s.curPlaylist], s.tracks],
);

/**
 * Las pistas sobre las que actúa «Agregar a un culto».
 *
 * La selección si hay una; si no, la pista que el panel de detalle tiene
 * abierta. En ese orden, porque una selección es explícita y el panel puede
 * llevar abierto desde hace rato. El menú contextual no hace falta mirarlo:
 * `openRowMenu` ya deja la selección apuntando a la fila sobre la que se abrió.
 */
export const pistasParaAgregar = recordar(
  (s: CantoralState): readonly string[] => {
    const elegidas = seleccionVigente(s);
    if (elegidas.length > 0) return elegidas;
    return s.detailOpen && s.selId ? [s.selId] : VACIO;
  },
  (s: CantoralState) => [seleccionVigente(s), s.detailOpen, s.selId],
);

/** Una sola instancia, para que el memo de arriba conserve su identidad. */
const VACIO: readonly string[] = [];

/**
 * The selection, pruned to what is on screen and put in display order.
 *
 * Both the count the user reads and the ids a bulk action sends come from
 * here, so a selection that outlived its rows — after a filter change, a
 * rescan or a deletion — can never be acted on behind the user's back.
 */
export const seleccionVigente = recordar(
  (s: CantoralState): string[] => {
    const visibles = applyFilters(s).map((t) => t.id);
    return enOrden(visibles, vigentes(visibles, s.selection));
  },
  (s: CantoralState) => [s.tracks, s.qf, s.ocasion, s.tagFilter, s.query, s.sortKey, s.sortDir, s.selection],
);

/**
 * The lists kept as starting points for new ones.
 *
 * Remembered so that the «Nueva lista» dialog is handed the same array while
 * nothing changed: a fresh one on every read would re-render the dialog on
 * each tick of the player.
 */
export const plantillas = recordar(
  (s: CantoralState): Playlist[] => s.playlists.filter((p) => p.plantilla),
  (s: CantoralState) => [s.playlists],
);

/**
 * The last service held, per occasion — what «repetir el culto anterior»
 * offers. Templates and undated lists are left out; see `ultimaPorOcasion`.
 */
export const repetibles = recordar(
  (s: CantoralState) => ultimaPorOcasion(s.playlists),
  // The day is a dependency: «anterior» means «before today», so an app left
  // open overnight would otherwise keep offering yesterday's answer.
  (s: CantoralState) => [s.playlists, new Date().toDateString()],
);

/**
 * El culto que viene, para la tarjeta de arriba de la barra lateral.
 *
 * Una plantilla nunca cuenta: no tiene fecha y no es un culto, es el punto de
 * partida de uno. Entre las que sí tienen fecha, hoy va por delante —el
 * domingo por la mañana el culto es lo que estás a punto de hacer, no algo ya
 * archivado—, y de las que vienen se queda la más cercana.
 */
export const proximoCulto = recordar(
  (s: CantoralState): Playlist | null =>
    partirPorFecha(s.playlists.filter((p) => !p.plantilla)).proximos[0] ?? null,
  // Igual que en `repetibles`: «lo que viene» se mide contra hoy, así que una
  // app abierta toda la noche tiene que dejar de ofrecer el culto de ayer.
  (s: CantoralState) => [s.playlists, new Date().toDateString()],
);

/** A tag and how many tracks carry it. */
export interface Etiqueta {
  nombre: string;
  cuenta: number;
}

/**
 * Every tag in the catalogue, with its use count.
 *
 * Derived rather than fetched: tags already travel with the tracks, so asking
 * the backend for a list it could only recompute from the same rows would be a
 * round trip for nothing.
 */
export const etiquetas = recordar(
  (s: CantoralState): Etiqueta[] => {
    const cuenta = new Map<string, number>();
    s.tracks.forEach((t) =>
      (t.tags || []).forEach((raw) => {
        const tag = raw.trim();
        if (tag) cuenta.set(tag, (cuenta.get(tag) ?? 0) + 1);
      }),
    );
    // A tag being filtered on stays listed even once nothing carries it,
    // otherwise its chip vanishes and the filter can never be switched off.
    s.tagFilter.forEach((t) => {
      if (!cuenta.has(t)) cuenta.set(t, 0);
    });
    return [...cuenta.entries()]
      .map(([nombre, c]) => ({ nombre, cuenta: c }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },
  (s: CantoralState) => [s.tracks, s.tagFilter],
);

/** Ids that form the play queue for the view the user pressed play in. */
export function queueForView(s: CantoralState): string[] {
  if (s.view === "lista") return (s.plOrder[s.curPlaylist] || []).slice();
  return applyFilters(s).map((t) => t.id);
}

/** Live play queue, minus ids whose track disappeared. Falls back to the library. */
export function playQueue(s: CantoralState): string[] {
  const ids = new Set(s.tracks.map((t) => t.id));
  const live = s.queue.filter((id) => ids.has(id));
  return live.length ? live : applyFilters(s).map((t) => t.id);
}

/** Filter + sort the library exactly like the design's applyFilters(). */
export const applyFilters = recordar(
  (s: CantoralState): Track[] => {
    let list = s.tracks.slice();
    if (s.qf === "fav") list = list.filter((t) => t.fav);
    else if (s.qf === "missing") list = list.filter((t) => t.missing);
    else if (s.qf === "recent") list = list.slice().sort((a, b) => b.added - a.added).slice(0, 8);
    if (s.ocasion) list = list.filter((t) => t.ocasion === s.ocasion);
    // Every selected tag has to be on the track: picking two is «both», which
    // is the only reading that makes picking a second one useful.
    if (s.tagFilter.length) {
      list = list.filter((t) => {
        const tags = t.tags || [];
        return s.tagFilter.every((f) => tags.includes(f));
      });
    }
    if (s.query) {
      const q = s.query.toLowerCase();
      list = list.filter((t) =>
        [t.titulo, t.artista, t.album, t.tono, t.ocasion, (t.tags || []).join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (s.qf !== "recent") {
      const dir = s.sortDir === "asc" ? 1 : -1;
      const k = s.sortKey;
      list.sort((a, b) => {
        let av: string | number = a[k as keyof Track] as never;
        let bv: string | number = b[k as keyof Track] as never;
        if (k === "dur") {
          av = a.durSec;
          bv = b.durSec;
        }
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        return String(av).localeCompare(String(bv), "es") * dir;
      });
    }
    return list;
  },
  (s: CantoralState) => [s.tracks, s.qf, s.ocasion, s.tagFilter, s.query, s.sortKey, s.sortDir],
);

export interface Group {
  showHeader: boolean;
  /** Identidad del grupo, para plegarlo. Vacía cuando no hay agrupación. */
  clave: string;
  label?: string;
  /** La carpeta en el disco, solo al agrupar por carpeta. */
  ruta?: string;
  countLabel?: string;
  /** Cuántas pistas tiene, plegado o no: el encabezado sigue diciéndolo. */
  count: number;
  colapsado: boolean;
  tracks: { track: Track; num: number }[];
}

/**
 * Group + number the filtered list.
 *
 * Agrupar por carpeta usa la carpeta *del disco*, no la raíz indexada: ver
 * `carpetaReal`. Un grupo plegado no entrega pistas, y la numeración solo
 * avanza sobre lo que se está viendo, así que los números siempre leen 1, 2,
 * 3… hacia abajo de la tabla.
 */
export const buildGroups = recordar(
  (s: CantoralState, list: Track[]): Group[] => {
    if (s.groupBy === "none" || s.qf === "recent") {
      return [
        {
          showHeader: false,
          clave: "",
          count: list.length,
          colapsado: false,
          tracks: list.map((track, i) => ({ track, num: i + 1 })),
        },
      ];
    }
    const porCarpeta = s.groupBy === "carpeta";
    const key = s.groupBy;
    const mapa = new Map<string, { nombre: string; ruta: string; pistas: Track[] }>();
    list.forEach((t) => {
      const c = porCarpeta
        ? carpetaReal(t, s.folders)
        : (() => {
            const v = ((t[key as keyof Track] as string) || "").trim() || "—";
            return { clave: v, nombre: v, ruta: "" };
          })();
      let g = mapa.get(c.clave);
      if (!g) {
        g = { nombre: c.nombre, ruta: c.ruta, pistas: [] };
        mapa.set(c.clave, g);
      }
      g.pistas.push(t);
    });
    const claves = [...mapa.keys()].sort((a, b) =>
      mapa.get(a)!.nombre.localeCompare(mapa.get(b)!.nombre, "es"),
    );
    let n = 0;
    return claves.map((clave) => {
      const g = mapa.get(clave)!;
      const colapsado = s.gruposColapsados.includes(clave);
      return {
        showHeader: true,
        clave,
        label: g.nombre,
        ruta: g.ruta,
        count: g.pistas.length,
        countLabel: g.pistas.length + (g.pistas.length === 1 ? " pista" : " pistas"),
        colapsado,
        tracks: colapsado ? [] : g.pistas.map((track) => ({ track, num: ++n })),
      };
    });
  },
  (s: CantoralState, list: Track[]) => [list, s.groupBy, s.qf, s.folders, s.gruposColapsados],
);

/**
 * Total playlist duration label, e.g. "23 min".
 *
 * Takes the catalogue rather than the whole state so a view can call it while
 * only subscribing to `tracks`.
 */
export function plDur(s: { tracks: Track[] }, ids: string[]): string {
  const total = ids.reduce((a, id) => {
    const t = s.tracks.find((x) => x.id === id);
    return a + (t ? t.durSec : 0);
  }, 0);
  return Math.round(total / 60) + " min";
}
