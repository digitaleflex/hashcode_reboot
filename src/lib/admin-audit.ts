import { db } from "./db";

export type AuditActor =
  | { type: "admin"; role: string }
  | { type: "system" }
  | { type: "ip"; ip: string };

/**
 * Record an admin action in the AuditLog.
 * Never throws — fails silently to avoid breaking the main flow.
 */
export async function audit(
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  actor?: AuditActor,
): Promise<void> {
  try {
    const actorStr = actor
      ? actor.type === "admin"
        ? `admin:${actor.role}`
        : actor.type === "ip"
          ? `ip:${actor.ip}`
          : "system"
      : null;

    await db.auditLog.create({
      data: {
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        actor: actorStr,
      },
    });
  } catch {
    // Never break the flow
  }
}