import type { DuplicateGroup, DuplicateTrack, Sheet } from "./api";
import type { Folder, Playlist, Track } from "./types";

// Seed catalogue — transcribed verbatim from design/Cantoral.dc.html.
// Used by the dev/browser mock backend so the UI is fully explorable
// without the Rust process. The real backend replaces this at runtime.

export const SCAN_FILES = [
  "Himnos\\Sublime Gracia.mp3",
  "Himnos\\Santo Santo Santo.mp3",
  "Coros\\Castillo Fuerte.wav",
  "Pistas 2025\\Al Mundo Paz.mp3",
  "Himnos\\Roca de la Eternidad.flac",
  "Coros\\Firmes y Adelante.mp3",
  "Pistas 2025\\Tuya Es la Gloria.wav",
  "Himnos\\En la Cruz.mp3",
];

/**
 * A couple of sheets so the lyrics view has something to show in the browser.
 *
 * Written for the demo rather than taken from anywhere: what they are for is
 * showing the ChordPro shape — `[Sol]` over the syllable it falls on — and a
 * `{seccion}` heading.
 */
export const SEED_SHEETS: Record<string, Sheet> = {
  t1: {
    trackId: "t1",
    letra: [
      "Cantaré de tu amor por siempre,",
      "de tu gracia que no se acaba.",
      "",
      "Coro",
      "Santo, santo es el Señor,",
      "toda la tierra canta su honor.",
    ].join("\n"),
    acordes: [
      "{Estrofa}",
      "[Sol]Cantaré de tu [Do]amor por [Sol]siempre,",
      "de tu [Mim]gracia que no se a[Re]caba.",
      "",
      "{Coro}",
      "[Do]Santo, santo [Sol]es el Señor,",
      "[Mim]toda la tierra [Re]canta su ho[Sol]nor.",
    ].join("\n"),
  },
  t3: {
    trackId: "t3",
    letra: ["Firme en la roca estoy,", "nada me moverá."].join("\n"),
    acordes: ["[Do]Firme en la [Fa]roca es[Do]toy,", "nada me mo[Sol]ve[Do]rá."].join("\n"),
  },
};

export const SEED_FOLDERS: Folder[] = [
  { id: "f1", nombre: "Himnos", ruta: "C:\\Música\\Iglesia\\Himnos", count: 128 },
  { id: "f2", nombre: "Pistas 2025", ruta: "D:\\Alabanza\\Pistas 2025", count: 64 },
  { id: "f3", nombre: "Coros", ruta: "C:\\Users\\Alabanza\\Coros", count: 47 },
];

const PISTAS: Omit<Track, "path" | "tieneHoja">[] = [
  { id: "t1", titulo: "Sublime Gracia", artista: "Coro Congregacional", album: "Himnos Clásicos, Vol. 1", dur: "4:12", durSec: 252, tono: "Sol", bpm: 68, ocasion: "Adoración", formato: "MP3", carpeta: "Himnos", tags: ["clásico", "lento"], fav: true, missing: false, added: 6 },
  { id: "t2", titulo: "Santo, Santo, Santo", artista: "Ensamble Getsemaní", album: "Himnos Clásicos, Vol. 1", dur: "3:48", durSec: 228, tono: "Re", bpm: 72, ocasion: "Adoración", formato: "MP3", carpeta: "Himnos", tags: ["clásico"], fav: false, missing: false, added: 5 },
  { id: "t3", titulo: "Castillo Fuerte", artista: "Coro Congregacional", album: "Herencia de la Reforma", dur: "3:20", durSec: 200, tono: "Do", bpm: 96, ocasion: "Alabanza", formato: "WAV", carpeta: "Coros", tags: ["júbilo"], fav: false, missing: false, added: 4 },
  { id: "t4", titulo: "Cuán Grande Es Él", artista: "Voces de Gracia", album: "Adoración en Vivo", dur: "5:02", durSec: 302, tono: "Sib", bpm: 66, ocasion: "Adoración", formato: "MP3", carpeta: "Himnos", tags: ["clásico", "lento"], fav: true, missing: true, added: 9 },
  { id: "t5", titulo: "Al Mundo Paz", artista: "Coro Navideño", album: "Navidad Congregacional", dur: "3:05", durSec: 185, tono: "Re", bpm: 100, ocasion: "Navidad", formato: "MP3", carpeta: "Pistas 2025", tags: ["júbilo"], fav: false, missing: false, added: 10 },
  { id: "t6", titulo: "Roca de la Eternidad", artista: "Ensamble Getsemaní", album: "Himnos Clásicos, Vol. 2", dur: "4:30", durSec: 270, tono: "Mi", bpm: 64, ocasion: "Comunión", formato: "FLAC", carpeta: "Himnos", tags: ["lento", "instrumental"], fav: false, missing: false, added: 3 },
  { id: "t7", titulo: "A Solas al Huerto", artista: "Adoración Central", album: "Momentos de Reflexión", dur: "4:44", durSec: 284, tono: "Fa", bpm: 70, ocasion: "Reflexión", formato: "MP3", carpeta: "Coros", tags: ["lento", "instrumental"], fav: false, missing: false, added: 2 },
  { id: "t8", titulo: "Firmes y Adelante", artista: "Coro Congregacional", album: "Himnos de Fe", dur: "3:12", durSec: 192, tono: "Sol", bpm: 112, ocasion: "Alabanza", formato: "MP3", carpeta: "Coros", tags: ["júbilo"], fav: false, missing: false, added: 7 },
  { id: "t9", titulo: "Tuya Es la Gloria", artista: "Voces de Gracia", album: "Resurrección", dur: "3:58", durSec: 238, tono: "La", bpm: 104, ocasion: "Resurrección", formato: "WAV", carpeta: "Pistas 2025", tags: ["júbilo", "bilingüe"], fav: true, missing: false, added: 8 },
  { id: "t10", titulo: "Mil Voces Para Celebrar", artista: "Coro Congregacional", album: "Himnos de Fe", dur: "3:30", durSec: 210, tono: "Sol", bpm: 120, ocasion: "Alabanza", formato: "MP3", carpeta: "Himnos", tags: ["júbilo"], fav: false, missing: false, added: 1 },
  { id: "t11", titulo: "Cariñoso Salvador", artista: "Adoración Central", album: "Comunión", dur: "4:08", durSec: 248, tono: "Reb", bpm: 60, ocasion: "Comunión", formato: "MP3", carpeta: "Coros", tags: ["lento"], fav: false, missing: false, added: 5 },
  { id: "t12", titulo: "Dulce Comunión", artista: "Ensamble Getsemaní", album: "Comunión", dur: "3:36", durSec: 216, tono: "Mib", bpm: 74, ocasion: "Comunión", formato: "MP3", carpeta: "Himnos", tags: ["clásico"], fav: false, missing: false, added: 4 },
  { id: "t13", titulo: "Cristo Ya Resucitó", artista: "Voces de Gracia", album: "Resurrección", dur: "3:22", durSec: 202, tono: "Do", bpm: 118, ocasion: "Resurrección", formato: "WAV", carpeta: "Pistas 2025", tags: ["júbilo"], fav: false, missing: false, added: 8 },
  { id: "t14", titulo: "Oh Dios, Nuestro Auxilio", artista: "Coro Congregacional", album: "Himnos Clásicos, Vol. 2", dur: "4:00", durSec: 240, tono: "La", bpm: 80, ocasion: "Adoración", formato: "MP3", carpeta: "Himnos", tags: ["clásico"], fav: false, missing: false, added: 2 },
  { id: "t15", titulo: "Alma, Bendice al Señor", artista: "Adoración Central", album: "Adoración en Vivo", dur: "4:20", durSec: 260, tono: "Fa", bpm: 88, ocasion: "Adoración", formato: "MP3", carpeta: "Coros", tags: ["clásico", "júbilo"], fav: true, missing: false, added: 6 },
  { id: "t16", titulo: "En la Cruz", artista: "Ensamble Getsemaní", album: "Momentos de Reflexión", dur: "4:55", durSec: 295, tono: "Sol", bpm: 66, ocasion: "Reflexión", formato: "MP3", carpeta: "Pistas 2025", tags: ["lento"], fav: false, missing: true, added: 3 },
  { id: "t17", titulo: "Sublime Gracia — Video con letra", artista: "Proyección", album: "Recursos de Proyección", dur: "4:20", durSec: 260, tono: "Sol", bpm: 68, ocasion: "Adoración", formato: "MP4", carpeta: "Pistas 2025", tags: ["proyección", "letras"], fav: false, missing: false, added: 10, video: true },
  { id: "t18", titulo: "Fondo de Adoración (loop)", artista: "Recurso Visual", album: "Recursos de Proyección", dur: "6:00", durSec: 360, tono: "—", bpm: 0, ocasion: "Reflexión", formato: "MOV", carpeta: "Pistas 2025", tags: ["fondo", "instrumental"], fav: false, missing: false, added: 9, video: true },
  { id: "t19", titulo: "Cristo Ya Resucitó — Video", artista: "Proyección", album: "Resurrección", dur: "3:22", durSec: 202, tono: "Do", bpm: 118, ocasion: "Resurrección", formato: "MP4", carpeta: "Coros", tags: ["proyección"], fav: false, missing: false, added: 7, video: true },
];

/**
 * Rutas de ejemplo.
 *
 * El backend real manda el `path` de cada pista, leído del disco. Aquí se
 * derivan de la carpeta para que el panel de detalle muestre algo verosímil en
 * el modo navegador. Fabricar la ruta está bien en datos de ejemplo; hacerlo en
 * la interfaz, que es lo que pasaba antes, no.
 */
export const SEED_TRACKS: Track[] = PISTAS.map((t) => ({
  ...t,
  path: `${SEED_FOLDERS.find((f) => f.nombre === t.carpeta)?.ruta ?? "C:\\Música"}\\${t.titulo}.${t.formato.toLowerCase()}`,
  tieneHoja: t.id in SEED_SHEETS,
}));

export const SEED_PLAYLISTS: Playlist[] = [
  { id: "p1", nombre: "Culto Domingo 13 Jul", fecha: "2026-09-25", ocasion: "Servicio dominical", ids: ["t2", "t15", "t1", "t6", "t12", "t8"] },
  { id: "p2", nombre: "Servicio de Jóvenes", fecha: "2026-09-23", ocasion: "Reunión juvenil", ids: ["t3", "t8", "t10", "t9", "t13", "t5"] },
  { id: "p3", nombre: "Santa Cena · Agosto", fecha: "2026-10-09", ocasion: "Comunión", ids: ["t11", "t6", "t12", "t7", "t1"] },
  { id: "p4", nombre: "Ensayo del Coro", fecha: "2026-09-16", ocasion: "Ensayo", ids: ["t1", "t2", "t14", "t15", "t4", "t10", "t8"] },
  { id: "p5", nombre: "Noche de Adoración", fecha: "Viernes 25 de julio, 2025", ocasion: "Adoración especial", ids: ["t1", "t4", "t15", "t6", "t14", "t7"] },
];

/**
 * A fabricated duplicate group, so the view can be exercised in the browser.
 *
 * The real grouping runs in Rust against file sizes, lengths and folded
 * titles — none of which the seed has. This is a fixture built from real seed
 * tracks so that choosing, merging and dismissing all do something coherent
 * here; it is not what the backend would return for this catalogue.
 */
function comoDuplicada(t: Track, fsize: number): DuplicateTrack {
  return {
    id: t.id,
    titulo: t.titulo,
    artista: t.artista,
    path: t.path ?? "",
    formato: t.formato,
    carpeta: t.carpeta,
    dur: t.dur,
    durSec: t.durSec,
    fsize,
    fav: t.fav,
    missing: t.missing,
    tags: t.tags,
  };
}

export function seedDuplicates(): DuplicateGroup[] {
  const de = (id: string) => SEED_TRACKS.find((t) => t.id === id)!;
  const grupo = (motivo: string, sugerido: string, miembros: [string, number][]): DuplicateGroup => ({
    signature: miembros.map(([id]) => id).join("-"),
    motivo,
    sugerido,
    tracks: miembros.map(([id, size]) => comoDuplicada(de(id), size)),
  });
  // Both are the same song held twice: the audio the band plays and the video
  // the projector runs. The kind of pair a church accumulates without noticing.
  return [
    grupo("titulo", "t1", [
      ["t1", 6_048_210],
      ["t17", 88_412_330],
    ]),
    grupo("titulo", "t13", [
      ["t13", 35_640_120],
      ["t19", 71_204_880],
    ]),
  ];
}
