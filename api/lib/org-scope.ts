import { eq, or, inArray, and, type SQL } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { orgMembers } from "@db/schema";

/**
 * Multi-firma (organization) visibility helpers.
 *
 * Model: data tables have a nullable `orgId` column.
 * - `orgId IS NULL`  → record is personal (legacy / user has no firm).
 * - `orgId IS SET`   → record belongs to that firm; visible to all firm members.
 *
 * Visibility rule for reads: `userId = me OR orgId IN (my orgs)`.
 * Writes (create): stamp `orgId` from the caller's primary org (if any).
 * Writes (update/delete): scope by the same visibility predicate so members
 * of the same firm can mutate firm data. (See router-level comments for the
 * specific delete policy when stricter rules apply.)
 */

/** Returns the orgIds the user belongs to (0..n). */
export async function getUserOrgIds(userId: number): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId));
  return rows.map((r) => r.orgId);
}

/** Returns the user's primary org id (first one), or null if none. */
export async function getPrimaryOrgId(userId: number): Promise<number | null> {
  const ids = await getUserOrgIds(userId);
  return ids[0] ?? null;
}

/**
 * SQL condition: row is visible to user.
 * Matches when `table.userId = userId` OR `table.orgId IN (orgIds)`.
 *
 * The table must expose `userId` and `orgId` columns (drizzle PgColumn). Caller
 * supplies the columns directly to avoid generic constraints across schemas.
 */
export function visibleToUserCondition(
  userIdCol: any,
  orgIdCol: any,
  userId: number,
  orgIds: number[],
): SQL {
  if (!orgIds || orgIds.length === 0) {
    return eq(userIdCol, userId);
  }
  return or(eq(userIdCol, userId), inArray(orgIdCol, orgIds)) as SQL;
}

/**
 * Same as visibleToUserCondition but combines with an extra predicate via AND.
 * Convenience for the common `and(visibility, extra)` pattern used in routers.
 */
export function visibleAnd(
  userIdCol: any,
  orgIdCol: any,
  userId: number,
  orgIds: number[],
  extra?: SQL | undefined,
): SQL | undefined {
  const vis = visibleToUserCondition(userIdCol, orgIdCol, userId, orgIds);
  if (!extra) return vis;
  return and(vis, extra) as SQL;
}
