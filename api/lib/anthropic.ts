import { env } from "./env";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type AnthropicMessage = { role: "user" | "assistant"; content: string };

/** Mensajes Sonnet — usar cuando el pipeline RAG (retrieve + rerank) esté listo. */
export async function completeMessages(params: {
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}): Promise<string> {
  const key = env.anthropicApiKey;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const model = env.anthropicModel;
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: params.maxTokens ?? 4096,
      system: params.system,
      messages: params.messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const block = data.content.find((c) => c.type === "text");
  return block?.text ?? "";
}
