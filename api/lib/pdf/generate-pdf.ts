/**
 * PDF generation using pdfkit.
 *
 * Two input shapes are supported:
 *   1. { title, body }                — body is plaintext or simple markdown
 *      (headings `#`/`##`, bullets `-`/`*`, blank-line paragraphs).
 *   2. { title, sections: [...] }     — pre-structured content. Each section
 *      has a heading + paragraphs (and optional bullet list).
 *
 * Output: Promise<Buffer> with the rendered PDF. pdfkit streams chunks,
 * we collect them and resolve once `end` fires — never blocks the loop.
 *
 * The header carries the title (bold), author (if any) and ISO date.
 * The footer carries page numbers and "Generado por LexTrack".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import PDFDocument from "pdfkit";

export interface PdfSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface GeneratePdfStructuredInput {
  title: string;
  author?: string;
  sections: PdfSection[];
}

export interface GeneratePdfMarkdownInput {
  title: string;
  body: string;
  author?: string;
}

export type GeneratePdfInput = GeneratePdfStructuredInput | GeneratePdfMarkdownInput;

function isStructured(i: GeneratePdfInput): i is GeneratePdfStructuredInput {
  return Array.isArray((i as GeneratePdfStructuredInput).sections);
}

/** Very small markdown-ish tokenizer. Avoids pulling a full parser. */
function tokenizeMarkdown(body: string): Array<
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "p"; text: string }
  | { kind: "blank" }
> {
  const out: ReturnType<typeof tokenizeMarkdown> = [];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      out.push({ kind: "blank" });
      continue;
    }
    if (line.startsWith("### ")) {
      out.push({ kind: "h3", text: line.slice(4).trim() });
    } else if (line.startsWith("## ")) {
      out.push({ kind: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("# ")) {
      out.push({ kind: "h1", text: line.slice(2).trim() });
    } else if (/^[-*]\s+/.test(line)) {
      out.push({ kind: "bullet", text: line.replace(/^[-*]\s+/, "").trim() });
    } else {
      out.push({ kind: "p", text: line });
    }
  }
  return out;
}

export async function generatePdf(input: GeneratePdfInput): Promise<Buffer> {
  const { title, author } = input;
  const isoDate = new Date().toISOString().slice(0, 10);

  return await new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 72, bottom: 60, left: 60, right: 60 },
        info: {
          Title: title,
          Author: author || "LexTrack",
          Producer: "LexTrack",
          CreationDate: new Date(),
        },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc.fontSize(18).font("Helvetica-Bold").text(title, { align: "left" });
      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#666")
        .text(`${author ? author + " · " : ""}${isoDate}`, { align: "left" });
      doc.moveDown(0.8);
      doc
        .strokeColor("#ccc")
        .lineWidth(0.5)
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke();
      doc.moveDown(0.6);
      doc.fillColor("#000");

      // Body
      if (isStructured(input)) {
        for (const sec of input.sections) {
          doc.font("Helvetica-Bold").fontSize(13).text(sec.heading);
          doc.moveDown(0.3);
          doc.font("Helvetica").fontSize(11);
          for (const p of sec.paragraphs ?? []) {
            doc.text(p, { align: "left" });
            doc.moveDown(0.4);
          }
          for (const b of sec.bullets ?? []) {
            doc.text(`• ${b}`, { indent: 12 });
          }
          doc.moveDown(0.6);
        }
      } else {
        const tokens = tokenizeMarkdown(input.body);
        for (const tok of tokens) {
          switch (tok.kind) {
            case "h1":
              doc.font("Helvetica-Bold").fontSize(16).text(tok.text);
              doc.moveDown(0.3);
              break;
            case "h2":
              doc.font("Helvetica-Bold").fontSize(13).text(tok.text);
              doc.moveDown(0.25);
              break;
            case "h3":
              doc.font("Helvetica-Bold").fontSize(11).text(tok.text);
              doc.moveDown(0.2);
              break;
            case "bullet":
              doc.font("Helvetica").fontSize(11).text(`• ${tok.text}`, { indent: 12 });
              break;
            case "p":
              doc.font("Helvetica").fontSize(11).text(tok.text, { align: "left" });
              doc.moveDown(0.2);
              break;
            case "blank":
              doc.moveDown(0.4);
              break;
          }
        }
      }

      // Footer: page numbers on every page
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const bottom = doc.page.height - 40;
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#888")
          .text(
            `Generado por LexTrack · página ${i + 1} de ${range.count}`,
            doc.page.margins.left,
            bottom,
            {
              width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
              align: "center",
              lineBreak: false,
            },
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
