// El catálogo de ejemplo tal como lo deja `hydrate()` en el navegador.
//
// El store ya no arranca con los datos de ejemplo: empieza vacío y los pide al
// backend como en la app (#135). Las pruebas que se escribieron contra ese
// arranque parten de aquí, sin tener que pasar por `hydrate`.

import { SEED_FOLDERS, SEED_PLAYLISTS, SEED_TRACKS } from "../seed";
import type { CantoralState } from "../../store";

export function estadoDeEjemplo(): Partial<CantoralState> {
  const playlists = structuredClone(SEED_PLAYLISTS);
  return {
    tracks: structuredClone(SEED_TRACKS),
    folders: structuredClone(SEED_FOLDERS),
    playlists,
    plOrder: Object.fromEntries(playlists.map((p) => [p.id, p.ids.slice()])),
    curPlaylist: "p1",
    playerId: "t1",
    libState: "content",
  };
}
