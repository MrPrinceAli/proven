import { credentialHash, VerifiableCredentialSchema, verifyVC } from "@proven/vc";
import type { FastifyInstance } from "fastify";
import { privateKeyToAccount } from "viem/accounts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createChainAdapter, type ChainAdapter } from "../src/chain/adapter";
import { bootstrapIssuer, registerIssuer } from "../src/issuers/register";
import { ANVIL_KEYS, ANVIL_RPC, anvilReady, deployment } from "./anvil";
import { loginAs, newAccount, resetDatabase, testApp, testPrisma, upload } from "./helpers";

const CHAIN_ID = 31337;
const issuerAccount = privateKeyToAccount(ANVIL_KEYS.issuer);
const ISSUER = {
  address: issuerAccount.address,
  name: "XYZ Community",
  did: `did:ethr:${CHAIN_ID}:${issuerAccount.address.toLowerCase()}`,
};

describe.skipIf(!anvilReady)("issuer flow: request → approve → anchor → revoke (FR-10..FR-12)", () => {
  let app: FastifyInstance;
  let chain: ChainAdapter;
  const config = {
    CHAIN_ID: String(CHAIN_ID),
    RPC_URL: ANVIL_RPC,
    ISSUER_ADDRESS: ISSUER.address,
    ISSUER_NAME: ISSUER.name,
    ISSUER_PRIVATE_KEY: ANVIL_KEYS.issuer,
    REGISTRY_ADDRESS: deployment.credentialRegistry,
    ISSUER_REGISTRY_ADDRESS: deployment.issuerRegistry,
  };
  const verifyOpts = { chainId: CHAIN_ID, verifyingContract: deployment.credentialRegistry };

  beforeAll(async () => {
    chain = createChainAdapter({
      chainId: CHAIN_ID,
      rpcUrl: ANVIL_RPC,
      registryAddress: deployment.credentialRegistry,
      issuerRegistryAddress: deployment.issuerRegistry,
      issuerPrivateKey: ANVIL_KEYS.issuer,
      prisma: testPrisma(),
    });
    app = await testApp({ config, chain });
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await resetDatabase();
    // The app bootstraps the configured issuer at startup (D-025); redo it after truncation.
    await bootstrapIssuer(testPrisma(), ISSUER);
  });

  /** A user with an achievement that has one linked PDF. */
  async function userWithClaim() {
    const user = await loginAs(app, newAccount(), CHAIN_ID);
    const achievement = (
      await app.inject({
        method: "POST",
        url: "/me/achievements",
        cookies: user.cookies,
        payload: { title: "XYZ Hackathon 2026 — Winner", event: "XYZ Hackathon 2026", year: 2026 },
      })
    ).json();
    const evidence = (await upload(app, user.cookies)).json();
    await app.inject({
      method: "POST",
      url: `/me/evidence/${evidence.id}/links`,
      cookies: user.cookies,
      payload: { entityType: "achievement", entityId: achievement.id },
    });
    const issuers: { id: string; name: string }[] = (
      await app.inject({ method: "GET", url: "/issuers" })
    ).json();
    const issuerId = issuers.find((i) => i.name === ISSUER.name)!.id;
    return { ...user, achievement, evidence, issuerId };
  }

  async function submit(u: Awaited<ReturnType<typeof userWithClaim>>, evidenceIds = [u.evidence.id]) {
    return app.inject({
      method: "POST",
      url: "/me/verification-requests",
      cookies: u.cookies,
      payload: { entityType: "achievement", entityId: u.achievement.id, issuerId: u.issuerId, evidenceIds },
    });
  }

  const loginIssuer = () => loginAs(app, issuerAccount, CHAIN_ID);
  const achievementStatus = async (u: { cookies: Record<string, string> }) =>
    (await app.inject({ method: "GET", url: "/me/achievements", cookies: u.cookies })).json()[0].status;

  it("lists the verified issuer publicly without private data", async () => {
    const res = await app.inject({ method: "GET", url: "/issuers" });
    expect(res.json()).toEqual([
      { id: expect.any(String), name: ISSUER.name, did: ISSUER.did, domain: null },
    ]);
  });

  it("runs the core loop end to end and keeps DB, chain and VC consistent", async () => {
    const user = await userWithClaim();
    const created = await submit(user);
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ state: "pending", evidenceIds: [user.evidence.id] });
    expect(await achievementStatus(user)).toBe("PENDING_ISSUER");

    const issuer = await loginIssuer();
    const me = (await app.inject({ method: "GET", url: "/me", cookies: issuer.cookies })).json();
    expect(me.roles).toContain("issuer");

    const queue = (
      await app.inject({
        method: "GET",
        url: "/issuer/verification-requests?state=pending",
        cookies: issuer.cookies,
      })
    ).json();
    expect(queue).toHaveLength(1);
    const requestId = queue[0].id;
    expect(queue[0].claim).toMatchObject({ label: "XYZ Hackathon 2026 — Winner", status: "PENDING_ISSUER" });

    const detail = (
      await app.inject({
        method: "GET",
        url: `/issuer/verification-requests/${requestId}`,
        cookies: issuer.cookies,
      })
    ).json();
    expect(detail.evidence).toEqual([
      expect.objectContaining({ id: user.evidence.id, sha256: user.evidence.sha256 }),
    ]);
    const file = await app.inject({
      method: "GET",
      url: `/issuer/verification-requests/${requestId}/evidence/${user.evidence.id}`,
      cookies: issuer.cookies,
    });
    expect(file.statusCode).toBe(200);
    expect(file.headers["x-content-sha256"]).toBe(user.evidence.sha256);

    const approved = await app.inject({
      method: "POST",
      url: `/issuer/verification-requests/${requestId}/approve`,
      cookies: issuer.cookies,
    });
    expect(approved.statusCode).toBe(200);
    const result = approved.json();
    expect(result).toMatchObject({
      credentialId: expect.stringMatching(/^urn:uuid:[0-9a-f-]{36}$/),
      vcHash: expect.stringMatching(/^0x[0-9a-f]{64}$/),
      txHash: expect.stringMatching(/^0x[0-9a-f]{64}$/),
      blockNumber: expect.any(Number),
      status: "active",
    });
    expect(await achievementStatus(user)).toBe("VERIFIED");

    // DB rows
    const credential = await testPrisma().credential.findFirstOrThrow({
      include: { chainAnchors: true, statusEntry: true },
    });
    expect(`urn:uuid:${credential.id}`).toBe(result.credentialId);
    expect(`0x${Buffer.from(credential.vcHash).toString("hex")}`).toBe(result.vcHash);
    expect(credential.chainAnchors[0]).toMatchObject({ txHash: result.txHash, chainId: CHAIN_ID });
    expect(credential.statusEntry).toMatchObject({ revoked: false, statusListIndex: 0 });

    // VC ↔ chain parity
    const vc = VerifiableCredentialSchema.parse(credential.vcJson);
    expect(vc.id).toBe(result.credentialId);
    expect(credentialHash(vc)).toBe(result.vcHash);
    expect(vc.credentialSubject.id).toBe(`did:ethr:${CHAIN_ID}:${user.account.address.toLowerCase()}`);
    expect(vc.credentialSubject.achievement.name).toBe("XYZ Hackathon 2026 — Winner");
    expect(await chain.getAnchor(result.vcHash)).toMatchObject({
      credentialHash: result.vcHash,
      revoked: false,
    });
    const report = await verifyVC({
      vc,
      readAnchor: chain.getAnchor,
      ...verifyOpts,
      expectedHash: result.vcHash,
    });
    expect(report.overall).toBe("valid");

    const mine = (await app.inject({ method: "GET", url: "/me/credentials", cookies: user.cookies })).json();
    expect(mine[0]).toMatchObject({
      credentialId: result.credentialId,
      status: "active",
      issuer: { name: ISSUER.name },
    });
    const requests = (
      await app.inject({ method: "GET", url: "/me/verification-requests", cookies: user.cookies })
    ).json();
    expect(requests[0]).toMatchObject({ state: "approved", credentialId: result.credentialId });

    // Revoke
    const revoked = await app.inject({
      method: "POST",
      url: `/issuer/credentials/${credential.id}/revoke`,
      cookies: issuer.cookies,
      payload: { reason: "Bukti terbukti palsu" },
    });
    expect(revoked.statusCode).toBe(200);
    expect(await chain.isRevoked(result.vcHash)).toBe(true);
    const after = await testPrisma().credential.findFirstOrThrow({ include: { statusEntry: true } });
    expect(after.status).toBe("revoked");
    expect(after.statusEntry).toMatchObject({ revoked: true, reason: "Bukti terbukti palsu" });
    expect(await achievementStatus(user)).toBe("REVOKED");
    expect((await verifyVC({ vc, readAnchor: chain.getAnchor, ...verifyOpts })).overall).toBe("revoked");

    const actions = (await testPrisma().auditLog.findMany()).map((l) => l.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "verification.requested",
        "evidence.reviewed",
        "credential.issued",
        "credential.revoked",
      ]),
    );
  });

  it("refuses a request without evidence with 422 evidence-required", async () => {
    const user = await userWithClaim();
    const res = await submit(user, []);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({
      type: "https://proven.app/problems/evidence-required",
      title: "Evidence required",
      status: 422,
      detail: "Klaim 'XYZ Hackathon 2026 — Winner' tidak memiliki bukti yang dapat diverifikasi.",
      instance: "/me/verification-requests",
    });
  });

  it("refuses duplicate pending requests and another user's evidence", async () => {
    const user = await userWithClaim();
    expect((await submit(user)).statusCode).toBe(201);
    expect((await submit(user)).statusCode).toBe(409);

    const other = await userWithClaim();
    expect((await submit(other, [user.evidence.id])).statusCode).toBe(404);
  });

  it("answers 403 to a non-issuer", async () => {
    const user = await userWithClaim();
    const requestId = (await submit(user)).json().id;
    const res = await app.inject({
      method: "POST",
      url: `/issuer/verification-requests/${requestId}/approve`,
      cookies: user.cookies,
    });
    expect(res.statusCode).toBe(403);
    expect(
      (await app.inject({ method: "GET", url: "/issuer/verification-requests", cookies: user.cookies }))
        .statusCode,
    ).toBe(403);
  });

  it("answers 404 to another issuer and registers issuers idempotently", async () => {
    const otherAccount = privateKeyToAccount(ANVIL_KEYS.third);
    const other = {
      address: otherAccount.address,
      name: "Other Community",
      did: `did:ethr:${CHAIN_ID}:${otherAccount.address.toLowerCase()}`,
    };
    const register = () =>
      registerIssuer({
        prisma: testPrisma(),
        issuer: other,
        chainId: CHAIN_ID,
        rpcUrl: ANVIL_RPC,
        issuerRegistryAddress: deployment.issuerRegistry,
        deployerPrivateKey: ANVIL_KEYS.deployer,
      });
    await register();
    expect((await register()).alreadyActive).toBe(true);
    expect(await chain.isIssuerActive(other.address)).toBe(true);

    const user = await userWithClaim();
    const requestId = (await submit(user)).json().id;
    const otherIssuer = await loginAs(app, otherAccount, CHAIN_ID);
    for (const url of [
      `/issuer/verification-requests/${requestId}`,
      `/issuer/verification-requests/${requestId}/approve`,
    ]) {
      const res = await app.inject({
        method: url.endsWith("approve") ? "POST" : "GET",
        url,
        cookies: otherIssuer.cookies,
      });
      expect(res.statusCode).toBe(404);
    }
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/issuer/verification-requests",
          cookies: otherIssuer.cookies,
        })
      ).json(),
    ).toEqual([]);
  });

  it("answers 409 when approving twice", async () => {
    const user = await userWithClaim();
    const requestId = (await submit(user)).json().id;
    const issuer = await loginIssuer();
    const approve = () =>
      app.inject({
        method: "POST",
        url: `/issuer/verification-requests/${requestId}/approve`,
        cookies: issuer.cookies,
      });
    expect((await approve()).statusCode).toBe(200);
    expect((await approve()).statusCode).toBe(409);
  });

  it("rejects with a reason and returns the claim to EVIDENCE_ATTACHED", async () => {
    const user = await userWithClaim();
    const requestId = (await submit(user)).json().id;
    const issuer = await loginIssuer();
    const res = await app.inject({
      method: "POST",
      url: `/issuer/verification-requests/${requestId}/reject`,
      cookies: issuer.cookies,
      payload: { reason: "Sertifikat tidak terbaca" },
    });
    expect(res.statusCode).toBe(200);
    expect(await achievementStatus(user)).toBe("EVIDENCE_ATTACHED");
    const mine = (
      await app.inject({ method: "GET", url: "/me/verification-requests", cookies: user.cookies })
    ).json();
    expect(mine[0]).toMatchObject({ state: "rejected", reason: "Sertifikat tidak terbaca" });
  });

  it("only serves evidence that belongs to the request", async () => {
    const user = await userWithClaim();
    const extra = (await upload(app, user.cookies)).json();
    const requestId = (await submit(user)).json().id;
    const issuer = await loginIssuer();
    const res = await app.inject({
      method: "GET",
      url: `/issuer/verification-requests/${requestId}/evidence/${extra.id}`,
      cookies: issuer.cookies,
    });
    expect(res.statusCode).toBe(404);
  });

  it("keeps the request pending when anchoring fails and anchors the same hash exactly once on retry", async () => {
    let failNext = true;
    const flaky: ChainAdapter = {
      ...chain,
      anchorCredential: async (hash, ref) => {
        if (failNext) {
          failNext = false;
          throw Object.assign(new Error("RPC down"), {});
        }
        return chain.anchorCredential(hash, ref);
      },
    };
    const flakyApp = await testApp({ config, chain: flaky });
    try {
      const user = await userWithClaim();
      const requestId = (await submit(user)).json().id;
      const issuer = await loginAs(flakyApp, issuerAccount, CHAIN_ID);
      const approve = () =>
        flakyApp.inject({
          method: "POST",
          url: `/issuer/verification-requests/${requestId}/approve`,
          cookies: issuer.cookies,
        });

      expect((await approve()).statusCode).toBe(500);
      const pending = await testPrisma().verificationRequest.findUniqueOrThrow({ where: { id: requestId } });
      expect(pending.state).toBe("pending");
      const draftHash = credentialHash(pending.draftVc as object);

      const retry = await approve();
      expect(retry.statusCode).toBe(200);
      expect(retry.json().vcHash).toBe(draftHash);
      expect(await testPrisma().credential.count()).toBe(1);
      expect(await chain.getAnchor(draftHash)).not.toBeNull();
    } finally {
      await flakyApp.close();
    }
  });

  it("denies issuer actions when contracts are not configured (fail closed, D-023)", async () => {
    const offline = await testApp({ config, chain: null });
    try {
      const user = await userWithClaim();
      const requestId = (await submit(user)).json().id;
      // Without a chain nobody is an issuer (fail closed, D-023).
      const issuer = await loginAs(offline, issuerAccount, CHAIN_ID);
      const res = await offline.inject({
        method: "POST",
        url: `/issuer/verification-requests/${requestId}/approve`,
        cookies: issuer.cookies,
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await offline.close();
    }
  });

  describe("public verification (FR-13, §W7)", () => {
    async function issued() {
      const user = await userWithClaim();
      const requestId = (await submit(user)).json().id;
      const issuer = await loginIssuer();
      const approved = (
        await app.inject({
          method: "POST",
          url: `/issuer/verification-requests/${requestId}/approve`,
          cookies: issuer.cookies,
        })
      ).json();
      return { user, issuer, approved, uuid: approved.credentialId.replace("urn:uuid:", "") as string };
    }

    it("serves an active credential by urn or uuid without a login", async () => {
      const { approved, uuid, user } = await issued();
      const byUrn = await app.inject({
        method: "GET",
        url: `/verify/${encodeURIComponent(approved.credentialId)}`,
      });
      expect(byUrn.statusCode).toBe(200);
      expect(byUrn.json()).toMatchObject({
        credentialId: approved.credentialId,
        issuer: ISSUER.name,
        issuerDid: ISSUER.did,
        subject: `did:ethr:${CHAIN_ID}:${user.account.address.toLowerCase()}`,
        anchor: {
          txHash: approved.txHash,
          block: approved.blockNumber,
          contract: deployment.credentialRegistry,
          chainId: CHAIN_ID,
        },
        status: "active",
        revoked: false,
        chainChecked: true,
      });
      expect(byUrn.json().vc.proof.type).toBe("DataIntegrityProof");
      expect((await app.inject({ method: "GET", url: `/verify/${uuid}` })).json().status).toBe("active");

      const status = await app.inject({ method: "GET", url: `/credentials/${uuid}/status` });
      expect(status.json()).toMatchObject({
        status: "active",
        revoked: false,
        checkedAt: expect.any(String),
      });
    });

    it("shows a revocation made through Proven immediately", async () => {
      const { issuer, uuid } = await issued();
      expect((await app.inject({ method: "GET", url: `/verify/${uuid}` })).json().status).toBe("active");
      await app.inject({
        method: "POST",
        url: `/issuer/credentials/${uuid}/revoke`,
        cookies: issuer.cookies,
        payload: { reason: "Dicabut untuk uji" },
      });
      expect((await app.inject({ method: "GET", url: `/verify/${uuid}` })).json()).toMatchObject({
        status: "revoked",
        revoked: true,
      });
    });

    it("trusts the chain over the DB and syncs the DB when they differ", async () => {
      const { uuid, approved, user } = await issued();
      // Revoke directly on-chain, bypassing Proven's API and DB.
      await chain.revokeCredential(approved.vcHash);
      const res = (await app.inject({ method: "GET", url: `/verify/${uuid}` })).json();
      expect(res).toMatchObject({ status: "revoked", revoked: true, chainChecked: true });

      const row = await testPrisma().credential.findUniqueOrThrow({
        where: { id: uuid },
        include: { statusEntry: true },
      });
      expect(row.status).toBe("revoked");
      expect(row.statusEntry?.revoked).toBe(true);
      expect(await achievementStatus(user)).toBe("REVOKED");
      expect(await testPrisma().auditLog.count({ where: { action: "credential.synced" } })).toBe(1);
    });

    it("answers 404 for unknown and 400 for malformed ids", async () => {
      expect((await app.inject({ method: "GET", url: `/verify/${crypto.randomUUID()}` })).statusCode).toBe(
        404,
      );
      expect((await app.inject({ method: "GET", url: "/verify/not-a-uuid" })).statusCode).toBe(400);
    });

    it("lists credentials on the public profile and in the data export", async () => {
      const { user, approved } = await issued();
      await app.inject({
        method: "PATCH",
        url: "/me/profile",
        cookies: user.cookies,
        payload: { slug: "juara-xyz" },
      });
      const profile = (await app.inject({ method: "GET", url: "/p/juara-xyz" })).json();
      expect(profile.credentials).toEqual([
        expect.objectContaining({
          credentialId: approved.credentialId,
          name: "XYZ Hackathon 2026 — Winner",
          status: "active",
        }),
      ]);

      const exported = await app.inject({ method: "GET", url: "/me/data-export", cookies: user.cookies });
      expect(exported.statusCode).toBe(200);
      expect(exported.headers["content-disposition"]).toContain("attachment");
      const data = exported.json();
      expect(data.credentials[0]).toMatchObject({
        credentialId: approved.credentialId,
        vcHash: approved.vcHash,
      });
      expect(data.evidence[0]).toMatchObject({ sha256: user.evidence.sha256 });
      expect(exported.body).not.toMatch(/ciphertext|storage_?key|"pg:/i);
      expect((await app.inject({ method: "GET", url: "/me/data-export" })).statusCode).toBe(401);
    });
  });
});
