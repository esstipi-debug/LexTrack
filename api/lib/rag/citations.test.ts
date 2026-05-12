import { describe, expect, it } from "vitest";
import { verifyCitations, type RetrievedChunk } from "./citations";

const ct162: RetrievedChunk = {
  id: "1",
  source: "CT",
  articulo: "Art. 162",
  contenido: "Texto del artículo 162…",
};

describe("verifyCitations", () => {
  it("acepta cita que coincide con chunk CT", () => {
    const r = verifyCitations("La norma indica requisitos [Art. 162 CT].", [ct162]);
    expect(r.ok).toBe(true);
  });

  it("rechaza artículo inventado", () => {
    const r = verifyCitations("Ver [Art. 99999 CT].", [ct162]);
    expect(r.ok).toBe(false);
    expect(r.invalidArticles.length).toBeGreaterThan(0);
  });

  it("acepta [Art. 162] sin sufijo CT", () => {
    const r = verifyCitations("Según [Art. 162].", [ct162]);
    expect(r.ok).toBe(true);
  });

  it("valida rol de jurisprudencia", () => {
    const j: RetrievedChunk = {
      id: "j1",
      source: "jurisprudencia",
      rol: "C-1234-2023",
      contenido: "Considerando que…",
    };
    const ok = verifyCitations("Véase [Rol N° C-1234-2023 / CS / 2024].", [j]);
    expect(ok.ok).toBe(true);
  });
});
