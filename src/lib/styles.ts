import type { CSSProperties } from "react";
import type { SortDir, SortKey } from "./types";

// Style builders ported from the design's DCLogic helpers, returning
// React.CSSProperties objects instead of inline CSS strings.

export function chipStyle(active: boolean): CSSProperties {
  return {
    flex: "0 0 auto",
    height: "32px",
    padding: "0 14px",
    borderRadius: "9px",
    fontSize: "12.5px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    transition: "all .13s",
    border: `1px solid ${active ? "transparent" : "var(--border-2)"}`,
    background: active ? "var(--primary)" : "var(--surface)",
    color: active ? "var(--on-primary)" : "var(--text-2)",
  };
}

/**
 * A top-level sidebar entry: Biblioteca, Listas para cultos, Configuración.
 *
 * Ported from the design's `botonNav`. The label sits left and whatever it
 * counts sits right, so the three rows line up as a column of numbers.
 */
export function navBtn(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    width: "100%",
    height: "30px",
    padding: "0 9px 0 10px",
    borderRadius: "7px",
    fontSize: "12.5px",
    fontWeight: 600,
    textAlign: "left",
    transition: "background .13s,color .13s",
    background: active ? "var(--primary-soft)" : "transparent",
    color: active ? "var(--primary)" : "var(--text)",
  };
}

/**
 * A sidebar entry that belongs to the one above it: a filter under Biblioteca,
 * a list under Listas para cultos.
 *
 * Ported from the design's `botonSub`. The 32px left padding is what says
 * «this belongs to that» — it is the indent, not decoration, so it holds even
 * when the row has no icon.
 */
export function subBtn(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    width: "100%",
    height: "25px",
    padding: "0 9px 0 32px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: active ? 600 : 400,
    textAlign: "left",
    transition: "background .13s,color .13s",
    background: active ? "var(--surface-3)" : "transparent",
    color: active ? "var(--text)" : "var(--text-2)",
  };
}

/** The number on the right of a sidebar row. */
export function navCount(small = false): CSSProperties {
  return {
    flex: "0 0 auto",
    fontSize: small ? "10.5px" : "11px",
    color: "var(--text-3)",
    fontVariantNumeric: "tabular-nums",
  };
}

export function thStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: ".4px",
    textTransform: "uppercase",
    color: active ? "var(--text)" : "var(--text-3)",
    transition: "color .13s",
    background: "none",
  };
}

export function thArrow(active: boolean, dir: SortDir): string {
  return active ? (dir === "asc" ? "↑" : "↓") : "";
}

export function thProps(
  key: SortKey,
  sortKey: SortKey,
  sortDir: SortDir,
): { style: CSSProperties; arrow: string } {
  const active = sortKey === key;
  return { style: thStyle(active), arrow: thArrow(active, sortDir) };
}

export const ocasionBadge: CSSProperties = {
  display: "inline-block",
  fontSize: "11.5px",
  fontWeight: 600,
  padding: "2px 9px",
  borderRadius: "7px",
  background: "var(--surface-3)",
  color: "var(--text-2)",
};

export function favBtnStyle(fav: boolean): CSSProperties {
  return {
    width: "28px",
    height: "28px",
    borderRadius: "7px",
    display: "grid",
    placeItems: "center",
    transition: "background .13s",
    color: fav ? "var(--primary)" : "var(--text-3)",
  };
}

/**
 * Extra style for a control that is switched off while a scan runs.
 *
 * Paired with `disabled` on the same button. Greying it out is the honest
 * answer: only one scan can run at a time, so a second click has nowhere to go.
 */
export function ocupadoStyle(ocupado: boolean): CSSProperties {
  return ocupado ? { opacity: 0.45, cursor: "not-allowed" } : {};
}

/**
 * One half of a two-button segmented control.
 *
 * Ported from the design's `segmento`: the pair shares one border and one
 * background, and only the divider between them says there are two.
 */
export function segmento(active: boolean, primero: boolean): CSSProperties {
  return {
    width: 32,
    height: 32,
    display: "grid",
    placeItems: "center",
    borderLeft: primero ? "0" : "1px solid var(--border)",
    background: active ? "var(--primary-soft)" : "transparent",
    color: active ? "var(--primary)" : "var(--text-3)",
    transition: "background .13s,color .13s",
  };
}
