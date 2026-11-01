import { headers } from "next/headers";
import { auditLogs, db, type DbExecutor } from "@/db";

/**
 * The audit trail, ported from App\Support\AuditLogger: who did what to which record,
 * from which IP and browser. A customer's own actions (placing an order) have no staff
 * actor; work done outside a request (the worker) has no IP either.
 */
export async function auditLog(options: {
  action: string;
  auditable: { type: string; id: number };
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  userId?: number | null;
  branchId?: number | null;
  executor?: DbExecutor;
}): Promise<void> {
  const { action, auditable, oldValues = {}, newValues = {}, userId = null, branchId = null, executor = db } = options;
  const request = await requestDetails();
  const now = new Date();

  await executor.insert(auditLogs).values({
    userId,
    branchId,
    action,
    auditableType: auditable.type,
    auditableId: auditable.id,
    oldValues: Object.keys(oldValues).length ? oldValues : null,
    newValues: Object.keys(newValues).length ? newValues : null,
    ipAddress: request.ip,
    userAgent: request.userAgent,
    createdAt: now,
    updatedAt: now,
  });
}

/** Laravel's Request::ip() and userAgent(), or nulls outside a request. */
async function requestDetails(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const list = await headers();
    const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || null;

    // the column holds 255 characters; Laravel failed on a longer user agent
    return { ip: ip?.slice(0, 45) ?? null, userAgent: list.get("user-agent")?.slice(0, 255) ?? null };
  } catch {
    return { ip: null, userAgent: null };
  }
}
