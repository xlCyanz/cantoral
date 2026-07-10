import type { CSSProperties, ReactNode } from "react";

/** Shared centered empty-state block in the warm Cantoral style. */
export default function Empty({
  icon,
  title,
  desc,
  action,
  compact,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  action?: ReactNode;
  /** Use inside a view that already has a header (no full-height centering). */
  compact?: boolean;
}) {
  return (
    <div style={compact ? wrapCompact : wrap}>
      <div style={circle}>{icon}</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>{title}</h2>
      <p style={{ fontSize: 14, color: "var(--text-2)", maxWidth: 420, lineHeight: 1.55, margin: "0 0 22px" }}>{desc}</p>
      {action}
    </div>
  );
}

const base: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: 40,
  animation: "canFade .3s ease",
};
const wrap: CSSProperties = { ...base, height: "100%" };
const wrapCompact: CSSProperties = { ...base, padding: "56px 40px" };
const circle: CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: "50%",
  background: "var(--primary-soft)",
  display: "grid",
  placeItems: "center",
  marginBottom: 22,
  color: "var(--primary)",
};

/** Secondary (outline) action button used in empty states. */
export const emptyBtnSecondary: CSSProperties = {
  height: 42,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 18px",
  borderRadius: 11,
  border: "1px solid var(--border-2)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  fontWeight: 600,
  transition: "background .14s",
};

/** Primary action button used in empty states. */
export const emptyBtnPrimary: CSSProperties = {
  height: 42,
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "0 20px",
  borderRadius: 11,
  background: "var(--primary)",
  color: "var(--on-primary)",
  fontSize: 14,
  fontWeight: 600,
  boxShadow: "var(--sh-sm)",
  transition: "background .14s",
};
