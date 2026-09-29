import type { ThemeMode } from "../lib/types";
import { UI_PREFS_KEY, parsePrefs, resolveView } from "../lib/uiPrefs";
import { registrar, BIBLIOTECA_SIN_ABRIR, type Snapshot } from "../lib/api";
import { NoDisponible, backend } from "../lib/backend";
import type { CantoralState } from "./tipos";
import { modulo } from "./contexto";
import type { Contexto, Get, Set } from "./contexto";
import { AVISO_COPIA_AUTOMATICA, detalleDeOmitidos, resolveTheme } from "./reglas";

// Parte del store (#134). Ver src/store/index.ts.
// Carpetas, escaneo, arranque y copias de seguridad.

export interface EscaneoSlice {
  /**
   * Si la tarjeta de escaneo de la esquina está escondida.
   *
   * Esconderla no cancela nada: son dos cosas distintas —quiero seguir
   * trabajando sin la tarjeta delante, y quiero que el escaneo pare—, y un
   * solo botón para las dos haría que quien quisiera lo primero perdiera el
   * escaneo. Se vuelve a mostrar en el siguiente escaneo.
   */
  tarjetaEscaneoOculta: boolean;
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
  scanFile: string;
  /** Archivos que el escaneo en curso ya leyó, y cuántos encontró (#139). */
  scanHechos: number;
  scanTotal: number;
  /** Message from the last failed backend call, shown in the error state. */
  scanError: string | null;
  /** When the last backup made this session was written (RFC3339). */
  ultimaCopia: string | null;
  ocultarTarjetaEscaneo: () => void;
  /**
   * Seguir el progreso que manda el backend mientras escanea. Devuelve con qué
   * dejar de escucharlo. Lo llama la app al montarse.
   */
  escucharEscaneo: () => Promise<() => void>;

  openAddFolder: () => void;
  /** Show the log file in the system file manager, for sending it when something fails. */
  mostrarRegistro: () => void;
  indexFolder: (path: string, recursive?: boolean) => void;
  cancelScan: () => void;
  retryError: () => void;
  hydrate: () => Promise<void>;
  /** Point a whole indexed folder at its new location. */
  relocateFolder: (id: string) => void;
  removeFolder: (id: string) => void;
  rescanFolder: (id?: string) => void;
  backup: () => void;
  /**
   * Restaurar un respaldo. Sin `src` pide el archivo; con él —una copia
   * automática elegida en Configuración (#143)— va directo a la confirmación.
   */
  restore: (src?: string) => void;
}

export function crearEscaneo(set: Set, get: Get, ctx: Contexto): EscaneoSlice {
  const { toast, avisarFallo, applySnapshot, startLiveRefresh, stopLiveRefresh } = ctx;

  /** Lo que tienen en común añadir una carpeta y volver a escanearla, al empezar… */
  const empezar = () => {
    modulo.escaneoCancelado = false;
    set({ scanning: true, scanPct: 0, scanFile: "", scanOmitidos: 0, scanHechos: 0, scanTotal: 0, tarjetaEscaneoOculta: false });
    startLiveRefresh();
  };

  /**
   * …y al terminar.
   *
   * Un escaneo cancelado también acaba aquí, con la biblioteca de ese momento:
   * lo leído hasta entonces se guardó por lotes. Decía «Biblioteca
   * actualizada» igual que uno completo, y nadie sabía si lo cancelado se
   * había quedado (#139).
   */
  const terminar = (snap: Snapshot) => {
    applySnapshot(snap);
    set({ scanning: false, libState: snap.tracks.length ? "content" : "empty", scanPct: 100 });
    if (modulo.escaneoCancelado) {
      const { scanHechos: hechos, scanTotal: total } = get();
      toast("Escaneo cancelado", {
        tipo: "info",
        detalle:
          hechos === 0
            ? "No llegó a leer ningún archivo."
            : `Se quedó lo que ya había leído: ${hechos} de ${total} ${total === 1 ? "archivo" : "archivos"}. El resto entra en el próximo escaneo.`,
      });
      return;
    }
    toast("Biblioteca actualizada", { detalle: detalleDeOmitidos(get().scanOmitidos) });
  };

  return {
    tarjetaEscaneoOculta: false,
    scanning: false,
    scanPct: 0,
    scanOmitidos: 0,
    scanFile: "",
    scanHechos: 0,
    scanTotal: 0,
    scanError: null,
    ultimaCopia: null,
    ocultarTarjetaEscaneo: () => set({ tarjetaEscaneoOculta: true }),
    escucharEscaneo: () =>
      backend().onScanProgress((p) =>
        set({ scanPct: p.pct, scanFile: p.file, scanOmitidos: p.omitidos, scanHechos: p.added, scanTotal: p.total }),
      ),

    openAddFolder: () => {
      // The buttons that get here are disabled while a scan runs, but the
      // store is where the rule actually lives — only one scan at a time, and
      // the dialog's only outcome is starting one.
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", { tipo: "info" });
        return;
      }
      set({ dialog: "addFolder" });
    },
    indexFolder: (path, recursive = true) => {
      set({ dialog: null });
      // The backend refuses a second scan outright, and an error screen is a
      // harsh answer to what is usually a double click.
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", { tipo: "info" });
        return;
      }
      if (!path) return;
      // The view does move to the library here — the user just asked for a
      // folder from the add dialog, so that is where they expect to land.
      // What it no longer does is *replace* the library with the scan.
      set({ view: "biblioteca" });
      empezar();
      backend()
        .addAndScanFolder(path, recursive)
        .then(terminar)
        .catch((err) => {
          console.error(err);
          modulo.lastFailedAction = () => get().indexFolder(path, recursive);
          set({ scanning: false, libState: "error", scanError: String(err) });
        })
        .finally(stopLiveRefresh);
    },
    cancelScan: () => {
      modulo.escaneoCancelado = true;
      stopLiveRefresh();
      void backend().cancelScan().catch(console.error);
      // `libState` is left alone: whatever the library was showing is still
      // what it holds. A cancelled first scan goes back to the empty state on
      // its own, because nothing was ever indexed.
      set({ scanning: false });
    },
    retryError: () => {
      set({ scanError: null });
      const retry = modulo.lastFailedAction;
      modulo.lastFailedAction = null;
      if (retry) retry();
      else void get().hydrate();
    },
    hydrate: async () => {
      const inicio = performance.now();
      try {
        const snap = await backend().getLibrary();
        applySnapshot(snap);
        set({ libState: snap.tracks.length ? "content" : "empty", scanError: null });
        const videos = snap.tracks.filter((t) => t.video).length;
        registrar("info", `hydrate: ${snap.tracks.length} tracks (${videos} videos) loaded in ${Math.round(performance.now() - inicio)} ms`);
        // Restore saved preferences.
        // `openExt` ya no se lee. La fila que dejó en `settings` una
        // instalación anterior se queda ahí sin hacer nada: borrarla sería
        // tocar datos del usuario para ganar nada, y si el ajuste volviera
        // alguna vez, volvería con su valor.
        const [modeS, themeS, uiS] = await Promise.all([
          backend().getSetting("themeMode"),
          backend().getSetting("theme"),
          backend().getSetting(UI_PREFS_KEY),
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
        Object.assign(patch, prefs, resolveView(prefs, snap.playlists));
        if (Object.keys(patch).length) {
          set(patch);
          // Nothing read at startup is worth writing back, and `applySnapshot`
          // ran a moment ago and may already have queued a write of a
          // `curPlaylist` it picked on its own. What was just restored is the
          // newer truth, so whatever is queued goes.
          if (modulo.prefsTimer) {
            clearTimeout(modulo.prefsTimer);
            modulo.prefsTimer = null;
          }
        }

        // Callada y sin bloquear: si hay algo, aparece en Configuración; si no,
        // nadie se entera. Una app que interrumpe al abrirse para decir que no
        // pasa nada es una app que se aprende a ignorar.
        void get().checkForUpdate();

        // Files can disappear while the app is closed; re-check them once the
        // catalogue is on screen rather than blocking the first paint.
        void backend()
          .reconcileLibrary()
          .then((fresh) => {
            applySnapshot(fresh);
            registrar("info", `hydrate: reconciled ${Math.round(performance.now() - inicio)} ms after start`);
          })
          .catch((err) => {
            console.error("reconcile failed", err);
            registrar("error", `reconcile failed: ${String(err)}`);
          });
      } catch (err) {
        console.error("hydrate failed", err);
        registrar("error", `hydrate failed: ${String(err)}`);
        modulo.lastFailedAction = () => void get().hydrate();
        set({ libState: "error", scanError: String(err) });
      }
    },
    mostrarRegistro: () => {
      backend()
        .revealLog()
        .catch((err) => {
          if (!(err instanceof NoDisponible)) registrar("error", `could not reveal the log: ${String(err)}`);
          avisarFallo(err, "No se pudo mostrar el registro");
        });
    },
    relocateFolder: (id) => {
      const f = get().folders.find((x) => x.id === id);
      if (!f) return;
      // Relocating rewrites the paths a running scan is still inserting, and
      // the folder would end up half old paths, half new (#127). The core
      // refuses it too; this is the friendly version of that answer.
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", { tipo: "info" });
        return;
      }
      backend()
        .relocateFolder(id)
        .then((snap) => {
          if (!snap) return;
          applySnapshot(snap);
          toast(`«${f.nombre}» ahora apunta a su nueva ubicación`, {
            detalle: "Sus pistas conservan favoritos y su sitio en los cultos.",
          });
        })
        .catch((err) => avisarFallo(err, String(err)));
    },
    removeFolder: (id) => {
      const f = get().folders.find((x) => x.id === id);
      if (!f) return;
      // Removing the folder being scanned used to break the scan's next insert
      // and land the library on an error screen blaming the drive (#127).
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", { tipo: "info" });
        return;
      }
      const n = f.count;
      get().askConfirm({
        title: "¿Quitar esta carpeta?",
        message: `«${f.nombre}» dejará de estar indexada.`,
        detail:
          n > 0
            ? `Se borrarán ${n} ${n === 1 ? "pista" : "pistas"} de la biblioteca, junto con sus favoritos y su ocasión.`
            : "La carpeta no tiene pistas indexadas.",
        safe: `Tus archivos de audio no se tocan: siguen donde están. ${AVISO_COPIA_AUTOMATICA}`,
        confirmLabel: "Quitar carpeta",
        onConfirm: () => {
          backend()
            .removeFolder(id)
            .then(applySnapshot)
            .then(() => toast("Carpeta quitada de la biblioteca"))
            .catch((err) => {
              console.error(err);
              toast("No se pudo quitar la carpeta", { tipo: "error", detalle: String(err) });
            });
        },
      });
    },
    rescanFolder: (id) => {
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", { tipo: "info" });
        return;
      }
      if (!id) return;
      // No `view` here on purpose. A re-scan is started from Configuración,
      // and yanking the user out of the screen they are working on is the
      // whole complaint this change exists to fix.
      empezar();
      backend()
        .rescanFolder(id)
        .then(terminar)
        .catch((err) => {
          console.error(err);
          modulo.lastFailedAction = () => get().rescanFolder(id);
          set({ scanning: false, libState: "error", scanError: String(err) });
        })
        .finally(stopLiveRefresh);
    },
    backup: () => {
      // A backup that fails has to say so. It used to end in a bare
      // `console.error`, so a full disk or an unplugged USB left the user with
      // neither the success toast nor an error — and walking away believing
      // there was a copy (#128).
      void backend()
        .backup()
        .then((copia) => {
          if (!copia) return;
          set({ ultimaCopia: copia.cuando });
          toast("Copia de seguridad creada correctamente", { detalle: copia.dest });
        })
        .catch((err) => avisarFallo(err, "No se pudo crear la copia de seguridad", String(err)));
    },
    restore: (elegido) => {
      // A scan holds its own connection to the database a restore moves
      // aside, so its work would vanish with the old file (#127).
      if (get().scanning) {
        toast("Espera a que termine el escaneo en curso", { tipo: "info" });
        return;
      }
      const archivo = elegido ? Promise.resolve(elegido) : backend().pickBackup();
      void archivo
        .then(async (src) => {
          if (!src) return;
          // Read the backup before asking anything: a file that is not a Cantoral
          // database is rejected here, so the question is never even posed.
          const info = await backend().inspectBackup(src);
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
              `${plural(info.playlists, "lista", "listas")}.` +
              // A newer backup was already refused by `inspectBackup`; an older
              // one is brought up to date on restore, which is worth saying.
              (info.version < info.appVersion
                ? "\nEl respaldo es de una versión anterior de Cantoral: se actualizará al restaurarlo."
                : ""),
            safe:
              "Tus archivos de audio no se tocan. Si la restauración falla, la biblioteca actual vuelve intacta. " +
              AVISO_COPIA_AUTOMATICA,
            confirmLabel: "Restaurar",
            onConfirm: () => {
              backend()
                .restoreDatabase(src)
                .then((snap) => {
                  applySnapshot(snap);
                  set({ libState: snap.tracks.length ? "content" : "empty", scanError: null });
                  toast("Base de datos restaurada");
                })
                .catch((err) => {
                  console.error(err);
                  // The previous database could not be reopened either: the core
                  // is running on a blank one and only a restart brings the file
                  // back. A five-second toast is not enough for that, so it takes
                  // over the library (#124). «Volver a intentarlo» would reload
                  // that blank database and show an empty library, so it keeps
                  // repeating the message instead.
                  if (String(err) === BIBLIOTECA_SIN_ABRIR) {
                    const sinBiblioteca = () => {
                      modulo.lastFailedAction = sinBiblioteca;
                      set({ libState: "error", scanError: BIBLIOTECA_SIN_ABRIR });
                    };
                    sinBiblioteca();
                    return;
                  }
                  toast("No se pudo restaurar la base de datos", { tipo: "error", detalle: String(err) });
                });
            },
          });
        })
        .catch((err) => avisarFallo(err, String(err)));
    },
  };
}
