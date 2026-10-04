import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { statusAfterLinkChange } from "../src/claims";
import { hasDatabase, loginAs, resetDatabase, testApp, testPrisma } from "./helpers";

describe("statusAfterLinkChange (§S4)", () => {
  it("moves UNVERIFIED ⇄ EVIDENCE_ATTACHED with links", () => {
    expect(statusAfterLinkChange("UNVERIFIED", 1)).toBe("EVIDENCE_ATTACHED");
    expect(statusAfterLinkChange("EVIDENCE_ATTACHED", 0)).toBe("UNVERIFIED");
    expect(statusAfterLinkChange("EVIDENCE_ATTACHED", 2)).toBe("EVIDENCE_ATTACHED");
  });

  it("never downgrades issuer-driven states", () => {
    for (const status of ["PENDING_ISSUER", "VERIFIED", "REVOKED", "EXPIRED"]) {
      expect(statusAfterLinkChange(status, 0)).toBe(status);
      expect(statusAfterLinkChange(status, 3)).toBe(status);
    }
  });
});

describe.skipIf(!hasDatabase)("profile and claims API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await testApp();
  });
  afterAll(() => app.close());
  beforeEach(() => resetDatabase());

  const patchProfile = (cookies: Record<string, string>, payload: Record<string, unknown>) =>
    app.inject({ method: "PATCH", url: "/me/profile", cookies, payload });

  describe("PATCH /me/profile", () => {
    it("updates headline, summary, visibility and lowercases the slug", async () => {
      const { cookies } = await loginAs(app);
      const res = await patchProfile(cookies, {
        headline: "Smart Contract Engineer",
        summary: "Membangun dApp di BNB Chain.",
        visibility: "private",
        slug: "Rina-Dev",
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        headline: "Smart Contract Engineer",
        visibility: "private",
        slug: "rina-dev",
      });
    });

    it("treats slugs case-insensitively: 'Rina' conflicts with 'rina'", async () => {
      const a = await loginAs(app);
      const b = await loginAs(app);
      expect((await patchProfile(a.cookies, { slug: "rina" })).statusCode).toBe(200);
      const res = await patchProfile(b.cookies, { slug: "Rina" });
      expect(res.statusCode).toBe(409);
      expect(res.json().type).toBe("https://proven.app/problems/conflict");
    });

    it("lets a user keep their own slug", async () => {
      const { cookies } = await loginAs(app);
      await patchProfile(cookies, { slug: "rina" });
      expect((await patchProfile(cookies, { slug: "RINA", headline: "x" })).statusCode).toBe(200);
    });

    it.each(["ab", "-rina", "rina-", "rina_dev", "a".repeat(41), "admin", "verify", "p", "dashboard"])(
      "rejects invalid or reserved slug %s",
      async (slug) => {
        const { cookies } = await loginAs(app);
        expect((await patchProfile(cookies, { slug })).statusCode).toBe(400);
      },
    );

    it("rejects unknown fields", async () => {
      const { cookies } = await loginAs(app);
      expect((await patchProfile(cookies, { email: "x@y.z" })).statusCode).toBe(400);
    });

    it("requires a session", async () => {
      expect((await patchProfile({}, { headline: "x" })).statusCode).toBe(401);
    });
  });

  describe("claim CRUD", () => {
    const cases = [
      { path: "skills", create: { name: "Solidity", level: "advanced" }, update: { level: "expert" } },
      {
        path: "experiences",
        create: { title: "Engineer", org: "XYZ Labs", startDate: "2024-01-01", endDate: "2025-06-30" },
        update: { description: "Membangun indexer." },
      },
      {
        path: "projects",
        create: { name: "Proven", url: "https://proven.app" },
        update: { description: "MVP" },
      },
      {
        path: "achievements",
        create: { title: "XYZ Hackathon 2026 — Winner", event: "XYZ Hackathon 2026", year: 2026 },
        update: { year: 2025 },
      },
      {
        path: "community",
        create: { community: "BNB Builders ID", role: "Mentor" },
        update: { role: "Lead" },
      },
    ];

    it.each(cases)("creates, lists, updates and deletes $path", async ({ path, create, update }) => {
      const { cookies } = await loginAs(app);

      const created = await app.inject({ method: "POST", url: `/me/${path}`, cookies, payload: create });
      expect(created.statusCode).toBe(201);
      const body = created.json();
      expect(body).toMatchObject({ ...create, status: "UNVERIFIED", evidenceIds: [] });

      const list = await app.inject({ method: "GET", url: `/me/${path}`, cookies });
      expect(list.json()).toHaveLength(1);

      const patched = await app.inject({
        method: "PATCH",
        url: `/me/${path}/${body.id}`,
        cookies,
        payload: update,
      });
      expect(patched.statusCode).toBe(200);
      expect(patched.json()).toMatchObject(update);

      const deleted = await app.inject({ method: "DELETE", url: `/me/${path}/${body.id}`, cookies });
      expect(deleted.statusCode).toBe(204);
      expect((await app.inject({ method: "GET", url: `/me/${path}`, cookies })).json()).toHaveLength(0);
    });

    it("ignores a client-supplied status and returns 404 for another user's record", async () => {
      const alice = await loginAs(app);
      const bob = await loginAs(app);

      const forged = await app.inject({
        method: "POST",
        url: "/me/achievements",
        cookies: alice.cookies,
        payload: { title: "Juara", status: "VERIFIED" },
      });
      expect(forged.statusCode).toBe(400);

      const created = await app.inject({
        method: "POST",
        url: "/me/achievements",
        cookies: alice.cookies,
        payload: { title: "Juara" },
      });
      const id = created.json().id;

      for (const method of ["PATCH", "DELETE"] as const) {
        const res = await app.inject({
          method,
          url: `/me/achievements/${id}`,
          cookies: bob.cookies,
          payload: method === "PATCH" ? { title: "Dicuri" } : undefined,
        });
        expect(res.statusCode).toBe(404);
      }
      expect(
        (await app.inject({ method: "GET", url: "/me/achievements", cookies: bob.cookies })).json(),
      ).toEqual([]);
    });

    it("validates input (end date before start date, bad url)", async () => {
      const { cookies } = await loginAs(app);
      const exp = await app.inject({
        method: "POST",
        url: "/me/experiences",
        cookies,
        payload: { title: "A", org: "B", startDate: "2025-01-01", endDate: "2024-01-01" },
      });
      expect(exp.statusCode).toBe(400);
      const proj = await app.inject({
        method: "POST",
        url: "/me/projects",
        cookies,
        payload: { name: "X", url: "javascript:alert(1)" },
      });
      expect(proj.statusCode).toBe(400);
    });

    it("locks VERIFIED claims against edits and PENDING_ISSUER claims against deletion", async () => {
      const { cookies, userId } = await loginAs(app);
      const verified = await testPrisma().skill.create({
        data: { userId, name: "Solidity", status: "VERIFIED" },
      });
      const pending = await testPrisma().skill.create({
        data: { userId, name: "Rust", status: "PENDING_ISSUER" },
      });

      const edit = await app.inject({
        method: "PATCH",
        url: `/me/skills/${verified.id}`,
        cookies,
        payload: { name: "Solidity Expert" },
      });
      expect(edit.statusCode).toBe(409);
      const del = await app.inject({ method: "DELETE", url: `/me/skills/${pending.id}`, cookies });
      expect(del.statusCode).toBe(409);
    });

    it("summarises claims per status for the dashboard", async () => {
      const { cookies, userId } = await loginAs(app);
      await app.inject({ method: "POST", url: "/me/skills", cookies, payload: { name: "Go" } });
      await testPrisma().achievement.create({ data: { userId, title: "Juara 1", status: "VERIFIED" } });

      const res = await app.inject({ method: "GET", url: "/me/claims", cookies });
      expect(res.statusCode).toBe(200);
      expect(res.json().summary).toMatchObject({ UNVERIFIED: 1, VERIFIED: 1, EVIDENCE_ATTACHED: 0 });
      expect(res.json().claims.skills).toHaveLength(1);
      expect(res.json().claims.achievements[0]).toMatchObject({ title: "Juara 1", status: "VERIFIED" });
    });

    it("writes audit logs for claim mutations", async () => {
      const { cookies } = await loginAs(app);
      const created = await app.inject({
        method: "POST",
        url: "/me/skills",
        cookies,
        payload: { name: "Go" },
      });
      await app.inject({ method: "DELETE", url: `/me/skills/${created.json().id}`, cookies });
      const actions = (await testPrisma().auditLog.findMany({ orderBy: { id: "asc" } })).map((l) => l.action);
      expect(actions).toEqual(expect.arrayContaining(["skill.created", "skill.deleted"]));
    });
  });
});
