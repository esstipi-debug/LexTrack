/**
 * Lee corpus desde MySQL y escribe rag_chunks en Postgres con embeddings Voyage.
 * Requiere: DATABASE_URL (MySQL), RAG_DATABASE_URL (Postgres + pgvector), VOYAGE_API_KEY.
 */
import "dotenv/config";
import pg from "pg";
import { sql } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import { documentosLegales, jurisprudencias } from "../db/schema";
import { embedTexts } from "../api/lib/voyage";
import { normaSource } from "../api/lib/rag/chunks";
import { ragPgPoolConfig } from "../api/lib/rag/pg-connect";

const BATCH = 24;

async function upsertChunk(
  pool: pg.Pool,
  row: {
    id: string;
    source: string;
    titulo: string | null;
    norma: string | null;
    articulo: string | null;
    rol: string | null;
    tribunal: string | null;
    fecha: string | null;
    contenido: string;
    embedding: number[];
  }
) {
  const vec = `[${row.embedding.join(",")}]`;
  await pool.query(
    `INSERT INTO rag_chunks (
      id, source, titulo, norma, articulo, rol, tribunal, fecha, contenido, contenido_normalizado, metadata, embedding
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::vector)
    ON CONFLICT (id) DO UPDATE SET
      source = EXCLUDED.source,
      titulo = EXCLUDED.titulo,
      norma = EXCLUDED.norma,
      articulo = EXCLUDED.articulo,
      rol = EXCLUDED.rol,
      tribunal = EXCLUDED.tribunal,
      fecha = EXCLUDED.fecha,
      contenido = EXCLUDED.contenido,
      contenido_normalizado = EXCLUDED.contenido_normalizado,
      metadata = EXCLUDED.metadata,
      embedding = EXCLUDED.embedding`,
    [
      row.id,
      row.source,
      row.titulo,
      row.norma,
      row.articulo,
      row.rol,
      row.tribunal,
      row.fecha,
      row.contenido,
      row.contenido.toLowerCase(),
      null,
      vec,
    ]
  );
}

async function main() {
  const ragUrl = process.env.RAG_DATABASE_URL || process.env.DATABASE_URL_POSTGRES;
  if (!ragUrl?.trim()) {
    throw new Error("Set RAG_DATABASE_URL (Postgres) before ingesting.");
  }
  if (!process.env.VOYAGE_API_KEY?.trim()) {
    throw new Error("Set VOYAGE_API_KEY.");
  }

  const mysql = getDb();
  const pool = new pg.Pool(ragPgPoolConfig(ragUrl));

  try {
    await pool.query(`SELECT 1 FROM rag_chunks LIMIT 1`);
  } catch {
    console.error("Tabla rag_chunks no existe. Ejecuta db/migrations-rag/0000_rag_chunks.sql contra Postgres.");
    process.exit(1);
  }

  const docs = await mysql.select().from(documentosLegales).where(sql`${documentosLegales.estaActiva} = 1`);
  console.log(`Documentos legales: ${docs.length}`);

  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    const texts = slice.map((d) => `${d.titulo}\n${d.contenido}`.slice(0, 32000));
    const embeddings = await embedTexts(texts, "document");
    for (let j = 0; j < slice.length; j++) {
      const d = slice[j]!;
      const emb = embeddings[j]!;
      await upsertChunk(pool, {
        id: `dl-${d.id}`,
        source: normaSource(d.norma),
        titulo: d.titulo,
        norma: d.norma,
        articulo: d.articulo,
        rol: null,
        tribunal: null,
        fecha: null,
        contenido: d.contenido,
        embedding: emb,
      });
    }
    console.log(`  ingestidos documentos ${Math.min(i + BATCH, docs.length)}/${docs.length}`);
  }

  const juris = await mysql.select().from(jurisprudencias).where(sql`${jurisprudencias.estaActiva} = 1`);
  console.log(`Jurisprudencia: ${juris.length}`);

  for (let i = 0; i < juris.length; i += BATCH) {
    const slice = juris.slice(i, i + BATCH);
    const texts = slice.map((j) =>
      `${j.caratula || ""}\n${j.extracto || ""}\n${j.contenido}`.slice(0, 32000)
    );
    const embeddings = await embedTexts(texts, "document");
    for (let j = 0; j < slice.length; j++) {
      const row = slice[j]!;
      const emb = embeddings[j]!;
      await upsertChunk(pool, {
        id: `j-${row.id}`,
        source: "jurisprudencia",
        titulo: row.caratula,
        norma: null,
        articulo: null,
        rol: row.rit,
        tribunal: row.tribunal,
        fecha: row.fechaSentencia ? String(row.fechaSentencia) : null,
        contenido: row.contenido,
        embedding: emb,
      });
    }
    console.log(`  ingestidos fallos ${Math.min(i + BATCH, juris.length)}/${juris.length}`);
  }

  await pool.end();
  console.log("Listo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
