import { env } from "./env";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type AnthropicMessage = { role: "user" | "assistant"; content: string | AnthropicContent[] };

export type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicResponse {
  content: AnthropicContent[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens";
  usage: { input_tokens: number; output_tokens: number };
}

export async function completeMessages(params: {
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  tools?: AnthropicTool[];
}): Promise<string> {
  const data = await rawComplete(params);
  const block = data.content.find((c) => c.type === "text") as { type: "text"; text: string } | undefined;
  return block?.text ?? "";
}

export async function rawComplete(params: {
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  tools?: AnthropicTool[];
}): Promise<AnthropicResponse> {
  const key = env.anthropicApiKey;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const model = env.anthropicModel;
  const body: Record<string, unknown> = {
    model,
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: params.messages,
  };
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools;
  }
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await res.text();
    throw new Error(`Anthropic API error ${res.status}`);
  }
  return (await res.json()) as AnthropicResponse;
}
