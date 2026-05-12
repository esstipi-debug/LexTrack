import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.RAG_DATABASE_URL || process.env.DATABASE_URL_POSTGRES;
if (!url) {
  console.warn("drizzle.rag.config: set RAG_DATABASE_URL for Postgres RAG introspection/migrations.");
}

export default defineConfig({
  schema: "./db/schema-rag.ts",
  out: "./db/migrations-rag-drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: url ?? "postgresql://lextrack:lextrack@localhost:5432/lextrack",
  },
});
