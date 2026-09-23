import simboloCompleto from "../assets/logo/symbol-indigo.svg";
import simbolo32 from "../assets/logo/symbol-small-32.svg";
import simbolo16 from "../assets/logo/symbol-small-16.svg";

/**
 * El logo de Cantoral: un libro abierto, con una corchea calada en la página
 * izquierda y la letra en la derecha.
 *
 * Los dibujos son los del manual de marca (`export-logo/`), tal cual. No se
 * pegan dentro de la página: se usan como máscara y se pintan con `--logo`.
 * Así el modo oscuro sale del mismo archivo —el manual solo trae las
 * versiones chicas en índigo, y la clara es exactamente la índigo con otro
 * color— y los ids internos de cada SVG (`#ma`, `#ca`) no chocan entre sí,
 * que es lo que pasaría con dos logos en la misma página.
 */

/** La rejilla del símbolo mide 244 × 200. */
const ANCHO_SOBRE_ALTO = 244 / 200;

/**
 * Qué dibujo corresponde a cada tamaño, según el manual: por debajo de 40 px
 * la versión de tres líneas y trazo más grueso, y a menos de 20 px la de dos
 * líneas y sin nota — a ese tamaño la corchea es una mancha.
 */
export function dibujoPara(ancho: number): string {
  if (ancho < 20) return simbolo16;
  if (ancho < 40) return simbolo32;
  return simboloCompleto;
}

/** Solo el símbolo. `ancho` en píxeles; el alto sale de la rejilla. */
export function Simbolo({ ancho }: { ancho: number }) {
  const mascara = `url(${dibujoPara(ancho)}) center / contain no-repeat`;
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        flex: "0 0 auto",
        width: ancho,
        height: ancho / ANCHO_SOBRE_ALTO,
        background: "var(--logo)",
        WebkitMask: mascara,
        mask: mascara,
      }}
    />
  );
}

/**
 * El logotipo: símbolo y nombre, con las proporciones del manual.
 *
 * El nombre no va en trazos: se escribe con Bricolage Grotesque, que la app
 * ya lleva dentro. El símbolo mide 1,14 veces el cuerpo de letra de alto, y
 * entre los dos van 0,27 cuerpos.
 */
export function Logotipo({ cuerpo, peso = 700 }: { cuerpo: number; peso?: 600 | 700 }) {
  const alto = cuerpo * 1.14;
  return (
    <span role="img" aria-label="Cantoral" style={{ display: "inline-flex", alignItems: "center", gap: cuerpo * 0.27, color: "var(--logo)" }}>
      <Simbolo ancho={alto * ANCHO_SOBRE_ALTO} />
      <span
        aria-hidden
        style={{
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
          fontWeight: peso,
          fontSize: cuerpo,
          letterSpacing: "-0.035em",
          lineHeight: 1,
        }}
      >
        Cantoral
      </span>
    </span>
  );
}
