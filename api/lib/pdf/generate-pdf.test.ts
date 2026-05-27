import { describe, expect, it } from "vitest";
import { generatePdf } from "./generate-pdf";

describe("generatePdf", () => {
  it("returns a Buffer with a %PDF header for markdown input", async () => {
    const buf = await generatePdf({
      title: "Acta de Recepción",
      author: "LexTrack",
      body: "# Encabezado\n\nPárrafo de prueba.\n\n- punto uno\n- punto dos",
    });

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("embeds the title in the document metadata stream", async () => {
    const title = "Informe Final Karin 12345";
    const buf = await generatePdf({
      title,
      body: "Cuerpo simple.",
    });

    // pdfkit writes the title into the /Info dict — searchable in raw bytes.
    expect(buf.toString("latin1")).toContain(title);
  });

  it("supports the structured sections shape", async () => {
    const buf = await generatePdf({
      title: "Documento estructurado",
      author: "Abogado X",
      sections: [
        {
          heading: "I. Antecedentes",
          paragraphs: ["Primer párrafo.", "Segundo párrafo."],
          bullets: ["Hecho A", "Hecho B"],
        },
        {
          heading: "II. Conclusiones",
          paragraphs: ["Se concluye que..."],
        },
      ],
    });

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString("ascii")).toBe("%PDF");
    expect(buf.length).toBeGreaterThan(800);
  });
});
