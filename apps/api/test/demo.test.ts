import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootstrapIssuer } from "../src/issuers/register";
import { fakeChain, hasDatabase, loginAs, resetDatabase, testApp, testConfig, testPrisma } from "./helpers";

const ISSUER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const demoConfig = { DEMO_MODE: "1", ISSUER_ADDRESS: ISSUER, ISSUER_NAME: "XYZ Community" };

describe("demo mode config (D-032)", () => {
  it("is off by default and refused on a mainnet", () => {
    expect(testConfig().demoMode).toBe(false);
    expect(testConfig({ DEMO_MODE: "1" }).demoMode).toBe(true);
    expect(() => testConfig({ DEMO_MODE: "1", CHAIN_ID: "56" })).toThrow(/DEMO_MODE/);
  });
});

describe.skipIf(!hasDatabase)("demo mode (D-032)", () => {
  let app: FastifyInstance;
  const cookieOf = (res: { cookies: { name: string; value: string }[] }) =>
    Object.fromEntries(res.cookies.filter((c) => c.name === "proven_session").map((c) => [c.name, c.value]));
  const demo = (payload: object) => app.inject({ method: "POST", url: "/auth/demo", payload });

  beforeAll(async () => {
    app = await testApp({ config: demoConfig, chain: fakeChain([ISSUER]) });
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDatabase();
    await bootstrapIssuer(testPrisma(), {
      address: ISSUER,
      name: "XYZ Community",
      did: `did:ethr:97:${ISSUER.toLowerCase()}`,
    });
  });

  it("is a 404 when DEMO_MODE is off", async () => {
    const off = await testApp();
    try {
      expect(
        (await off.inject({ method: "POST", url: "/auth/demo", payload: { role: "user" } })).statusCode,
      ).toBe(404);
      expect((await off.inject({ method: "GET", url: "/config" })).json()).toMatchObject({ demoMode: false });
    } finally {
      await off.close();
    }
  });

  it("gives each visitor a seeded sandbox and lets them resume it", async () => {
    expect((await app.inject({ method: "GET", url: "/config" })).json()).toEqual({
      demoMode: true,
      chainId: 97,
      issuerName: "XYZ Community",
    });
    const first = await demo({ role: "user" });
    expect(first.statusCode).toBe(200);
    const { userId } = first.json();
    const me = (await app.inject({ method: "GET", url: "/me", cookies: cookieOf(first) })).json();
    expect(me).toMatchObject({ demo: true, sandbox: true, roles: ["user"] });
    expect(me.profile.slug).toMatch(/^demo-[0-9a-f]{6}$/);

    const claims = (await app.inject({ method: "GET", url: "/me/claims", cookies: cookieOf(first) })).json();
    expect(claims.summary.PENDING_ISSUER).toBe(1);

    const other = await demo({ role: "user" });
    expect(other.json().userId).not.toBe(userId);
    expect((await demo({ role: "user", userId })).json().userId).toBe(userId);
  });

  it("never hands out a real wallet's account", async () => {
    const real = await loginAs(app);
    const res = await demo({ role: "user", userId: real.userId });
    expect(res.json().userId).not.toBe(real.userId);
  });

  it("lets the demo issuer act on sandboxes only", async () => {
    const sandbox = (await demo({ role: "user" })).json();
    const real = await loginAs(app);
    const achievement = (
      await app.inject({
        method: "POST",
        url: "/me/achievements",
        cookies: real.cookies,
        payload: { title: "Asli" },
      })
    ).json();
    const realRequest = await testPrisma().verificationRequest.create({
      data: {
        entityType: "achievement",
        entityId: achievement.id,
        issuerId: (await testPrisma().issuer.findFirstOrThrow()).id,
        requestedBy: real.userId,
      },
    });

    const issuer = await demo({ role: "issuer" });
    const cookies = cookieOf(issuer);
    expect((await app.inject({ method: "GET", url: "/me", cookies })).json().roles).toContain("issuer");

    const queue = (await app.inject({ method: "GET", url: "/issuer/verification-requests", cookies })).json();
    expect(queue.map((q: { requester: { did: string } }) => q.requester.did)).toEqual([sandbox.did]);

    const blocked = await app.inject({
      method: "POST",
      url: `/issuer/verification-requests/${realRequest.id}/reject`,
      cookies,
      payload: { reason: "tidak boleh" },
    });
    expect(blocked.statusCode).toBe(403);

    const allowed = await app.inject({
      method: "POST",
      url: `/issuer/verification-requests/${queue[0].id}/reject`,
      cookies,
      payload: { reason: "Uji mode demo" },
    });
    expect(allowed.statusCode).toBe(200);
  });
});
