// La tabla ordena el catálogo una vez y reutiliza ese orden mientras nada lo
// mueva. Lo que se fija aquí: que un corazón no vuelve a ordenar, que cambiar
// lo que se ordena sí, y que el resultado es exactamente el de antes —filtrar
// y luego ordenar todo en cada cambio— sobre catálogos al azar.

import { afterEach, describe, expect, it, vi } from "vitest";
import { applyFilters } from "../../store/selectores";
import type { CantoralState } from "../../store";
import { coincideEnCampos, sinTildes } from "../buscar";
import type { QuickFilter, SortDir, SortKey, Track } from "../types";

function pista(over: Partial<Track> & { id: string }): Track {
  return { titulo: "Pista", artista: "", album: "", dur: "3:00", durSec: 180, formato: "MP3", carpeta: "", fav: false, missing: false, added: 0, ...over };
}

function estado(over: Partial<CantoralState>): CantoralState {
  return { tracks: [], qf: null, query: "", sortKey: "titulo", sortDir: "asc", ...over } as CantoralState;
}

/** La implementación de antes, tal cual: la referencia contra la que se compara. */
function referencia(s: CantoralState): Track[] {
  let list = s.tracks.slice();
  if (s.qf === "fav") list = list.filter((t) => t.fav);
  else if (s.qf === "missing") list = list.filter((t) => t.missing);
  else if (s.qf === "recent") list = list.filter((t) => t.nueva).sort((a, b) => b.added - a.added);
  if (s.query) {
    const q = sinTildes(s.query);
    list = list.filter((t) => coincideEnCampos(t, q));
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
}

const TITULOS = ["Señor", "señor", "Senor", "Ñandú", "Alabaré", "alabare", "Zacarías", "Él", "el", "Oh", "ola", "Álbum", "", " Santo"];

function generador(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

afterEach(() => vi.restoreAllMocks());

describe("el orden de la tabla", () => {
  const tracks = Array.from({ length: 200 }, (_, i) =>
    pista({ id: String(i), titulo: `Canto ${String(i).padStart(3, "0")}`, album: String(i % 7) }),
  );

  it("un corazón no vuelve a ordenar", () => {
    const antes = applyFilters(estado({ tracks }));
    const compara = vi.spyOn(String.prototype, "localeCompare");
    const conCorazon = tracks.map((t) => (t.id === "50" ? { ...t, fav: true } : t));

    const despues = applyFilters(estado({ tracks: conCorazon }));

    expect(compara).not.toHaveBeenCalled();
    expect(despues.map((t) => t.id)).toEqual(antes.map((t) => t.id));
    // Con el objeto nuevo, no con el de antes del clic.
    expect(despues.find((t) => t.id === "50")?.fav).toBe(true);
  });

  it("borrar la búsqueda devuelve el mismo arreglo de antes de buscar, sin ordenar", () => {
    const sin = applyFilters(estado({ tracks }));
    applyFilters(estado({ tracks, query: "canto 01" }));
    const compara = vi.spyOn(String.prototype, "localeCompare");

    expect(applyFilters(estado({ tracks }))).toBe(sin);
    expect(compara).not.toHaveBeenCalled();
  });

  it("cambiar lo que se ordena sí vuelve a ordenar", () => {
    applyFilters(estado({ tracks }));
    const compara = vi.spyOn(String.prototype, "localeCompare");
    const renombrada = tracks.map((t) => (t.id === "50" ? { ...t, titulo: "Aaa" } : t));

    const despues = applyFilters(estado({ tracks: renombrada }));

    expect(compara).toHaveBeenCalled();
    expect(despues[0].id).toBe("50");
  });

  it("cambiar otra columna no, pero ordenar por ella sí", () => {
    applyFilters(estado({ tracks, sortKey: "album" }));
    const compara = vi.spyOn(String.prototype, "localeCompare");
    const retitulada = tracks.map((t) => (t.id === "50" ? { ...t, titulo: "Aaa" } : t));
    applyFilters(estado({ tracks: retitulada, sortKey: "album" }));
    expect(compara).not.toHaveBeenCalled();

    const otroAlbum = retitulada.map((t) => (t.id === "50" ? { ...t, album: "0" } : t));
    expect(applyFilters(estado({ tracks: otroAlbum, sortKey: "album" }))).toEqual(
      referencia(estado({ tracks: otroAlbum, sortKey: "album" })),
    );
    expect(compara).toHaveBeenCalled();
  });

  it("da lo mismo que ordenar todo en cada cambio, sobre catálogos al azar", () => {
    const r = generador(7);
    const elegir = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
    const claves: SortKey[] = ["titulo", "album", "dur"];
    const sentidos: SortDir[] = ["asc", "desc"];
    const filtros: QuickFilter[] = [null, null, "fav", "missing", "recent"];
    const consultas = ["", "", "", "se", "SEÑ", "a", "zz"];

    for (let ronda = 0; ronda < 20; ronda++) {
      let cat = Array.from({ length: 30 + Math.floor(r() * 60) }, (_, i) =>
        pista({
          id: String(i),
          titulo: elegir(TITULOS),
          artista: elegir(TITULOS),
          album: elegir(["A", "a", "B", "Á"]),
          durSec: Math.floor(r() * 5) * 60,
          fav: r() < 0.3,
          missing: r() < 0.2,
          nueva: r() < 0.3,
          added: Math.floor(r() * 10),
        }),
      );
      for (let paso = 0; paso < 40; paso++) {
        // Lo que puede pasarle al catálogo entre dos lecturas: nada, un
        // corazón, una tecla, un título nuevo, una duración, una pista más.
        const cambio = Math.floor(r() * 6);
        const id = String(Math.floor(r() * cat.length));
        if (cambio === 1) cat = cat.map((t) => (t.id === id ? { ...t, fav: !t.fav } : t));
        else if (cambio === 2) cat = cat.map((t) => (t.id === id ? { ...t, artista: elegir(TITULOS) } : t));
        else if (cambio === 3) cat = cat.map((t) => (t.id === id ? { ...t, titulo: elegir(TITULOS) } : t));
        else if (cambio === 4) cat = cat.map((t) => (t.id === id ? { ...t, durSec: Math.floor(r() * 5) * 60 } : t));
        else if (cambio === 5) cat = [...cat, pista({ id: String(cat.length), titulo: elegir(TITULOS) })];
        const s = estado({
          tracks: cat,
          sortKey: elegir(claves),
          sortDir: elegir(sentidos),
          qf: elegir(filtros),
          query: elegir(consultas),
        });
        expect(applyFilters(s)).toEqual(referencia(s));
      }
    }
  });
});
