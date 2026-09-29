import { BookOpen, HandCoins, HandHeart, Hourglass, Megaphone, Mic } from "lucide-react";
import type { TipoMomento } from "../lib/types";

/**
 * El dibujo de cada tipo de momento sin música (#145).
 *
 * Un icono por tipo y no uno para todos: en una tabla de doce filas, la oración
 * y los anuncios se distinguen de un vistazo sin leer el título.
 */
const ICONOS = {
  oracion: HandHeart,
  lectura: BookOpen,
  anuncios: Megaphone,
  ofrenda: HandCoins,
  mensaje: Mic,
  otro: Hourglass,
} as const;

export default function IconoDeMomento({ tipo, size = 16 }: { tipo: TipoMomento; size?: number }) {
  const Icono = ICONOS[tipo] ?? Hourglass;
  return <Icono size={size} aria-hidden />;
}
