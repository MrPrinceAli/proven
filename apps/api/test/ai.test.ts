import { createMockClient, NO_EVIDENCE_NOTE } from "@proven/ai";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_CHAIN_ID,
  fakeChain,
  hasDatabase,
  loginAs,
  newAccount,
  resetDatabase,
  testApp,
  testPrisma,
  upload,
} from "./helpers";

describe.skipIf(!hasDatabase)("AI endpoints (W6, mock provider)", () => {
  let app: FastifyInstance;
  const issuerAccount = newAccount();

  beforeAll(async () => {
    app = await testApp({ chain: fakeChain([issuerAccount.address]) });
  });
  afterAll(() => app.close());
  beforeEach(() => resetDatabase());

  /** Profile with Solidity (+ linked evidence), Go (no evidence) and an achievement. */
  async function seededUser() {
    const user = await loginAs(app);
    const post = (url: string, payload: unknown) =>
      app.inject({ method: "POST", url, cookies: user.cookies, payload: payload as object });
    await app.inject({
      method: "PATCH",
      url: "/me/profile",
      cookies: user.cookies,
      payload: { headline: "Smart Contract Engineer", summary: "Membangun dApp." },
    });
    const solidity = (await post("/me/skills", { name: "Solidity", level: "advanced" })).json();
    const go = (await post("/me/skills", { name: "Go" })).json();
    const achievement = (await post("/me/achievements", { title: "XYZ Hackathon 2026 — Winner" })).json();
    const evidence = (
      await upload(app, user.cookies, undefined, "hackathon.pdf", { title: "Sertifikat hackathon" })
    ).json();
    for (const [entityType, entityId] of [
      ["skill", solidity.id],
      ["achievement", achievement.id],
    ]) {
      await post(`/me/evidence/${evidence.id}/links`, { entityType, entityId });
    }
    return { ...user, post, solidity, go, achievement, evidence };
  }

  it("requires a session", async () => {
    expect((await app.inject({ method: "POST", url: "/ai/summary", payload: {} })).statusCode).toBe(401);
  });

  it("returns a labelled, grounded summary draft without saving it", async () => {
    const u = await seededUser();
    const res = await u.post("/ai/summary", { freeText: "Saya suka membangun alat untuk komunitas." });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ aiGenerated: true, promptVersion: "summary@1", model: "mock" });
    expect(body.result.citations.length).toBeGreaterThan(0);
    for (const c of body.result.citations)
      expect(c).toMatch(/^(profile|skill|experience|project|achievement|community_role|evidence):/);

    const me = (await app.inject({ method: "GET", url: "/me", cookies: u.cookies })).json();
    expect(me.profile.summary).toBe("Membangun dApp.");
  });

  it("generates a cited CV and a tailored CV that never claims missing skills", async () => {
    const u = await seededUser();
    const cv = (await u.post("/ai/cv", {})).json();
    expect(cv.mode).toBe("cv");
    expect(cv.result.sections.length).toBeGreaterThan(0);

    const tailored = (
      await u.post("/ai/cv", { jobDescription: "Kami mencari engineer Rust dan Solidity, plus Go." })
    ).json();
    expect(tailored.mode).toBe("tailor");
    expect(tailored.result.matched).toEqual([{ skill: "Solidity", evidenceId: `evidence:${u.evidence.id}` }]);
    expect(tailored.result.gaps).toEqual(
      expect.arrayContaining([
        { skill: "Rust", note: NO_EVIDENCE_NOTE },
        { skill: "Go", note: NO_EVIDENCE_NOTE },
      ]),
    );
    expect(tailored.result.cv).not.toMatch(/rust/i);
  });

  it("stores classification as a suggestion only", async () => {
    const u = await seededUser();
    const res = await u.post("/ai/classify-evidence", { evidenceId: u.evidence.id });
    expect(res.statusCode).toBe(200);
    expect(res.json().result).toMatchObject({ type: "hackathon" });

    const row = await testPrisma().evidence.findUniqueOrThrow({ where: { id: u.evidence.id } });
    expect(row.aiType).toBe("hackathon");
    expect(Number(row.aiConfidence)).toBeGreaterThan(0);
    expect(row.type).toBe("certificate");

    const other = await loginAs(app);
    const stolen = await app.inject({
      method: "POST",
      url: "/ai/classify-evidence",
      cookies: other.cookies,
      payload: { evidenceId: u.evidence.id },
    });
    expect(stolen.statusCode).toBe(404);
  });

  it("claim-check reports VERIFIED only for a claim with an active credential", async () => {
    const u = await seededUser();
    const issuer = await testPrisma().issuer.create({
      data: {
        name: "XYZ",
        address: issuerAccount.address,
        did: `did:ethr:97:${issuerAccount.address.toLowerCase()}`,
        verified: true,
      },
    });
    const credential = await testPrisma().credential.create({
      data: {
        issuerId: issuer.id,
        subjectUserId: u.userId,
        type: ["VerifiableCredential"],
        vcJson: {},
        vcHash: Buffer.alloc(32, 1),
        status: "active",
      },
    });
    await testPrisma().verificationRequest.create({
      data: {
        entityType: "achievement",
        entityId: u.achievement.id,
        issuerId: issuer.id,
        requestedBy: u.userId,
        state: "approved",
        evidenceIds: [u.evidence.id],
        draftCredentialId: credential.id,
      },
    });

    const check = async () =>
      Object.fromEntries(
        (
          (await u.post("/ai/claim-check", {})).json().result.claims as {
            claimId: string;
            status: string;
            reason: string;
          }[]
        ).map((c) => [c.claimId, c]),
      );
    let claims = await check();
    expect(claims[`achievement:${u.achievement.id}`]!.status).toBe("VERIFIED");
    expect(claims[`skill:${u.solidity.id}`]!.status).toBe("EVIDENCE_ATTACHED");
    expect(claims[`skill:${u.go.id}`]!.status).toBe("CLAIM_WITHOUT_EVIDENCE");
    expect(claims[`skill:${u.go.id}`]!.reason).toContain(NO_EVIDENCE_NOTE);

    await testPrisma().credential.update({ where: { id: credential.id }, data: { status: "revoked" } });
    claims = await check();
    expect(claims[`achievement:${u.achievement.id}`]!.status).toBe("EVIDENCE_ATTACHED");

    const single = (await u.post("/ai/claim-check", { entityType: "skill", entityId: u.go.id })).json();
    expect(single.result.claims).toHaveLength(1);
  });

  it("answers 502 ai-output-invalid when the model keeps returning invalid output", async () => {
    const broken = await testApp({ llm: createMockClient({ summary: () => ({ wrong: true }) }) });
    try {
      const u = await loginAs(broken);
      const res = await broken.inject({
        method: "POST",
        url: "/ai/summary",
        cookies: u.cookies,
        payload: {},
      });
      expect(res.statusCode).toBe(502);
      expect(res.json().type).toBe("https://proven.app/problems/ai-output-invalid");
    } finally {
      await broken.close();
    }
  });

  it("rate-limits AI calls per user", async () => {
    const limited = await testApp({ rateLimit: { max: 1000, authMax: 1000, aiMax: 2 } });
    try {
      const u = await loginAs(limited);
      const hit = () =>
        limited.inject({ method: "POST", url: "/ai/summary", cookies: u.cookies, payload: {} });
      expect((await hit()).statusCode).toBe(200);
      expect((await hit()).statusCode).toBe(200);
      expect((await hit()).statusCode).toBe(429);
      // Another user has their own budget.
      const v = await loginAs(limited);
      expect(
        (await limited.inject({ method: "POST", url: "/ai/summary", cookies: v.cookies, payload: {} }))
          .statusCode,
      ).toBe(200);
    } finally {
      await limited.close();
    }
  });

  it("gives the issuer a claim-check suggestion for its own request only", async () => {
    const u = await seededUser();
    const issuer = await testPrisma().issuer.create({
      data: {
        name: "XYZ",
        address: issuerAccount.address,
        did: `did:ethr:${TEST_CHAIN_ID}:${issuerAccount.address.toLowerCase()}`,
        verified: true,
      },
    });
    const request = await u.post("/me/verification-requests", {
      entityType: "achievement",
      entityId: u.achievement.id,
      issuerId: issuer.id,
      evidenceIds: [u.evidence.id],
    });
    const requestId = request.json().id;

    const issuerSession = await loginAs(app, issuerAccount);
    const res = await app.inject({
      method: "GET",
      url: `/issuer/verification-requests/${requestId}/claim-check`,
      cookies: issuerSession.cookies,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      note: "AI hanya asisten. Keputusan ada di tangan issuer.",
      aiGenerated: true,
      result: { claims: [{ claimId: `achievement:${u.achievement.id}`, status: "PENDING_ISSUER" }] },
    });

    const userTry = await app.inject({
      method: "GET",
      url: `/issuer/verification-requests/${requestId}/claim-check`,
      cookies: u.cookies,
    });
    expect(userTry.statusCode).toBe(403);
  });
});
