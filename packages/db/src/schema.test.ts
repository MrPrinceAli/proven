import { afterAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "./client";
import { ClaimStatus, EvidenceType } from "./enums";

const url = process.env.DATABASE_URL_TEST;

describe("enums", () => {
  it("rejects the display-only CLAIM_WITHOUT_EVIDENCE as a stored status", () => {
    expect(ClaimStatus.safeParse("CLAIM_WITHOUT_EVIDENCE").success).toBe(false);
    expect(ClaimStatus.parse("VERIFIED")).toBe("VERIFIED");
  });

  it("covers the FR-05 evidence types", () => {
    expect(EvidenceType.options).toHaveLength(8);
  });
});

describe.skipIf(!url)("database schema (DATABASE_URL_TEST)", () => {
  const prisma = createPrismaClient(url);
  afterAll(() => prisma.$disconnect());

  it("treats slugs case-insensitively (citext)", async () => {
    const a = await prisma.user.create({ data: { profile: { create: { slug: `Arya-${Date.now()}` } } } });
    const profile = await prisma.profile.findUnique({ where: { userId: a.id } });
    const found = await prisma.profile.findFirst({ where: { slug: profile!.slug!.toLowerCase() } });
    expect(found?.userId).toBe(a.id);
    await prisma.user.delete({ where: { id: a.id } });
  });

  it("keeps audit_logs append-only", async () => {
    const log = await prisma.auditLog.create({ data: { action: "test.append_only" } });
    await expect(prisma.auditLog.update({ where: { id: log.id }, data: { action: "x" } })).rejects.toThrow(
      /append-only/,
    );
    await expect(prisma.auditLog.delete({ where: { id: log.id } })).rejects.toThrow(/append-only/);
  });
});
