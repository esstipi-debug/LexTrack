import { getDb } from "../queries/connection";
import { auditLog } from "@db/schema";

// Lightweight error logger — avoid importing the shared pino-based logger here
// because audit() is imported from many routers and we want to keep the
// dependency graph (and test import cost) minimal.
function logAuditError(err: unknown, action: string, tableName: string): void {
  // eslint-disable-next-line no-console
  console.error("[audit] failed (non-fatal)", { err: String(err), action, tableName });
}

export interface AuditParams {
  userId: number | null;
  action: string; // "table.verb" — e.g. "causa.create"
  tableName: string;
  recordId?: string | number | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Insert a single audit log row. Errors are caught and logged (non-fatal):
 * audit failures must never break the actual mutation that triggered them.
 */
export async function audit(params: AuditParams): Promise<void> {
  try {
    const db = getDb();
    await db.insert(auditLog).values({
      userId: params.userId,
      action: params.action,
      tableName: params.tableName,
      recordId:
        params.recordId != null && params.recordId !== ""
          ? String(params.recordId)
          : null,
      before: (params.before as object | null | undefined) ?? null,
      after: (params.after as object | null | undefined) ?? null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    });
  } catch (err) {
    logAuditError(err, params.action, params.tableName);
  }
}

/** Convenience helper extracting userId/ip/userAgent from a tRPC ctx. */
export async function auditFromCtx(
  ctx: {
    user?: { id: number } | null;
    ip?: string | null;
    userAgent?: string | null;
  },
  params: Omit<AuditParams, "userId" | "ip" | "userAgent">
): Promise<void> {
  return audit({
    userId: ctx.user?.id ?? null,
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent ?? null,
    ...params,
  });
}
