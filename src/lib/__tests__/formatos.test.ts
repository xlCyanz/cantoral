// La biblioteca indexa más formatos de los que un webview decodifica, así que
// hay pistas que están en el culto y no se pueden proyectar. Lo que se fija
// aquí es que eso se sepa antes de estar en vivo cuando se puede saber, que
// cuando no se puede no se invente, y que lo que falla lo diga en castellano
// y no con el código de `MediaError`.

import { describe, expect, it } from "vitest";
import { ERROR_AUTOPLAY, avisoDeFormato, extensionDe, motivoDeError, motivoNoProyectable } from "../formatos";

describe("extensionDe", () => {
  it("la saca de una ruta de Unix y de una de Windows", () => {
    expect(extensionDe("/Users/ana/Música/coro.mp3")).toBe("mp3");
    expect(extensionDe("C:\\Musica\\Domingo\\coro.MP4")).toBe("mp4");
  });

  it("no se queda con lo que venga detrás de la URL", () => {
    // `convertFileSrc` devuelve una URL, y una URL puede traer cola.
    expect(extensionDe("asset://localhost/coro.mp4?v=3")).toBe("mp4");
    expect(extensionDe("asset://localhost/coro.mp4#t=10")).toBe("mp4");
  });

  it("un archivo sin extensión no tiene extensión", () => {
    expect(extensionDe("/musica/coro")).toBe("");
    expect(extensionDe("")).toBe("");
    expect(extensionDe(undefined)).toBe("");
  });

  it("y un archivo oculto no tiene por extensión su nombre", () => {
    // «.gitignore» no es un archivo de tipo «gitignore».
    expect(extensionDe("/musica/.oculto")).toBe("");
  });

  it("una carpeta con punto no le presta su extensión al archivo", () => {
    expect(extensionDe("/musica/culto.2024/coro")).toBe("");
  });
});

describe("avisoDeFormato", () => {
  it("avisa de los contenedores que no decodifica ningún motor", () => {
    expect(avisoDeFormato("/m/testimonio.mkv")).toContain("no se puede reproducir");
    expect(avisoDeFormato("/m/boda.avi")).toContain("no se puede reproducir");
    expect(avisoDeFormato("/m/clip.WMV")).toContain("no se puede reproducir");
    expect(avisoDeFormato("/m/himno.wma")).toContain("no se puede reproducir");
  });

  it("y se calla con lo que depende del motor", () => {
    // `mov` lo reproduce WKWebView y `ogg` lo reproduce WebView2; marcarlos
    // aquí sería decirle a media plataforma que su archivo no sirve cuando sí.
    // Si alguno falla de verdad, lo dirá el elemento al intentarlo.
    for (const ruta of ["/m/a.mov", "/m/a.ogg", "/m/a.opus", "/m/a.aiff", "/m/a.flac"]) {
      expect(avisoDeFormato(ruta)).toBeNull();
    }
  });

  it("ni estorba con lo que sí se reproduce en todas partes", () => {
    for (const ruta of ["/m/a.mp4", "/m/a.m4v", "/m/a.webm", "/m/a.mp3", "/m/a.m4a", "/m/a.wav"]) {
      expect(avisoDeFormato(ruta)).toBeNull();
    }
  });
});

describe("motivoDeError", () => {
  it("traduce cada código de MediaError a algo accionable", () => {
    expect(motivoDeError(1)).toBe("La carga se interrumpió");
    expect(motivoDeError(2)).toBe("No se pudo leer el archivo");
    expect(motivoDeError(3)).toContain("códec");
    expect(motivoDeError(4)).toContain("no reproduce este formato");
  });

  it("dice qué extensión era, que es lo que se va a convertir", () => {
    expect(motivoDeError(4, "/m/testimonio.mkv")).toContain("(.mkv)");
    expect(motivoDeError(4, "/m/sin-extension")).not.toContain("(");
  });

  it("y el autoplay bloqueado no se confunde con un archivo roto", () => {
    expect(motivoDeError(ERROR_AUTOPLAY)).toContain("no dejó arrancar");
    expect(motivoDeError(undefined)).toBe("No se pudo reproducir");
  });
});

describe("motivoNoProyectable", () => {
  it("una pista sin ruta indexada no se puede proyectar", () => {
    expect(motivoNoProyectable({})).toBe("Sin archivo");
  });

  it("una cuyo archivo ya no está, tampoco", () => {
    expect(motivoNoProyectable({ path: "/m/coro.mp3", missing: true })).toBe("Falta el archivo");
  });

  it("falta el archivo manda sobre el formato", () => {
    // Un `.mkv` que además no está se arregla reapuntándolo o convirtiéndolo,
    // pero lo primero que hay que hacer es encontrarlo.
    expect(motivoNoProyectable({ path: "/m/a.mkv", missing: true })).toBe("Falta el archivo");
  });

  it("y una que está y se decodifica no tiene motivo", () => {
    expect(motivoNoProyectable({ path: "/m/coro.mp3" })).toBeNull();
    expect(motivoNoProyectable({ path: "/m/coro.mp3", missing: false })).toBeNull();
  });
});
