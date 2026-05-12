import { describe, expect, it } from "vitest";
import {
  articuloFieldMatchesRef,
  extractArticleRefsFromQuery,
  normalizeArticuloLabel,
} from "./query-intent";

describe("extractArticleRefsFromQuery", () => {
  it("detecta artículo simple", () => {
    expect(extractArticleRefsFromQuery("¿Qué dice el art 162 sobre despido?")).toContain("162");
  });

  it("detecta artículo con bis", () => {
    expect(extractArticleRefsFromQuery("aplicar artículo 168 bis del CT")).toContain("168 bis");
  });

  it("deduplica", () => {
    const r = extractArticleRefsFromQuery("art 40 y artículo 40");
    expect(r.filter((x) => x === "40").length).toBe(1);
  });
});

describe("articuloFieldMatchesRef", () => {
  it("empareja Art. 162 con ref 162", () => {
    expect(articuloFieldMatchesRef("Art. 162", "162")).toBe(true);
  });
});

describe("normalizeArticuloLabel", () => {
  it("quita tildes y art.", () => {
    expect(normalizeArticuloLabel("Art. 163 bis")).toBe("163 bis");
  });
});
