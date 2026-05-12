import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  kimiAuthUrl: required("KIMI_AUTH_URL"),
  kimiOpenUrl: required("KIMI_OPEN_URL"),
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
  /** RAG / LLM (opcional hasta conectar pipeline híbrido) */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
  voyageApiKey: process.env.VOYAGE_API_KEY ?? "",
  voyageEmbedModel: process.env.VOYAGE_EMBED_MODEL ?? "voyage-law-2",
  cohereApiKey: process.env.COHERE_API_KEY ?? "",
  cohereRerankModel: process.env.COHERE_RERANK_MODEL ?? "rerank-multilingual-v3.0",
};
