// Plegar un grupo es para dejar de ver una carpeta mientras se arma un culto
// con lo de otra. Lo que se fija aquí es que se pliegue y se despliegue con el
// mismo clic, y que cambiar el eje de agrupación olvide lo plegado: una clave
// como «f1/Clásicos» no quiere decir nada cuando se agrupa por álbum, y
// dejarla puesta esconde un grupo que nadie plegó.

import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../../store";

const initial = useStore.getState();

beforeEach(() => useStore.setState(initial, true));

describe("plegar grupos", () => {
  it("el mismo clic pliega y despliega", () => {
    useStore.getState().toggleGrupo("f1/Clásicos");
    expect(useStore.getState().gruposColapsados).toEqual(["f1/Clásicos"]);

    useStore.getState().toggleGrupo("f1/Clásicos");
    expect(useStore.getState().gruposColapsados).toEqual([]);
  });

  it("se pueden plegar varios a la vez", () => {
    useStore.getState().toggleGrupo("a");
    useStore.getState().toggleGrupo("b");
    expect(useStore.getState().gruposColapsados).toEqual(["a", "b"]);

    useStore.getState().toggleGrupo("a");
    expect(useStore.getState().gruposColapsados).toEqual(["b"]);
  });

  it("cada cambio deja un array nuevo, que es de lo que vive el memo", () => {
    const antes = useStore.getState().gruposColapsados;
    useStore.getState().toggleGrupo("a");
    expect(useStore.getState().gruposColapsados).not.toBe(antes);
  });

  it("cambiar el eje olvida lo plegado", () => {
    useStore.getState().onGroupBy("carpeta");
    useStore.getState().toggleGrupo("f1/Clásicos");

    useStore.getState().onGroupBy("album");

    expect(useStore.getState().groupBy).toBe("album");
    expect(useStore.getState().gruposColapsados).toEqual([]);
  });

  it("incluso al volver al mismo eje: las claves ya se perdieron por el camino", () => {
    useStore.getState().onGroupBy("carpeta");
    useStore.getState().toggleGrupo("f1/Clásicos");
    useStore.getState().onGroupBy("ocasion");
    useStore.getState().onGroupBy("carpeta");

    expect(useStore.getState().gruposColapsados).toEqual([]);
  });
});
