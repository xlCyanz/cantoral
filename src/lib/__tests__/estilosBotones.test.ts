// Los botones dejaron de escribirse a mano en cada vista (#137). Lo que se fija
// aquí es que los helpers devuelven exactamente lo que cada vista tenía
// escrito: mover un estilo de sitio no puede mover un píxel.

import { describe, expect, it } from "vitest";
import {
  botonDialogoPrimario,
  botonDialogoSecundario,
  botonFila,
  botonPrimario,
  botonSecundario,
  emptyBtnPrimary,
  emptyBtnSecondary,
} from "../styles";

describe("estilos de botón", () => {
  it("el secundario de 42 px es el de la cabecera de una lista", () => {
    expect(botonSecundario(42)).toEqual({
      height: 42, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderRadius: 11,
      border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)",
      fontSize: "13.5px", fontWeight: 600, transition: "background .14s",
    });
  });

  it("los de 38 px son los de la cabecera de Colecciones", () => {
    expect(botonSecundario(38)).toEqual({
      height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderRadius: 10,
      border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)",
      fontSize: "13.5px", fontWeight: 600, transition: "background .14s",
    });
    expect(botonPrimario(38)).toEqual({
      height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 15px", borderRadius: 10,
      background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600,
      boxShadow: "var(--sh-sm)", transition: "background .14s",
    });
  });

  it("los de un estado vacío no cambian", () => {
    expect(emptyBtnPrimary).toEqual({
      height: 42, display: "flex", alignItems: "center", gap: 9, padding: "0 20px", borderRadius: 11,
      background: "var(--primary-fill)", color: "var(--on-primary)", fontSize: 14, fontWeight: 600,
      boxShadow: "var(--sh-sm)", transition: "background .14s",
    });
    expect(emptyBtnSecondary).toEqual({
      height: 42, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", borderRadius: 11,
      border: "1px solid var(--border-2)", background: "var(--surface)", color: "var(--text)",
      fontSize: 14, fontWeight: 600, transition: "background .14s",
    });
  });

  it("los del pie de un diálogo", () => {
    expect(botonDialogoSecundario).toEqual({
      height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid var(--border-2)",
      background: "var(--surface)", color: "var(--text)", fontSize: "13.5px", fontWeight: 600,
    });
    expect(botonDialogoPrimario).toEqual({
      height: 40, padding: "0 18px", borderRadius: 10, background: "var(--primary-fill)",
      color: "var(--on-primary)", fontSize: "13.5px", fontWeight: 600, boxShadow: "var(--sh-sm)",
    });
  });

  it("el de fila de Configuración", () => {
    expect(botonFila).toEqual({
      height: 25, padding: "0 9px", borderRadius: 6, border: "1px solid var(--border-2)",
      background: "var(--surface-2)", color: "var(--text)", fontSize: 11, flex: "0 0 auto",
    });
  });

  it("cada llamada da un objeto nuevo, para que extenderlo no toque a los demás", () => {
    expect(botonSecundario(42)).not.toBe(botonSecundario(42));
  });
});
