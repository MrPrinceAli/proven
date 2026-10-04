import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  TEST_CHAIN_ID,
  hasDatabase,
  newAccount,
  requestNonce,
  resetDatabase,
  sessionCookie,
  signIn,
  testApp,
  testPrisma,
} from "./helpers";

describe.skipIf(!hasDatabase)("SIWE auth (FR-01)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await testApp();
  });
  afterAll(async () => {
    await app.close();
    await testPrisma().$disconnect();
  });
  beforeEach(() => resetDatabase());

  const me = (cookies: Record<string, string>) => app.inject({ method: "GET", url: "/me", cookies });

  it("logs in with a valid signature and /me returns the did:ethr identity", async () => {
    const account = newAccount();
    const { response } = await signIn(app, account);

    expect(response.statusCode).toBe(200);
    const did = `did:ethr:${TEST_CHAIN_ID}:${account.address.toLowerCase()}`;
    expect(response.json()).toMatchObject({ did, address: account.address });

    const cookie = response.cookies.find((c) => c.name === "proven_session");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });

    const res = await me(sessionCookie(response));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      wallet: { address: account.address, chainId: TEST_CHAIN_ID, did },
      profile: { headline: "", summary: "", visibility: "public", slug: null },
      roles: ["user"],
    });
  });

  it("stores only the sha256 of the session token", async () => {
    const { response } = await signIn(app, newAccount());
    const session = await testPrisma().session.findFirstOrThrow();
    const raw = sessionCookie(response).proven_session!;
    expect(session.tokenHash.toString("hex")).not.toContain(raw);
    expect(session.tokenHash).toHaveLength(32);
  });

  it("rejects a replayed nonce", async () => {
    const account = newAccount();
    const { response, message, signature } = await signIn(app, account);
    expect(response.statusCode).toBe(200);

    const replay = await app.inject({
      method: "POST",
      url: "/auth/siwe/verify",
      payload: { message, signature },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().detail).toMatch(/nonce/i);
  });

  it("rejects an expired nonce", async () => {
    const account = newAccount();
    const { nonce } = (await requestNonce(app, account.address)).json();
    await testPrisma().siweNonce.update({
      where: { nonce },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const { response } = await signIn(app, account, { nonce });
    expect(response.statusCode).toBe(401);
    expect(response.json().detail).toMatch(/nonce/i);
  });

  it("rejects a message for the wrong domain", async () => {
    const { response } = await signIn(app, newAccount(), { domain: "evil.example" });
    expect(response.statusCode).toBe(401);
    expect(response.json().detail).toBe("SIWE domain mismatch");
  });

  it("rejects a message whose uri origin is not allowed", async () => {
    const { response } = await signIn(app, newAccount(), { uri: "https://evil.example/login" });
    expect(response.statusCode).toBe(401);
    expect(response.json().detail).toBe("SIWE uri origin mismatch");
  });

  it("rejects the wrong chainId at nonce and at verify", async () => {
    const account = newAccount();
    const nonceRes = await requestNonce(app, account.address, 1);
    expect(nonceRes.statusCode).toBe(400);

    const { response } = await signIn(app, account, { chainId: 1 });
    expect(response.statusCode).toBe(401);
    expect(response.json().detail).toBe("SIWE chainId mismatch");
  });

  it("rejects a nonce issued for a different address", async () => {
    const alice = newAccount();
    const mallory = newAccount();
    const { nonce } = (await requestNonce(app, alice.address)).json();

    const { response } = await signIn(app, mallory, { nonce });
    expect(response.statusCode).toBe(401);
    expect(response.json().detail).toMatch(/different address/);
  });

  it("rejects a signature that does not match the message address", async () => {
    const alice = newAccount();
    const mallory = newAccount();
    const { nonce } = (await requestNonce(app, alice.address)).json();

    // Mallory signs a message that claims to be Alice.
    const { response } = await signIn(app, mallory, { nonce, address: alice.address });
    expect(response.statusCode).toBe(401);
    expect(response.json().detail).toBe("Invalid signature");
  });

  it("rejects a non-checksummed address", async () => {
    const res = await requestNonce(app, newAccount().address.toLowerCase());
    expect(res.statusCode).toBe(400);
    expect(res.json().type).toBe("https://proven.app/problems/validation-error");
  });

  it("rejects an expired SIWE message", async () => {
    const { response } = await signIn(app, newAccount(), { expirationTime: new Date(Date.now() - 1000) });
    expect(response.statusCode).toBe(401);
  });

  it("logs out and /me answers 401 afterwards", async () => {
    const { response } = await signIn(app, newAccount());
    const cookies = sessionCookie(response);

    const logout = await app.inject({ method: "POST", url: "/auth/logout", cookies });
    expect(logout.statusCode).toBe(204);
    expect(await testPrisma().session.count()).toBe(0);

    const res = await me(cookies);
    expect(res.statusCode).toBe(401);
    expect(res.headers["content-type"]).toContain("application/problem+json");
  });

  it("rejects /me without a cookie and with a tampered cookie", async () => {
    expect((await me({})).statusCode).toBe(401);

    const { response } = await signIn(app, newAccount());
    const value = sessionCookie(response).proven_session!;
    const tampered = `${value.slice(0, -2)}xx`;
    expect((await me({ proven_session: tampered })).statusCode).toBe(401);
  });

  it("reuses the same user on a second login and writes audit logs", async () => {
    const account = newAccount();
    const first = await signIn(app, account);
    const second = await signIn(app, account);
    expect(second.response.json().userId).toBe(first.response.json().userId);
    expect(await testPrisma().user.count()).toBe(1);

    const actions = (await testPrisma().auditLog.findMany({ orderBy: { id: "asc" } })).map((l) => l.action);
    expect(actions).toEqual(["user.created", "auth.login", "auth.login"]);
  });
});

describe.skipIf(!hasDatabase)("roles and guards", () => {
  let app: FastifyInstance;
  const admin = newAccount();

  beforeAll(async () => {
    app = await testApp({ ADMIN_ADDRESSES: admin.address });
  });
  afterAll(() => app.close());
  beforeEach(() => resetDatabase());

  it("adds the issuer role for a verified issuer address", async () => {
    const issuer = newAccount();
    await testPrisma().issuer.create({
      data: {
        name: "XYZ Community",
        address: issuer.address,
        did: `did:ethr:${TEST_CHAIN_ID}:${issuer.address.toLowerCase()}`,
        verified: true,
      },
    });
    const { response } = await signIn(app, issuer);
    const res = await app.inject({ method: "GET", url: "/me", cookies: sessionCookie(response) });
    expect(res.json().roles).toEqual(["user", "issuer"]);
  });

  it("does not grant the issuer role to an unverified issuer", async () => {
    const issuer = newAccount();
    await testPrisma().issuer.create({
      data: {
        name: "Pending",
        address: issuer.address,
        did: `did:ethr:${TEST_CHAIN_ID}:${issuer.address.toLowerCase()}`,
        verified: false,
      },
    });
    const { response } = await signIn(app, issuer);
    const res = await app.inject({ method: "GET", url: "/me", cookies: sessionCookie(response) });
    expect(res.json().roles).toEqual(["user"]);
  });

  it("adds the admin role for ADMIN_ADDRESSES", async () => {
    const { response } = await signIn(app, admin);
    const res = await app.inject({ method: "GET", url: "/me", cookies: sessionCookie(response) });
    expect(res.json().roles).toEqual(["user", "admin"]);
  });
});
