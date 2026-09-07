import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Last line of defence: without this a throw during render leaves the desktop
 * window blank with no way back, since there is no address bar to reload from.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Cantoral crashed while rendering", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 40,
          gap: 4,
          background: "var(--bg)",
          color: "var(--text)",
        }}
      >
        <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--danger-soft)", display: "grid", placeItems: "center", marginBottom: 20 }}>
          <TriangleAlert size={44} color="var(--danger)" strokeWidth={1.7} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px" }}>Algo salió mal</h1>
        <p style={{ fontSize: 14, color: "var(--text-2)", maxWidth: 430, lineHeight: 1.55, margin: "0 0 8px" }}>
          Cantoral encontró un error inesperado. Tu música y tu base de datos no se tocaron.
        </p>
        <code style={{ fontSize: 12, color: "var(--text-3)", background: "var(--surface-2)", border: "1px solid var(--border)", padding: "5px 11px", borderRadius: 8, maxWidth: 460, textAlign: "left", overflowWrap: "anywhere", marginBottom: 22 }}>
          {error.message || String(error)}
        </code>
        <button
          onClick={() => window.location.reload()}
          className="hb-primary"
          style={{ height: 44, display: "flex", alignItems: "center", gap: 9, padding: "0 20px", borderRadius: 11, background: "var(--primary)", color: "var(--on-primary)", fontSize: 14, fontWeight: 600, boxShadow: "var(--sh-sm)" }}
        >
          <RefreshCw size={17} strokeWidth={2.2} />Reiniciar Cantoral
        </button>
      </div>
    );
  }
}
