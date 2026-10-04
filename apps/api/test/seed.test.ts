import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedDemo } from "../src/seed/demo";
import { hasDatabase, resetDatabase, testPrisma } from "./helpers";

describe.skipIf(!hasDatabase)("pnpm db:seed (§W8 2)", () => {
  const input = () => ({
    prisma: testPrisma(),
    chainId: 97,
    evidenceKey: Buffer.alloc(32, 7),
    issuer: {
      address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const,
      name: "XYZ Community",
      did: "did:ethr:97:0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    },
    demoAddress: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  });

  beforeEach(() => resetDatabase());
  afterAll(() => testPrisma().$disconnect());

  it("creates the demo issuer, profile, claims, certificate and one pending request", async () => {
    const result = await seedDemo(input());
    const db = testPrisma();
    expect(result.slug).toBe("rina-demo");
    expect(await db.issuer.count({ where: { verified: true, name: "XYZ Community" } })).toBe(1);
    expect((await db.profile.findFirstOrThrow({ where: { slug: "rina-demo" } })).visibility).toBe("public");

    const achievement = await db.achievement.findFirstOrThrow({
      where: { title: "XYZ Hackathon 2026 — Winner" },
    });
    expect(achievement.status).toBe("PENDING_ISSUER");
    expect(await db.verificationRequest.count({ where: { state: "pending" } })).toBe(1);

    expect((await db.skill.findFirstOrThrow({ where: { name: "Solidity" } })).status).toBe(
      "EVIDENCE_ATTACHED",
    );
    const rust = await db.skill.findFirstOrThrow({ where: { name: "Rust" } });
    expect(rust.status).toBe("UNVERIFIED");
    expect(await db.evidenceLink.count({ where: { entityId: rust.id } })).toBe(0);

    const evidence = await db.evidence.findFirstOrThrow();
    expect(evidence.mimeType).toBe("application/pdf");
    expect(Buffer.from(evidence.sha256).toString("hex")).toBe(result.evidenceSha256);
  });

  it("is idempotent", async () => {
    await seedDemo(input());
    await seedDemo(input());
    const db = testPrisma();
    expect(await db.user.count()).toBe(1);
    expect(await db.skill.count()).toBe(3);
    expect(await db.evidence.count()).toBe(1);
    expect(await db.evidenceLink.count()).toBe(2);
    expect(await db.verificationRequest.count()).toBe(1);
  });
});
