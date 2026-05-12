/**
 * Comprueba que RAG_DATABASE_URL apunta a Postgres con pgvector y tabla rag_chunks.
 * Uso: configurar .env y ejecutar `npm run rag:verify-db`
 */
import "dotenv/config";
import pg from "pg";

async function main() {
  const url = process.env.RAG_DATABASE_URL?.trim() || process.env.DATABASE_URL_POSTGRES?.trim();
  if (!url) {
    console.error("Falta RAG_DATABASE_URL en .env");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes("neon.tech") ? { rejectUnauthorized: true } : undefined,
  });

  try {
    const ext = await pool.query<{ extname: string }>(
      `SELECT extname FROM pg_extension WHERE extname IN ('vector')`
    );
    if (ext.rows.length === 0) {
      console.error("La extensión `vector` no está instalada. Ejecuta db/neon-setup.sql en Neon.");
      process.exit(1);
    }
    console.log("OK extensión: vector");

    const tbl = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'rag_chunks'
      ) AS exists`
    );
    if (!tbl.rows[0]?.exists) {
      console.error("La tabla `rag_chunks` no existe. Ejecuta db/neon-setup.sql.");
      process.exit(1);
    }
    console.log("OK tabla: rag_chunks");

    const cnt = await pool.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM rag_chunks");
    console.log(`Filas en rag_chunks: ${cnt.rows[0]?.n ?? "0"}`);
    console.log("\nSiguiente paso con datos MySQL + VOYAGE_API_KEY: npm run rag:ingest");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
