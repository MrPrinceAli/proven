import type { EntityType, Prisma, PrismaClient } from "@proven/db";
import { SkillLevel } from "@proven/db";
import { z } from "zod";

type Db = PrismaClient | Prisma.TransactionClient;

/** Fields every claim row shares. */
export interface ClaimRow {
  id: string;
  userId: string;
  status: string;
  createdAt: Date;
  [field: string]: unknown;
}

/** Narrow, uniform view over the five Prisma claim delegates. */
interface ClaimDelegate {
  findMany(args: { where: { userId: string }; orderBy: { createdAt: "asc" } }): Promise<ClaimRow[]>;
  findFirst(args: { where: { id: string; userId: string } }): Promise<ClaimRow | null>;
  findUnique(args: { where: { id: string } }): Promise<ClaimRow | null>;
  create(args: { data: Record<string, unknown> }): Promise<ClaimRow>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<ClaimRow>;
  delete(args: { where: { id: string } }): Promise<ClaimRow>;
}

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "invalid date")
  .nullish()
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

const SkillInput = z.object({ name: text(80), level: SkillLevel.nullish() }).strict();
const ExperienceInput = z
  .object({
    title: text(120),
    org: text(120),
    startDate: isoDate,
    endDate: isoDate,
    description: optionalText(2000),
  })
  .strict();
const ProjectInput = z
  .object({
    name: text(120),
    url: z
      .string()
      .trim()
      .url()
      .refine((u) => /^https?:\/\//.test(u), "url must be http(s)")
      .nullish()
      .transform((v) => v ?? null),
    description: optionalText(2000),
  })
  .strict();
const AchievementInput = z
  .object({
    title: text(160),
    event: optionalText(160),
    year: z.number().int().min(1950).max(2100).nullish(),
  })
  .strict();
const CommunityInput = z.object({ community: text(120), role: optionalText(120) }).strict();

const endAfterStart = (v: { startDate?: Date | null; endDate?: Date | null }) =>
  !v.startDate || !v.endDate || v.endDate >= v.startDate;

const ymd = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : null);

export interface ClaimKind {
  type: EntityType;
  /** Path segment under /me. */
  path: string;
  delegate(db: Db): ClaimDelegate;
  create: z.ZodType<Record<string, unknown>>;
  update: z.ZodType<Record<string, unknown>>;
  /** Public JSON fields (status and ids are added by the caller). */
  fields(row: ClaimRow): Record<string, unknown>;
  /** Short human label, used in audit logs and the issuer queue later. */
  label(row: ClaimRow): string;
}

const asDelegate = (d: unknown) => d as ClaimDelegate;

export const CLAIM_KINDS: Record<EntityType, ClaimKind> = {
  skill: {
    type: "skill",
    path: "skills",
    delegate: (db) => asDelegate(db.skill),
    create: SkillInput,
    update: SkillInput.partial(),
    fields: (r) => ({ name: r.name, level: r.level ?? null }),
    label: (r) => String(r.name),
  },
  experience: {
    type: "experience",
    path: "experiences",
    delegate: (db) => asDelegate(db.experience),
    create: ExperienceInput.refine(endAfterStart, { message: "endDate must not be before startDate" }),
    update: ExperienceInput.partial().refine(endAfterStart, {
      message: "endDate must not be before startDate",
    }),
    fields: (r) => ({
      title: r.title,
      org: r.org,
      startDate: ymd(r.startDate),
      endDate: ymd(r.endDate),
      description: r.description ?? null,
    }),
    label: (r) => `${r.title} — ${r.org}`,
  },
  project: {
    type: "project",
    path: "projects",
    delegate: (db) => asDelegate(db.project),
    create: ProjectInput,
    update: ProjectInput.partial(),
    fields: (r) => ({ name: r.name, url: r.url ?? null, description: r.description ?? null }),
    label: (r) => String(r.name),
  },
  achievement: {
    type: "achievement",
    path: "achievements",
    delegate: (db) => asDelegate(db.achievement),
    create: AchievementInput,
    update: AchievementInput.partial(),
    fields: (r) => ({ title: r.title, event: r.event ?? null, year: r.year ?? null }),
    label: (r) => String(r.title),
  },
  community_role: {
    type: "community_role",
    path: "community",
    delegate: (db) => asDelegate(db.communityRole),
    create: CommunityInput,
    update: CommunityInput.partial(),
    fields: (r) => ({ community: r.community, role: r.role ?? null }),
    label: (r) => (r.role ? `${r.role} — ${r.community}` : String(r.community)),
  },
};

export const CLAIM_KIND_LIST = Object.values(CLAIM_KINDS);

/** Evidence ids linked to each entity id. */
export async function linkedEvidence(db: Db, type: EntityType, entityIds: string[]) {
  const map = new Map<string, string[]>();
  if (entityIds.length === 0) return map;
  const links = await db.evidenceLink.findMany({
    where: { entityType: type, entityId: { in: entityIds } },
    select: { entityId: true, evidenceId: true },
  });
  for (const link of links) {
    map.set(link.entityId, [...(map.get(link.entityId) ?? []), link.evidenceId]);
  }
  return map;
}

export function serializeClaim(kind: ClaimKind, row: ClaimRow, evidenceIds: string[]) {
  return {
    id: row.id,
    entityType: kind.type,
    ...kind.fields(row),
    status: row.status,
    evidenceIds,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * §S4 transitions driven by evidence links: UNVERIFIED ⇄ EVIDENCE_ATTACHED only.
 * PENDING_ISSUER / VERIFIED / EXPIRED / REVOKED are never changed by linking or unlinking.
 */
export function statusAfterLinkChange(current: string, linkedCount: number): string {
  if (current === "UNVERIFIED" && linkedCount > 0) return "EVIDENCE_ATTACHED";
  if (current === "EVIDENCE_ATTACHED" && linkedCount === 0) return "UNVERIFIED";
  return current;
}

/** Recomputes an entity's status from its current link count; returns the new status. */
export async function syncClaimStatus(db: Db, kind: ClaimKind, entityId: string): Promise<string | null> {
  const entity = await kind.delegate(db).findUnique({ where: { id: entityId } });
  if (!entity) return null;
  const linkedCount = await db.evidenceLink.count({ where: { entityType: kind.type, entityId } });
  const next = statusAfterLinkChange(entity.status, linkedCount);
  const data: Record<string, unknown> = {};
  if (next !== entity.status) data.status = next;
  if (kind.type === "skill") {
    // skills.evidence_ids (DDL) mirrors evidence_links for skills.
    const links = await db.evidenceLink.findMany({
      where: { entityType: "skill", entityId },
      select: { evidenceId: true },
    });
    data.evidenceIds = links.map((l) => l.evidenceId);
  }
  if (Object.keys(data).length > 0) await kind.delegate(db).update({ where: { id: entityId }, data });
  return next;
}
