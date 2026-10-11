// Agrupar por carpeta reparte el catálogo una vez; plegar o desplegar un grupo
// solo vuelve a numerar. Y el reparto es exactamente el de antes —una pasada
// por cada pista y cada carpeta— sobre catálogos y carpetas al azar.

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGroups } from "../../store/selectores";
import type { CantoralState, Group } from "../../store";
import { faltantesPorCarpetaDe } from "../carpetas";
import type { Folder, GroupBy, Track } from "../types";

function pista(id: string, path: string | undefined, over: Partial<Track> = {}): Track {
  return { id, titulo: id, artista: "", album: "", dur: "3:00", durSec: 180, formato: "MP3", carpeta: "Suelta", fav: false, missing: false, added: 0, path, ...over };
}

const NADA: string[] = [];

function estado(over: Partial<CantoralState>): CantoralState {
  return { qf: null, groupBy: "carpeta", folders: [], gruposColapsados: NADA, ...over } as CantoralState;
}

// ---- La implementación de antes, tal cual: la referencia.

function normalizar(p: string): string {
  return p.replace(/[\\/]+/g, "/").replace(/\/+$/, "");
}
function dentroDe(ruta: string, raiz: string): boolean {
  if (!ruta || !raiz) return false;
  const r = normalizar(ruta).toLowerCase();
  const b = normalizar(raiz).toLowerCase();
  return r === b || r.startsWith(b + "/");
}
function carpetaDe(p: string): string {
  const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  return i > 0 ? p.slice(0, i) : "";
}
function carpetaRealAntes(t: Track, folders: readonly Folder[]) {
  const ruta = t.path ?? "";
  let raiz: Folder | null = null;
  for (const f of folders) {
    if (!dentroDe(ruta, f.ruta)) continue;
    if (!raiz || normalizar(f.ruta).length > normalizar(raiz.ruta).length) raiz = f;
  }
  if (!raiz) {
    const n = t.carpeta?.trim() || "—";
    return { clave: n, nombre: n, ruta: "" };
  }
  const resto = normalizar(ruta).slice(normalizar(raiz.ruta).length).split("/").filter(Boolean).slice(0, -1);
  return { clave: [raiz.id, ...resto].join("/"), nombre: [raiz.nombre, ...resto].join(" / "), ruta: carpetaDe(ruta) };
}
function gruposAntes(s: CantoralState, list: Track[]): Group[] {
  const mapa = new Map<string, { nombre: string; ruta: string; pistas: Track[] }>();
  list.forEach((t) => {
    const c =
      s.groupBy === "carpeta"
        ? carpetaRealAntes(t, s.folders)
        : (() => {
            const v = ((t[s.groupBy as keyof Track] as string) || "").trim() || "—";
            return { clave: v, nombre: v, ruta: "" };
          })();
    let g = mapa.get(c.clave);
    if (!g) {
      g = { nombre: c.nombre, ruta: c.ruta, pistas: [] };
      mapa.set(c.clave, g);
    }
    g.pistas.push(t);
  });
  const claves = [...mapa.keys()].sort((a, b) => mapa.get(a)!.nombre.localeCompare(mapa.get(b)!.nombre, "es"));
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
}

function generador(semilla: number) {
  let s = semilla;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

afterEach(() => vi.restoreAllMocks());

describe("los grupos por carpeta", () => {
  const folders: Folder[] = [{ id: "f1", nombre: "Himnos", ruta: "C:\\Música\\Himnos", count: 0 }];
  const list = Array.from({ length: 60 }, (_, i) =>
    pista(String(i), `C:\\Música\\Himnos\\${["Clásicos", "Coritos", "Navidad"][i % 3]}\\${i}.mp3`),
  );

  it("plegar y desplegar no vuelve a repartir ni a ordenar los grupos", () => {
    const abierto = buildGroups(estado({ folders }), list);
    const clave = abierto[1].clave;
    const minusculas = vi.spyOn(String.prototype, "toLowerCase");
    const compara = vi.spyOn(String.prototype, "localeCompare");

    const plegado = buildGroups(estado({ folders, gruposColapsados: [clave] }), list);
    const otraVez = buildGroups(estado({ folders, gruposColapsados: [] }), list);

    expect(minusculas).not.toHaveBeenCalled();
    expect(compara).not.toHaveBeenCalled();
    expect(plegado[1]).toMatchObject({ clave, colapsado: true, tracks: [], count: 20 });
    // Lo de debajo de un grupo plegado se numera seguido.
    expect(plegado[2].tracks[0].num).toBe(21);
    expect(otraVez).toEqual(abierto);
  });

  it("un corazón no vuelve a calcular carpetas: la de esa pista ya se conocía", () => {
    buildGroups(estado({ folders }), list);
    const otra = list.map((t) => (t.id === "7" ? { ...t, fav: true } : t));
    const minusculas = vi.spyOn(String.prototype, "toLowerCase");

    buildGroups(estado({ folders }), otra);

    expect(minusculas).not.toHaveBeenCalled();
  });

  it("la primera vez, una cuenta por carpeta del disco y no por pista", () => {
    const nuevas = structuredClone(list);
    const minusculas = vi.spyOn(String.prototype, "toLowerCase");

    buildGroups(estado({ folders: [{ ...folders[0], nombre: "Himnos " }] }), nuevas);

    // Unas pocas por directorio, no una por pista.
    expect(minusculas.mock.calls.length).toBeLessThan(10);
  });

  it("una ruta que acaba en separador no se agrupa como sus vecinas", () => {
    const raices: Folder[] = [{ id: "f1", nombre: "Todo", ruta: "C:\\M", count: 0 }];
    for (const orden of [["C:\\M\\Coros\\a.mp3", "C:\\M\\Coros\\"], ["C:\\M\\Coros\\", "C:\\M\\Coros\\a.mp3"]]) {
      const pistas = orden.map((p, i) => pista(String(i), p));
      const s = estado({ folders: structuredClone(raices) });
      expect(buildGroups(s, pistas)).toEqual(gruposAntes(s, pistas));
    }
  });

  it("una raíz que es justo la ruta de un archivo no se lleva a sus vecinos", () => {
    const raices: Folder[] = [
      { id: "f1", nombre: "Todo", ruta: "C:\\M", count: 0 },
      { id: "f2", nombre: "Raro", ruta: "C:\\M\\Coros\\a.mp3", count: 0 },
    ];
    const pistas = [pista("a", "C:\\M\\Coros\\a.mp3"), pista("b", "C:\\M\\Coros\\b.mp3")];
    const s = estado({ folders: raices });

    expect(buildGroups(s, pistas)).toEqual(gruposAntes(s, pistas));
    const alReves = structuredClone([...pistas].reverse());
    expect(buildGroups(estado({ folders: structuredClone(raices) }), alReves)).toEqual(gruposAntes(s, alReves));
  });

  it("cambiar cuántas pistas tiene una carpeta no lo recalcula todo", () => {
    buildGroups(estado({ folders }), list);
    const minusculas = vi.spyOn(String.prototype, "toLowerCase");

    buildGroups(estado({ folders: [{ ...folders[0], count: 99 }] }), list);

    expect(minusculas).not.toHaveBeenCalled();
  });

  it("reparte igual que antes, sobre carpetas y catálogos al azar", () => {
    const r = generador(11);
    const elegir = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
    const raices = ["C:\\Música", "c:/música/Himnos", "C:\\Música\\Himnos\\", "D:\\Pistas", "D:\\PistasViejas", "/home/m", "", "C:\\MÚSICA\\himnos", "D:\\Pistas\\Coros\\3.mp3", "D:/Pistas/coros/4.mp3"];
    const subs = ["", "\\Coros", "/Coros/Niños", "\\Clásicos", "/clásicos"];
    const ejes: GroupBy[] = ["carpeta", "carpeta", "album"];

    for (let ronda = 0; ronda < 300; ronda++) {
      const carpetas: Folder[] = Array.from({ length: 1 + Math.floor(r() * 4) }, (_, i) => ({
        id: `f${i}`,
        nombre: elegir(["Himnos", "Pistas", "Coros", "Música"]),
        ruta: elegir(raices),
        count: 0,
      }));
      const pistas = Array.from({ length: 30 }, (_, i) => {
        const raiz = elegir(raices);
        const x = r();
        const path = x < 0.1 ? undefined : x < 0.15 ? `${raiz}${elegir(subs)}\\` : `${raiz}${elegir(subs)}\\${i % 6}.mp3`;
        return pista(String(i), path, { album: elegir(["A", " B ", "", "á"]), carpeta: elegir(["Himnos", " ", ""]), missing: r() < 0.3 });
      });
      const s = estado({ folders: carpetas, groupBy: elegir(ejes), gruposColapsados: r() < 0.5 ? [] : [`f0`, "A"] });

      expect(buildGroups(s, pistas)).toEqual(gruposAntes(s, pistas));

      const faltan: Record<string, number> = {};
      for (const t of pistas) {
        if (!t.missing) continue;
        let elegida: Folder | null = null;
        for (const f of carpetas) {
          if (!dentroDe(t.path ?? "", f.ruta)) continue;
          if (!elegida || normalizar(f.ruta).length > normalizar(elegida.ruta).length) elegida = f;
        }
        if (elegida) faltan[elegida.id] = (faltan[elegida.id] ?? 0) + 1;
      }
      expect(faltantesPorCarpetaDe(pistas, carpetas)).toEqual(faltan);
    }
  });
});
