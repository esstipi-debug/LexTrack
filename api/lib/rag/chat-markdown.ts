import type { RetrievedChunk } from "./citations";
import { citationArticleLabel, normaSource } from "./chunks";

function formatLegalCitationFields(articulo: string | null | undefined, norma: string | null | undefined): string {
  const n = citationArticleLabel(articulo);
  return normaSource(norma) === "CT" ? `[Art. ${n} CT]` : `[Art. ${n}]`;
}

/** Respuesta tipo plantilla (sin LLM) a partir de chunks recuperados. */
export function renderChatMarkdownFromChunks(chunks: RetrievedChunk[]): {
  markdown: string;
  fuentes: string[];
} {
  const fuentes: string[] = [];
  const normativa = chunks.filter((c) => c.source === "CT" || c.source === "ley_especial");
  const juris = chunks.filter((c) => c.source === "jurisprudencia");

  if (normativa.length === 0 && juris.length === 0) {
    return { markdown: "", fuentes: [] };
  }

  let md = `**Análisis normativo:**\n\n`;

  if (normativa.length > 0) {
    md += `**Normativa aplicable:**\n\n`;
    normativa.forEach((d, i) => {
      const contenido =
        d.contenido.length > 500 ? d.contenido.substring(0, 500) + "..." : d.contenido;
      const titulo = d.articulo || d.titulo || "Norma";
      const cite = formatLegalCitationFields(d.articulo, d.norma);
      md += `${i + 1}. **${titulo}** (${d.norma || "—"})\n${contenido}\nCita: ${cite}\n\n`;
      fuentes.push(`${d.norma || "—"} — ${d.articulo || d.titulo || ""}`);
    });
  }

  if (juris.length > 0) {
    md += `**Jurisprudencia relevante:**\n\n`;
    juris.forEach((j, i) => {
      const extracto =
        j.contenido.length > 300 ? j.contenido.substring(0, 300) + "..." : j.contenido;
      const rit = j.rol?.trim();
      const fecha = j.fecha ? String(j.fecha) : "s/fecha";
      const tribunal = j.tribunal || "Tribunal";
      const header = j.caratula || j.rol || "Sentencia";
      md += `${i + 1}. **${header}** — ${tribunal}\n${extracto}\n`;
      if (rit) {
        md += `Cita: [Rol N° ${rit} / ${tribunal} / ${fecha}]\n\n`;
        fuentes.push(`Fallo: ${rit}`);
      } else {
        md += "\n";
        fuentes.push(`Fallo: ${header}`);
      }
    });
  }

  md += `---\n*Esta información es orientativa. Verifica siempre las fuentes oficiales en www.leychile.cl*`;
  return { markdown: md, fuentes };
}
