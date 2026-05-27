import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";

export async function findUserByUnionId(unionId: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.unionId, unionId))
    .limit(1);
  return rows.at(0);
}

export async function upsertUser(data: InsertUser): Promise<{ user: typeof schema.users.$inferSelect; isNew: boolean }> {
  const values = { ...data };
  const updateSet: Partial<InsertUser> = {
    lastSignInAt: new Date(),
    ...data,
  };

  if (
    values.role === undefined &&
    values.unionId &&
    values.unionId === env.ownerUnionId
  ) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  // Detect new vs existing via prior lookup — simpler and DB-portable
  // than relying on RETURNING + xmax tricks.
  const prior = values.unionId
    ? await getDb()
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.unionId, values.unionId))
        .limit(1)
    : [];
  const isNew = prior.length === 0;

  const [user] = await getDb()
    .insert(schema.users)
    .values(values)
    .onConflictDoUpdate({ target: schema.users.unionId, set: updateSet })
    .returning();

  return { user, isNew };
}
