// Cuánto tarda la biblioteca en contestar con miles de pistas.
//
// No es una prueba: mide. Se salta en la pasada normal, porque los tiempos
// dependen de la máquina y no pueden fallar ni pasar. Para correrla:
//
//   MEDIR=1 npx vitest run src/lib/__tests__/rendimiento.test.ts
//
// Cada operación es lo que hace la interfaz: la acción del store y después
// lo que la tabla vuelve a derivar (`applyFilters`, `buildGroups` y la
// selección vigente). Se da la mediana de varias repeticiones.

import { describe, it, vi } from "vitest";
import { useStore } from "../../store";
import { applyFilters, buildGroups, seleccionVigente } from "../../store/selectores";
import { usarBackend } from "../backend";
import { crearMemoria } from "../backend/memoria";
import type { Folder, Track } from "../types";

const medir = Boolean((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.MEDIR);

const PALABRAS = [
  "Señor", "Jesús", "corazón", "alabanza", "canción", "Espíritu", "Santo", "gloria", "adoración", "nación",
  "Dios", "fiel", "más", "allá", "río", "pasión", "oración", "perdón", "aleluya", "bendición",
  "camino", "verdad", "vida", "luz", "días", "mañana", "reinarás", "tú", "él", "cielo",
];
const ARTISTAS = ["Marcos Witt", "Jesús Adrián Romero", "Coalo Zamorano", "Danilo Montero", "Álex Campos", "Marcela Gándara", "Hillsong en Español", "Barak", "Miel San Marcos", "Christine D'Clario"];
const SUBCARPETAS = ["Clásicos", "Coritos", "Especiales", "Navidad", "Santa Cena", "Jóvenes", "Niños", "Ofrenda"];

/** Un número pseudoaleatorio repetible, para que antes y después midan lo mismo. */
function generador(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function biblioteca(n: number): { tracks: Track[]; folders: Folder[] } {
  const r = generador(n);
  const elegir = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const folders: Folder[] = [
    { id: "f1", nombre: "Himnos", ruta: "C:\\Música\\Iglesia\\Himnos", count: 0 },
    { id: "f2", nombre: "Pistas 2025", ruta: "D:\\Pistas 2025", count: 0 },
    { id: "f3", nombre: "Videos", ruta: "C:\\Users\\Iglesia\\Videos", count: 0 },
  ];
  const tracks: Track[] = [];
  for (let i = 1; i <= n; i++) {
    const f = elegir(folders);
    const video = f.id === "f3" || r() < 0.05;
    const titulo = Array.from({ length: 2 + Math.floor(r() * 3) }, () => elegir(PALABRAS)).join(" ");
    const sub = r() < 0.8 ? `\\${elegir(SUBCARPETAS)}${r() < 0.3 ? `\\${elegir(SUBCARPETAS)}` : ""}` : "";
    const durSec = 120 + Math.floor(r() * 300);
    f.count++;
    tracks.push({
      id: String(i),
      titulo,
      artista: elegir(ARTISTAS),
      album: `Álbum ${Math.floor(r() * 200)}`,
      dur: `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, "0")}`,
      durSec,
      formato: video ? "MP4" : "MP3",
      carpeta: f.nombre,
      fav: r() < 0.1,
      missing: r() < 0.02,
      singers: [],
      added: i,
      video,
      path: `${f.ruta}${sub}\\${titulo} ${i}.${video ? "mp4" : "mp3"}`,
    });
  }
  return { tracks, folders };
}

/** Lo que la tabla deriva después de cada cambio. */
function derivar() {
  const s = useStore.getState();
  const list = applyFilters(s);
  buildGroups(s, list);
  seleccionVigente(s);
}

function mediana(xs: number[]): number {
  const o = xs.slice().sort((a, b) => a - b);
  return o[Math.floor(o.length / 2)];
}

function tiempo(n: number, antes: () => void, accion: () => void): number {
  const ts: number[] = [];
  for (let i = 0; i < n; i++) {
    antes();
    const t0 = performance.now();
    accion();
    derivar();
    ts.push(performance.now() - t0);
  }
  return mediana(ts);
}

/**
 * Hasta que el arranque termine. Con microtareas y no con temporizadores: el
 * backend en memoria contesta sin esperar a nada, y un `setTimeout` metería en
 * la medida lo que la app deja para los ratos libres.
 */
async function hastaListo() {
  for (let i = 0; i < 10_000 && !useStore.getState().arranqueListo; i++) await Promise.resolve();
  while (!useStore.getState().arranqueListo) await new Promise((r) => setTimeout(r, 0));
}

async function arrancar(semilla: { tracks: Track[]; folders: Folder[] }): Promise<number> {
  usarBackend(crearMemoria({ ...semilla, playlists: [] }));
  useStore.setState({ tracks: [], folders: [], arranqueListo: false, query: "", qf: null, groupBy: "none", gruposColapsados: [] });
  const t0 = performance.now();
  await useStore.getState().hydrate();
  await hastaListo();
  derivar();
  return performance.now() - t0;
}

/** Una medida en frío: arrancar de nuevo, sin cronometrar, y medir una sola vez `accion`. */
async function enFrio(semilla: { tracks: Track[]; folders: Folder[] }, accion: () => void): Promise<number> {
  const ts: number[] = [];
  for (let i = 0; i < 7; i++) {
    await arrancar(semilla);
    const t0 = performance.now();
    accion();
    derivar();
    ts.push(performance.now() - t0);
  }
  return mediana(ts);
}

describe.skipIf(!medir)("rendimiento", () => {
  it("mide", { timeout: 600_000 }, async () => {
    // Lo que la app prepara en los ratos libres (la búsqueda sin tildes) no
    // corre aquí: lo que se mide es lo que cuesta cada cosa sin esa ayuda.
    vi.stubGlobal("requestIdleCallback", () => 0);
    const filas: string[] = [];
    for (const n of [1000, 5000, 10000]) {
      const semilla = biblioteca(n);
      const r: Record<string, number> = {};
      const st = () => useStore.getState();
      const arranques: number[] = [];
      for (let i = 0; i < 7; i++) arranques.push(await arrancar(semilla));
      r["arranque (hydrate + reconcile)"] = mediana(arranques);
      r["buscar (1ª tecla tras arrancar)"] = await enFrio(semilla, () => st().onQuery("se"));
      r["agrupar por carpeta (1ª vez)"] = await enFrio(semilla, () => st().onGroupBy("carpeta"));
      await arrancar(semilla);
      derivar();
      const R = 31;

      r["corazón"] = tiempo(R, () => {}, () => st().onFav(String(1 + (n >> 1))));
      st().onRowClick(String(1 + (n >> 2)));
      useStore.setState({ selId: String(1 + (n >> 2)), detailOpen: true });
      let k = 0;
      r["editar (tecla)"] = tiempo(R, () => {}, () => st().setEdit("artista", "Artista " + k++));
      st().flushEdit();

      // Una búsqueda en frío: lo primero que se escribe después de una
      // instantánea nueva, como la de un reescaneo.
      const frias: number[] = [];
      for (let i = 0; i < 7; i++) {
        st().clearQuery();
        derivar();
        useStore.setState({ arranqueListo: false });
        await st().hydrate();
        await hastaListo();
        derivar();
        const t0 = performance.now();
        st().onQuery("se");
        derivar();
        frias.push(performance.now() - t0);
      }
      r["buscar (1ª tecla tras instantánea)"] = mediana(frias);
      let q = 0;
      r["buscar (tecla, caché caliente)"] = tiempo(R, () => {}, () => st().onQuery(q++ % 2 ? "san" : "sa"));
      r["borrar la búsqueda"] = tiempo(R, () => {
        st().onQuery("san");
        derivar();
      }, () => st().clearQuery());
      r["ordenar por título"] = tiempo(R, () => {}, () => st().onSortHeader("titulo"));
      r["agrupar por carpeta (otra vez)"] = tiempo(R, () => {
        st().onGroupBy("none");
        derivar();
      }, () => st().onGroupBy("carpeta"));
      const clave = buildGroups(st(), applyFilters(st()))[0].clave;
      r["plegar un grupo"] = tiempo(R, () => {}, () => st().toggleGrupo(clave));
      r["corazón (agrupado por carpeta)"] = tiempo(R, () => {}, () => st().onFav(String(1 + (n >> 1))));
      st().onGroupBy("none");

      for (const [op, ms] of Object.entries(r)) filas.push(`${n}\t${op}\t${ms.toFixed(2)}`);
    }
    console.log("\n" + filas.join("\n"));
  });
});
