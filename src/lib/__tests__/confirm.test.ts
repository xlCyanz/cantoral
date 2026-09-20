// The three destructive actions must go through a confirmation, and — the part
// that matters — must not do anything until it is accepted. These run against
// the real store in its browser (mock) mode, where the seed catalogue stands in
// for the backend.

import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../../store";

const initial = useStore.getState();

beforeEach(() => {
  useStore.setState(initial, true);
});

describe("quitar una carpeta", () => {
  it("pregunta antes, nombrando cuántas pistas se pierden", () => {
    const folder = useStore.getState().folders[0];

    useStore.getState().removeFolder(folder.id);

    const req = useStore.getState().confirm;
    expect(req).not.toBeNull();
    expect(req?.title).toContain("Quitar");
    expect(req?.message).toContain(folder.nombre);
    expect(req?.detail).toContain(String(folder.count));
    // The promise the whole app is built on has to be restated here.
    expect(req?.safe).toContain("archivos de audio no se tocan");
  });

  it("no quita nada mientras la confirmación sigue abierta", () => {
    const before = useStore.getState().folders.length;

    useStore.getState().removeFolder(useStore.getState().folders[0].id);

    expect(useStore.getState().folders).toHaveLength(before);
  });

  it("cancelar deja la carpeta en su sitio", () => {
    const before = useStore.getState().folders.length;
    useStore.getState().removeFolder(useStore.getState().folders[0].id);

    useStore.getState().closeConfirm();

    expect(useStore.getState().confirm).toBeNull();
    expect(useStore.getState().folders).toHaveLength(before);
  });

  it("solo al aceptar se quita", () => {
    const folder = useStore.getState().folders[0];
    const before = useStore.getState().folders.length;
    useStore.getState().removeFolder(folder.id);

    useStore.getState().acceptConfirm();

    expect(useStore.getState().confirm).toBeNull();
    expect(useStore.getState().folders).toHaveLength(before - 1);
    expect(useStore.getState().folders.some((f) => f.id === folder.id)).toBe(false);
  });

  it("ignora una carpeta que ya no existe en vez de preguntar por la nada", () => {
    useStore.getState().removeFolder("no-existe");
    expect(useStore.getState().confirm).toBeNull();
  });
});

describe("eliminar una lista", () => {
  it("pregunta antes, nombrando la lista y cuántas pistas lleva", () => {
    const st = useStore.getState();
    const pl = st.playlists.find((p) => p.id === st.curPlaylist)!;

    st.deleteCurrentList();

    const req = useStore.getState().confirm;
    expect(req?.message).toContain(pl.nombre);
    expect(req?.detail).toContain(String((st.plOrder[pl.id] || []).length));
    expect(req?.safe).toContain("siguen en tu biblioteca");
  });

  it("no borra nada mientras la confirmación sigue abierta", () => {
    const before = useStore.getState().playlists.length;

    useStore.getState().deleteCurrentList();

    expect(useStore.getState().playlists).toHaveLength(before);
  });

  it("solo al aceptar se borra", () => {
    const id = useStore.getState().curPlaylist;
    const before = useStore.getState().playlists.length;
    useStore.getState().deleteCurrentList();

    useStore.getState().acceptConfirm();

    expect(useStore.getState().playlists).toHaveLength(before - 1);
    expect(useStore.getState().playlists.some((p) => p.id === id)).toBe(false);
    expect(useStore.getState().view).toBe("colecciones");
  });
});

describe("quitar una pista de la biblioteca", () => {
  const faltante = () => useStore.getState().tracks.find((t) => t.missing)!;

  it("pregunta antes, nombrando las listas de las que también sale", () => {
    const t = faltante();
    // Asegurar que está en alguna lista, para que el aviso tenga que mencionarla.
    const pl = useStore.getState().playlists[0];
    useStore.setState((s) => ({ plOrder: { ...s.plOrder, [pl.id]: [t.id] } }));

    useStore.getState().deleteTrack(t.id);

    const req = useStore.getState().confirm;
    expect(req?.message).toContain(t.titulo);
    expect(req?.detail).toContain(pl.nombre);
    // El archivo de audio es lo único que nunca se toca.
    expect(req?.safe).toContain("no se borra");
  });

  it("no quita nada mientras la confirmación sigue abierta", () => {
    const before = useStore.getState().tracks.length;

    useStore.getState().deleteTrack(faltante().id);

    expect(useStore.getState().tracks).toHaveLength(before);
  });

  it("solo al aceptar se quita", () => {
    const t = faltante();
    const before = useStore.getState().tracks.length;
    useStore.getState().deleteTrack(t.id);

    useStore.getState().acceptConfirm();

    expect(useStore.getState().tracks).toHaveLength(before - 1);
    expect(useStore.getState().tracks.some((x) => x.id === t.id)).toBe(false);
  });
});

describe("la petición de confirmación", () => {
  it("se descarta al aceptar, así una acción no puede ejecutarse dos veces", () => {
    let veces = 0;
    useStore.getState().askConfirm({
      title: "t",
      message: "m",
      confirmLabel: "ok",
      onConfirm: () => {
        veces += 1;
      },
    });

    useStore.getState().acceptConfirm();
    useStore.getState().acceptConfirm(); // un segundo Enter no debe repetirla

    expect(veces).toBe(1);
  });
});
