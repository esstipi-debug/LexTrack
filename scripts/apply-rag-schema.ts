/**
 * Aplica db/neon-setup.sql contra RAG_DATABASE_URL (Neon u otro Postgres).
 * No pegues la URL en el chat: solo en .env local.
 *
 * Uso: npm run rag:apply-schema
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import pg from "pg";
import { ragPgPoolConfig } from "../api/lib/rag/pg-connect";

function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

function splitStatements(sql: string): string[] {
  const cleaned = stripSqlComments(sql).trim();
  if (!cleaned) return [];
  return cleaned
    .split(/;\s*\n/)
    .map((s) => s.trim().replace(/;\s*$/, ""))
    .filter(Boolean);
}

async function main() {
  const url = process.env.RAG_DATABASE_URL?.trim() || process.env.DATABASE_URL_POSTGRES?.trim();
  if (!url) {
    console.error("Configura RAG_DATABASE_URL en .env (AlloyDB, Neon u otro Postgres).");
    process.exit(1);
  }

  const schemaPath = path.resolve(process.cwd(), "db/neon-setup.sql");
  if (!fs.existsSync(schemaPath)) {
    console.error(`No existe ${schemaPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(schemaPath, "utf8");
  const statements = splitStatements(raw);
  if (statements.length === 0) {
    console.error("neon-setup.sql vacío o sin sentencias reconocibles.");
    process.exit(1);
  }

  const pool = new pg.Pool(ragPgPoolConfig(url));

  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ";";
      console.log(`Ejecutando sentencia ${i + 1}/${statements.length}…`);
      await pool.query(stmt);
    }
    console.log("Esquema RAG aplicado. Siguiente: npm run rag:verify-db");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
