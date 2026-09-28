// El store tiene un solo camino y le da igual qué backend contesta (#135). Lo
// que se fija aquí es lo que eso arregla y lo que eso exige: las dos formas de
// quitar pistas hacen lo mismo, lo que el navegador no sabe hacer se dice como
// un aviso, y el navegador arranca como la app, pidiéndole la biblioteca al
// backend.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../store";
import { backend, usarBackend } from "../backend";
import { crearMemoria } from "../backend/memoria";
import { tauri } from "../backend/tauri";

const initial = useStore.getState();

let dejarDeEscuchar: () => void = () => {};

beforeEach(async () => {
  dejarDeEscuchar();
  usarBackend(crearMemoria());
  useStore.setState(initial, true);
  await useStore.getState().hydrate();
  // Lo que hace la app al montarse.
  dejarDeEscuchar = await useStore.getState().escucharEscaneo();
});

/** Una pista de ejemplo que está en algún culto, y ese culto. */
function enUnCulto() {
  const st = useStore.getState();
  const pl = st.playlists.find((p) => (st.plOrder[p.id] ?? []).length > 0)!;
  return { id: st.plOrder[pl.id][0], pl: pl.id };
}

describe("el navegador arranca como la app", () => {
  it("empieza vacío y la biblioteca llega del backend", async () => {
    useStore.setState(initial, true);
    expect(useStore.getState().tracks).toEqual([]);

    await useStore.getState().hydrate();

    expect(useStore.getState().tracks.length).toBeGreaterThan(0);
    expect(useStore.getState().libState).toBe("content");
  });

  it("fuera de Tauri elige la base en memoria", () => {
    usarBackend(null);
    expect(backend()).not.toBe(tauri);
    expect(backend().reproduceArchivos).toBe(false);
  });
});

describe("las dos formas de quitar una pista hacen lo mismo", () => {
  it("una a una, sale también del culto", async () => {
    const { id, pl } = enUnCulto();

    useStore.getState().deleteTrack(id);
    useStore.getState().acceptConfirm();

    await vi.waitFor(() => expect(useStore.getState().tracks.some((t) => t.id === id)).toBe(false));
    expect(useStore.getState().plOrder[pl]).not.toContain(id);
  });

  it("en lote, igual", async () => {
    const { id, pl } = enUnCulto();
    useStore.setState({ selection: [id] });

    useStore.getState().bulkDelete();
    useStore.getState().acceptConfirm();

    await vi.waitFor(() => expect(useStore.getState().tracks.some((t) => t.id === id)).toBe(false));
    expect(useStore.getState().plOrder[pl]).not.toContain(id);
  });
});

describe("lo que el navegador no sabe hacer", () => {
  it("se dice como un aviso, no como un error", async () => {
    const t = useStore.getState().tracks[0];

    useStore.getState().revealTrack(t.id);

    await vi.waitFor(() => expect(useStore.getState().toast?.type).toBe("info"));
    expect(useStore.getState().toast?.titulo).toContain("app de escritorio");
  });
});

describe("un escaneo en el navegador", () => {
  it("elegir carpeta y escanear llega hasta el final", async () => {
    const carpeta = await backend().pickFolder();

    useStore.getState().indexFolder(carpeta!, true);
    expect(useStore.getState().scanning).toBe(true);

    await vi.waitFor(() => expect(useStore.getState().scanning).toBe(false), { timeout: 10000 });
    expect(useStore.getState().folders.some((f) => f.ruta === carpeta)).toBe(true);
    expect(useStore.getState().toast?.titulo).toBe("Biblioteca actualizada");
  });
});

describe("cancelar un escaneo", () => {
  it("lo dice, con cuántos archivos quedaron leídos, y no «Biblioteca actualizada»", async () => {
    const carpeta = await backend().pickFolder();
    useStore.getState().indexFolder(carpeta!, true);
    // Que lea algo antes de cancelar.
    await vi.waitFor(() => expect(useStore.getState().scanHechos).toBeGreaterThan(0), { timeout: 5000 });

    useStore.getState().cancelScan();

    await vi.waitFor(() => expect(useStore.getState().toast?.titulo).toBe("Escaneo cancelado"));
    expect(useStore.getState().toast?.detalle).toMatch(/Se quedó lo que ya había leído: \d+ de 40 archivos/);
  });

  it("el siguiente escaneo, completo, vuelve a decir «Biblioteca actualizada»", async () => {
    const carpeta = await backend().pickFolder();
    useStore.getState().indexFolder(carpeta!, true);
    await vi.waitFor(() => expect(useStore.getState().scanning).toBe(true));
    useStore.getState().cancelScan();
    await vi.waitFor(() => expect(useStore.getState().toast?.titulo).toBe("Escaneo cancelado"));

    useStore.getState().indexFolder(carpeta!, true);
    await vi.waitFor(() => expect(useStore.getState().toast?.titulo).toBe("Biblioteca actualizada"), { timeout: 10000 });
  });
});
