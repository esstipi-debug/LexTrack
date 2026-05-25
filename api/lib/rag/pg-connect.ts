import type { PoolConfig } from "pg";

/** Opciones de pool para Postgres RAG (Neon, AlloyDB, Cloud SQL, Docker). */
export function ragPgPoolConfig(connectionString: string): PoolConfig {
  const url = connectionString.trim();
  const needsSsl =
    /sslmode=(require|verify-ca|verify-full)/i.test(url) ||
    url.includes("neon.tech") ||
    /\.alloydb|alloydb-psc\.goog/i.test(url);

  return {
    connectionString: url,
    max: 10,
    // Certificados gestionados por Google/Neon suelen requerir esto en Node.
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  };
}
