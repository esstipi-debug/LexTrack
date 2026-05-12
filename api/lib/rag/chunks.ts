import type { DocumentoLegal, Jurisprudencia } from "@db/schema";
import type { ChunkSource, RetrievedChunk } from "./citations";
import { normalizeArticuloLabel } from "./query-intent";

export function normaSource(norma: string | null | undefined): ChunkSource {
  const n = (norma || "").toLowerCase();
  if (n.includes("codigo del trabajo") || n.includes("código del trabajo")) return "CT";
  return "ley_especial";
}

/** Formato de cita en respuesta; `verifyCitations` reconoce [Art. N …]. */
export function formatLegalCitation(d: DocumentoLegal): string {
  const n = citationArticleLabel(d.articulo);
  return normaSource(d.norma) === "CT" ? `[Art. ${n} CT]` : `[Art. ${n}]`;
}

/** Número tal como debe aparecer en corchetes [Art. X CT]. */
export function citationArticleLabel(articulo: string | null | undefined): string {
  if (!articulo?.trim()) return "?";
  const m = articulo.match(/(\d+(?:\s*bis|\s*ter|\s*quater)?)/i);
  return m ? normalizeArticuloLabel(m[1]) : "?";
}

export function rowsToRetrievedChunks(
  docs: DocumentoLegal[],
  juris: Jurisprudencia[]
): RetrievedChunk[] {
  const out: RetrievedChunk[] = [];
  for (const d of docs) {
    out.push({
      id: `dl-${d.id}`,
      source: normaSource(d.norma),
      articulo: d.articulo,
      contenido: d.contenido,
      norma: d.norma,
      titulo: d.titulo,
    });
  }
  for (const j of juris) {
    out.push({
      id: `j-${j.id}`,
      source: "jurisprudencia",
      rol: j.rit,
      tribunal: j.tribunal,
      contenido: j.contenido,
      caratula: j.caratula,
      fecha: j.fechaSentencia ? String(j.fechaSentencia) : undefined,
    });
  }
  return out;
}
