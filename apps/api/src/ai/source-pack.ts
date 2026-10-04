import { EntityType, type Prisma, type PrismaClient } from "@proven/db";
import type { ClaimFact, SourceItem, SourcePack } from "@proven/ai";
import { CLAIM_KIND_LIST, CLAIM_KINDS } from "../claims";

type Db = PrismaClient | Prisma.TransactionClient;

const claimSourceId = (type: string, id: string) => `${type}:${id}`;
const evidenceSourceId = (id: string) => `evidence:${id}`;

const describe = (fields: Record<string, unknown>) =>
  Object.entries(fields)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("\n");

/**
 * Collects ONLY this user's data (closed retrieval, §S10.2): profile, the five claim kinds and evidence
 * metadata. Evidence file contents are not extracted in the MVP (D-027).
 */
export async function buildSourcePack(db: Db, userId: string): Promise<SourcePack> {
  const pack: SourceItem[] = [];
  const profile = await db.profile.findUnique({ where: { userId } });
  if (profile) {
    pack.push({
      id: `profile:${userId}`,
      kind: "profile",
      text: describe({ Headline: profile.headline, Summary: profile.summary }),
      links: [],
    });
  }

  const evidence = await db.evidence.findMany({ where: { userId }, include: { links: true } });

  for (const kind of CLAIM_KIND_LIST) {
    const rows = await kind.delegate(db).findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    for (const row of rows) {
      const links = evidence
        .filter((e) => e.links.some((l) => l.entityType === kind.type && l.entityId === row.id))
        .map((e) => evidenceSourceId(e.id));
      pack.push({
        id: claimSourceId(kind.type, row.id),
        kind: kind.type,
        text: `${kind.label(row)}\n${describe(kind.fields(row))}`,
        links,
        ...(kind.type === "skill" ? { name: String(row.name) } : {}),
      });
    }
  }

  for (const e of evidence) {
    const meta = e.metadata as { title?: string; description?: string };
    pack.push({
      id: evidenceSourceId(e.id),
      kind: "evidence",
      text: describe({ Type: e.type, Title: meta.title, Description: meta.description }),
      links: e.links
        .filter((l) => EntityType.safeParse(l.entityType).success)
        .map((l) => claimSourceId(l.entityType, l.entityId)),
    });
  }
  return pack;
}

/** Database facts for the §S10.2 claim-check rules. */
export async function buildClaimFacts(
  db: Db,
  userId: string,
  only?: { entityType: string; entityId: string },
): Promise<ClaimFact[]> {
  const requests = await db.verificationRequest.findMany({ where: { requestedBy: userId } });
  const activeCredentialIds = new Set(
    (
      await db.credential.findMany({
        where: { subjectUserId: userId, status: "active" },
        select: { id: true },
      })
    ).map((c) => c.id),
  );
  const facts: ClaimFact[] = [];
  for (const kind of only ? [CLAIM_KINDS[EntityType.parse(only.entityType)]] : CLAIM_KIND_LIST) {
    const rows = await kind.delegate(db).findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    for (const row of rows) {
      if (only && row.id !== only.entityId) continue;
      const mine = requests.filter((r) => r.entityType === kind.type && r.entityId === row.id);
      const links = await db.evidenceLink.findMany({
        where: { entityType: kind.type, entityId: row.id },
        select: { evidenceId: true },
      });
      facts.push({
        claimId: claimSourceId(kind.type, row.id),
        label: kind.label(row),
        hasActiveCredential: mine.some(
          (r) =>
            r.state === "approved" && r.draftCredentialId && activeCredentialIds.has(r.draftCredentialId),
        ),
        hasPendingRequest: mine.some((r) => r.state === "pending"),
        evidenceIds: links.map((l) => evidenceSourceId(l.evidenceId)),
      });
    }
  }
  return facts;
}
