// Lo que hacen las teclas en los controles que se pintan a mano (#138).
//
// Un `<input type="range">` o un menú nativo ya saben esto; los de Cantoral
// son `div` para poder dibujarlos como el resto de la app, así que el patrón
// ARIA que prometen lo cumplen estas dos funciones. Separadas del componente
// para poder probarlas sin DOM.

/**
 * A dónde va un deslizador al pulsar `tecla`, como fracción entre 0 y 1.
 *
 * `paso` es lo que mueve una flecha: 5 s del progreso o un 5 % del volumen.
 * Re Pág/Av Pág mueven cuatro pasos, Inicio/Fin van a los extremos. Null
 * cuando la tecla no es del deslizador y hay que dejarla pasar.
 */
export function valorDeDeslizador(tecla: string, valor: number, paso: number): number | null {
  let nuevo: number;
  switch (tecla) {
    case "ArrowRight":
    case "ArrowUp":
      nuevo = valor + paso;
      break;
    case "ArrowLeft":
    case "ArrowDown":
      nuevo = valor - paso;
      break;
    case "PageUp":
      nuevo = valor + paso * 4;
      break;
    case "PageDown":
      nuevo = valor - paso * 4;
      break;
    case "Home":
      nuevo = 0;
      break;
    case "End":
      nuevo = 1;
      break;
    default:
      return null;
  }
  return Math.min(1, Math.max(0, nuevo));
}

/**
 * Qué elemento de un menú de `total` toma el foco al pulsar `tecla` estando en
 * `actual` (-1 si el foco no está en ninguno).
 *
 * ↑/↓ dan la vuelta, que es lo que hace un menú del sistema; Inicio/Fin van al
 * primero y al último. Null para cualquier otra tecla.
 */
export function indiceDeMenu(tecla: string, actual: number, total: number): number | null {
  if (total === 0) return null;
  switch (tecla) {
    case "ArrowDown":
      return actual < 0 ? 0 : (actual + 1) % total;
    case "ArrowUp":
      return actual < 0 ? total - 1 : (actual - 1 + total) % total;
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return null;
  }
}
