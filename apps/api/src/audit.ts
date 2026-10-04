import type { Prisma, PrismaClient } from "@proven/db";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditEntry {
  actorType: "user" | "issuer" | "admin" | "system";
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ip?: string | null;
}

/** Appends one row to audit_logs (append-only, enforced by a DB trigger). Never log secrets or file contents. */
export async function audit(db: Db, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
      ip: entry.ip ?? null,
    },
  });
}
