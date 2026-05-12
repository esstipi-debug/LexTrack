import { env } from "./env";

const VOYAGE_EMBED_URL = "https://api.voyageai.com/v1/embeddings";

/** Embeddings legales — modelo objetivo: voyage-law-2 (dim 1024). */
export async function embedTexts(texts: string[], inputType: "document" | "query" = "document"): Promise<number[][]> {
  const key = env.voyageApiKey;
  if (!key) {
    throw new Error("VOYAGE_API_KEY is not set");
  }
  const model = env.voyageEmbedModel;
  const res = await fetch(VOYAGE_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ input: texts, model, input_type: inputType }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage embeddings failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data.map((d) => d.embedding);
}
