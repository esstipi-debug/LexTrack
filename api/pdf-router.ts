import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { documentos } from "@db/schema";
import { generatePdf } from "./lib/pdf/generate-pdf";

const TIPO = z.enum([
  "generico",
  "karin-acta",
  "karin-informe",
  "karin-medidas",
  "karin-protocolo",
  "cobranza-carta",
  "generador",
]);

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50) || "documento";
}

function buildFilename(tipo: string, idOrTitle: string | number): string {
  const date = new Date().toISOString().slice(0, 10);
  const tail = typeof idOrTitle === "number" ? String(idOrTitle) : slug(idOrTitle);
  return `${slug(tipo)}-${tail}-${date}.pdf`;
}

export const pdfRouter = createRouter({
  /**
   * Render a PDF from inline content or by looking up a persisted `documentos`
   * row owned by the caller. Returns base64 to stay tRPC-friendly; the client
   * turns it back into a Blob for download.
   */
  exportDocumento: authedQuery
    .input(
      z.object({
        tipo: TIPO.default("generico"),
        documentoId: z.number().int().positive().optional(),
        contenido: z
          .object({
            title: z.string().min(1),
            body: z.string().min(1),
            author: z.string().optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      let title: string;
      let body: string;
      let author: string | undefined;
      let filenameKey: string | number;

      if (input.documentoId) {
        const db = getDb();
        const [row] = await db
          .select()
          .from(documentos)
          .where(
            and(
              eq(documentos.id, input.documentoId),
              eq(documentos.userId, ctx.user.id),
            ),
          );
        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Documento ${input.documentoId} no encontrado`,
          });
        }
        title = row.titulo;
        body = row.contenido || "(Sin contenido)";
        author = ctx.user.email || undefined;
        filenameKey = row.id;
      } else if (input.contenido) {
        title = input.contenido.title;
        body = input.contenido.body;
        author = input.contenido.author || ctx.user.email || undefined;
        filenameKey = title;
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debe entregar documentoId o contenido",
        });
      }

      const buf = await generatePdf({ title, body, author });
      const base64 = buf.toString("base64");
      const filename = buildFilename(input.tipo, filenameKey);

      return {
        filename,
        base64,
        mimeType: "application/pdf",
        bytes: buf.length,
      };
    }),
});
