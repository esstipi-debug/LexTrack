import { env } from "./env";

const COHERE_RERANK_URL = "https://api.cohere.ai/v1/rerank";

export async function rerankDocuments(params: {
  query: string;
  documents: string[];
  topN: number;
}): Promise<number[]> {
  const key = env.cohereApiKey;
  if (!key) {
    throw new Error("COHERE_API_KEY is not set");
  }
  const model = env.cohereRerankModel;
  const res = await fetch(COHERE_RERANK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      query: params.query,
      documents: params.documents,
      top_n: params.topN,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cohere rerank failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { results: { index: number }[] };
  return data.results.map((r) => r.index);
}
