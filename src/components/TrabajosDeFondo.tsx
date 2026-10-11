import { useEffect, useState } from "react";
import { useStore } from "../store";
import { useVideoDurations } from "../lib/videoDurations";
import { useMiniaturasDeVideo } from "../lib/miniaturas";

/**
 * Si un arranque que no termina —una reconciliación colgada de una memoria USB
 * que no contesta— deja de esperar y deja empezar al trabajo de fondo igual.
 */
const ESPERA_MAXIMA_MS = 15000;

/**
 * Las colas de fondo: las duraciones y las miniaturas de los videos.
 *
 * Un componente aparte que no pinta nada, y no hooks en `App`, a propósito:
 * sus selectores cambian cada vez que un video recibe su miniatura, y en `App`
 * eso volvía a pintar la app entera —barra lateral, vista, panel, diálogos—
 * por cada video. Aquí lo único que se vuelve a pintar es este `null`.
 */
export default function TrabajosDeFondo() {
  const listo = useStore((s) => s.arranqueListo);
  const [cansado, setCansado] = useState(false);

  useEffect(() => {
    if (listo) return;
    const id = setTimeout(() => setCansado(true), ESPERA_MAXIMA_MS);
    return () => clearTimeout(id);
  }, [listo]);

  const activo = listo || cansado;
  useVideoDurations(activo);
  useMiniaturasDeVideo(activo);
  return null;
}
