import {
  buildAchievementVC,
  credentialHash,
  didFromAddress,
  signCredential,
  subjectRef,
  verifyVC,
} from "@proven/vc";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterAll, describe, expect, it } from "vitest";
import { createChainAdapter } from "../src/chain/adapter";
import { ProblemError } from "../src/problem";
import { ANVIL_KEYS, ANVIL_RPC, anvilReady, deployment } from "./anvil";
import { testPrisma } from "./helpers";

const RPC = ANVIL_RPC;
const ISSUER_KEY = ANVIL_KEYS.issuer;
const ready = anvilReady;

describe.skipIf(!ready)("chain adapter against Anvil (hash parity)", () => {
  const issuer = privateKeyToAccount(ISSUER_KEY);
  const chain = createChainAdapter({
    chainId: 31337,
    rpcUrl: RPC,
    registryAddress: deployment.credentialRegistry,
    issuerRegistryAddress: deployment.issuerRegistry,
    issuerPrivateKey: ISSUER_KEY,
    prisma: testPrisma(),
  });
  const verifyOpts = { chainId: 31337, verifyingContract: deployment.credentialRegistry };

  afterAll(() => testPrisma().$disconnect());

  function newVc() {
    const subject = privateKeyToAccount(generatePrivateKey());
    return buildAchievementVC({
      credentialId: crypto.randomUUID(),
      issuer: { did: didFromAddress(31337, issuer.address), name: "XYZ Community" },
      subjectDid: didFromAddress(31337, subject.address),
      achievement: {
        id: `https://xyz-community.example/achievements/${crypto.randomUUID()}`,
        name: "XYZ Hackathon 2026 — Winner",
        description: "First place among 120 teams.",
        criteria: "Judged first place by panel.",
      },
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 5 * 365 * 24 * 3600 * 1000),
      status: { index: 1, listUrl: "https://proven.app/status/xyz/1" },
    });
  }

  it("sees the deploy-local issuer as active", async () => {
    expect(await chain.isIssuerActive(issuer.address)).toBe(true);
    expect(await chain.isIssuerActive("0x000000000000000000000000000000000000dEaD")).toBe(false);
  });

  it("anchors sha256(JCS(vc)) and getAnchor returns the same hash and subjectRef", async () => {
    const vc = newVc();
    const hash = credentialHash(vc);
    const ref = subjectRef(vc.credentialSubject.id);

    const tx = await chain.anchorCredential(hash, ref);
    expect(tx).toMatchObject({ existing: false, txHash: expect.stringMatching(/^0x[0-9a-f]{64}$/) });
    expect(tx.blockNumber).toBeGreaterThan(0n);

    const anchor = await chain.getAnchor(hash);
    expect(anchor).toMatchObject({ credentialHash: hash, subjectRef: ref, revoked: false });
    expect(anchor!.issuer.toLowerCase()).toBe(issuer.address.toLowerCase());
  });

  it("is idempotent: anchoring again returns the original transaction", async () => {
    const vc = newVc();
    const hash = credentialHash(vc);
    const ref = subjectRef(vc.credentialSubject.id);
    const first = await chain.anchorCredential(hash, ref);
    const second = await chain.anchorCredential(hash, ref);
    expect(second).toEqual({ txHash: first.txHash, blockNumber: first.blockNumber, existing: true });
  });

  it("serialises concurrent anchors from the same issuer (no nonce clash)", async () => {
    const vcs = [newVc(), newVc(), newVc()];
    const results = await Promise.all(
      vcs.map((vc) => chain.anchorCredential(credentialHash(vc), subjectRef(vc.credentialSubject.id))),
    );
    expect(new Set(results.map((r) => r.txHash)).size).toBe(3);
    for (const vc of vcs) expect(await chain.getAnchor(credentialHash(vc))).not.toBeNull();
  });

  it("revokes, is idempotent on revoke, and verifyVC reports revoked", async () => {
    const signed = await signCredential(issuer, newVc(), verifyOpts);
    const hash = credentialHash(signed);
    await chain.anchorCredential(hash, subjectRef(signed.credentialSubject.id));

    const before = await verifyVC({
      vc: signed,
      readAnchor: chain.getAnchor,
      ...verifyOpts,
      expectedHash: hash,
    });
    expect(before.overall).toBe("valid");

    const revoke = await chain.revokeCredential(hash);
    expect(revoke.existing).toBe(false);
    expect(await chain.isRevoked(hash)).toBe(true);
    expect((await chain.revokeCredential(hash)).existing).toBe(true);

    const after = await verifyVC({
      vc: signed,
      readAnchor: chain.getAnchor,
      ...verifyOpts,
      expectedHash: hash,
    });
    expect(after).toMatchObject({
      anchorFound: true,
      signatureValid: true,
      revoked: true,
      overall: "revoked",
    });
  });

  it("maps contract reverts to RFC 9457 problems", async () => {
    const unknown = credentialHash(newVc());
    await expect(chain.revokeCredential(unknown)).rejects.toMatchObject({ status: 404, slug: "not-found" });

    const stranger = createChainAdapter({
      chainId: 31337,
      rpcUrl: RPC,
      registryAddress: deployment.credentialRegistry,
      issuerRegistryAddress: deployment.issuerRegistry,
      // Anvil default key #3: not a registered issuer.
      issuerPrivateKey: ANVIL_KEYS.stranger,
      prisma: testPrisma(),
    });
    const vc = newVc();
    const err = await stranger
      .anchorCredential(credentialHash(vc), subjectRef(vc.credentialSubject.id))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProblemError);
    expect(err).toMatchObject({ status: 403, slug: "forbidden" });
  });

  it("answers 502 chain-unavailable when the RPC is down", async () => {
    const offline = createChainAdapter({
      chainId: 31337,
      rpcUrl: "http://127.0.0.1:1",
      registryAddress: deployment.credentialRegistry,
      issuerRegistryAddress: deployment.issuerRegistry,
      prisma: testPrisma(),
    });
    await expect(offline.getAnchor(`0x${"11".repeat(32)}`)).rejects.toMatchObject({
      status: 502,
      slug: "chain-unavailable",
    });
  });
});
