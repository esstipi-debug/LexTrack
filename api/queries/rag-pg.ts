import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as ragSchema from "../../db/schema-rag";
import { env } from "../lib/env";
import { ragPgPoolConfig } from "../lib/rag/pg-connect";

let pool: pg.Pool | null = null;

/** Pool Postgres opcional (RAG). Sin `RAG_DATABASE_URL` devuelve null. */
export function getRagPool(): pg.Pool | null {
  const url = env.ragDatabaseUrl;
  if (!url?.trim()) return null;
  if (!pool) {
    pool = new pg.Pool(ragPgPoolConfig(url));
  }
  return pool;
}

export function getRagDb() {
  const p = getRagPool();
  if (!p) return null;
  return drizzle(p, { schema: ragSchema });
}
