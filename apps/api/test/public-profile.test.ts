import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { truncateDid } from "../src/routes/public";
import { hasDatabase, loginAs, resetDatabase, testApp, testPrisma, upload } from "./helpers";

describe("truncateDid", () => {
  it("keeps the method and chain but shortens the address", () => {
    expect(truncateDid("did:ethr:97:0x70997970c51812dc3a010c7d01b50e0d17dc79c8")).toBe(
      "did:ethr:97:0x7099…79c8",
    );
  });
});

describe.skipIf(!hasDatabase)("GET /p/:slug (FR-14)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await testApp();
  });
  afterAll(() => app.close());
  beforeEach(() => resetDatabase());

  async function publicUser(visibility = "public") {
    const user = await loginAs(app);
    await app.inject({
      method: "PATCH",
      url: "/me/profile",
      cookies: user.cookies,
      payload: { slug: "arya", headline: "Smart Contract Engineer", summary: "Halo", visibility },
    });
    return user;
  }

  it("returns a public profile with claims and statuses, without a login", async () => {
    const { cookies, account } = await publicUser();
    const achievement = (
      await app.inject({ method: "POST", url: "/me/achievements", cookies, payload: { title: "Juara 1" } })
    ).json();
    const evidence = (await upload(app, cookies)).json();
    await app.inject({
      method: "POST",
      url: `/me/evidence/${evidence.id}/links`,
      cookies,
      payload: { entityType: "achievement", entityId: achievement.id },
    });

    const res = await app.inject({ method: "GET", url: "/p/ARYA" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      slug: "arya",
      displayName: "",
      avatarSeed: expect.any(String),
      headline: "Smart Contract Engineer",
      did: `did:ethr:97:${account.address.toLowerCase().slice(0, 6)}…${account.address.toLowerCase().slice(-4)}`,
    });
    expect(body.claims.achievements).toEqual([
      expect.objectContaining({ title: "Juara 1", status: "EVIDENCE_ATTACHED", evidenceCount: 1 }),
    ]);

    const raw = res.body;
    expect(raw).not.toContain(account.address.toLowerCase());
    expect(raw).not.toContain(evidence.sha256);
    expect(raw).not.toContain("pg:");
    expect(raw).not.toMatch(/email|storageKey|storage_key|ciphertext/);
  });

  it("returns 404 for a private profile", async () => {
    await publicUser("private");
    const res = await app.inject({ method: "GET", url: "/p/arya" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for recruiter-only (roadmap) and unknown slugs", async () => {
    await publicUser("recruiter-only");
    expect((await app.inject({ method: "GET", url: "/p/arya" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/p/nobody" })).statusCode).toBe(404);
  });

  it("returns 404 for a suspended user", async () => {
    const { userId } = await publicUser();
    await testPrisma().user.update({ where: { id: userId }, data: { status: "suspended" } });
    expect((await app.inject({ method: "GET", url: "/p/arya" })).statusCode).toBe(404);
  });
});
