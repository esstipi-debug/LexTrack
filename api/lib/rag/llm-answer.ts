import { completeMessages } from "../anthropic";
import type { RetrievedChunk } from "./citations";

/** Genera respuesta con Claude usando solo fragmentos recuperados. */
export async function answerWithClaude(userQuery: string, chunks: RetrievedChunk[]): Promise<string> {
  const ctx = chunks
    .map(
      (c, i) =>
        `--- Fragmento ${i + 1} (id=${c.id}, fuente=${c.source}) ---\n${c.contenido.slice(0, 3500)}`
    )
    .join("\n\n");

  const system = `Eres LexTrack, asistente para abogados laboralistas en Chile.
Responde en español usando únicamente el contenido entre <contexto> y </contexto>.
Toda afirmación jurídica debe incluir cita breve: [Art. N CT] para normas del Código del Trabajo, [Art. N] para otras leyes, y [Rol N° X / tribunal / fecha] si citas jurisprudencia presente en el contexto.
Si el contexto no alcanza para responder con respaldo normativo, dilo sin inventar fuentes.`;

  return completeMessages({
    system,
    messages: [
      {
        role: "user",
        content: `<contexto>\n${ctx}\n</contexto>\n\nPregunta del usuario:\n${userQuery}`,
      },
    ],
    maxTokens: 4096,
  });
}
