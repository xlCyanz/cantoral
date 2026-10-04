/**
 * Un video a la vez fuera del reproductor.
 *
 * La duración y la miniatura se leen cada una con su cola, y las dos cargan
 * el archivo en un `<video>` que nadie ve. Cada cola va de uno en uno, pero
 * juntas serían dos archivos a la vez pidiéndole bytes al protocolo `asset:`,
 * que en Windows los sirve desde el hilo de la ventana: lo que la congeló en
 * 0.3.2. Con este turno nunca hay más de uno.
 */
let cola: Promise<unknown> = Promise.resolve();

export function enTurno<T>(trabajo: () => Promise<T>): Promise<T> {
  const mio = cola.then(trabajo, trabajo);
  // El que sigue espera a que este acabe, salga bien o mal.
  cola = mio.catch(() => {});
  return mio;
}
