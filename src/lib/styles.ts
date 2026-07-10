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

export function navStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    padding: "9px 11px",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: active ? 600 : 500,
    transition: "background .13s,color .13s",
    color: active ? "var(--primary)" : "var(--text-2)",
    background: active ? "var(--primary-soft)" : "transparent",
  };
}

export function navCountStyle(active: boolean): CSSProperties {
  return {
    fontSize: "11px",
    fontWeight: 600,
    padding: "1px 8px",
    borderRadius: "20px",
    fontVariantNumeric: "tabular-nums",
    background: active ? "var(--primary-soft-2)" : "var(--surface-3)",
    color: active ? "var(--primary)" : "var(--text-3)",
  };
}

export function qfStyle(active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    padding: "8px 11px",
    borderRadius: "10px",
    fontSize: "13.5px",
    fontWeight: active ? 600 : 500,
    transition: "background .13s",
    color: active ? "var(--primary)" : "var(--text-2)",
    background: active ? "var(--primary-soft)" : "transparent",
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
