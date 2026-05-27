import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let pool: pg.Pool | undefined;
let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    pool = new pg.Pool({ connectionString: env.databaseUrl });
    instance = drizzle(pool, { schema: fullSchema });
  }
  return instance;
}
