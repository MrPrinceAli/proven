import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildAchievementVC,
  credentialHash,
  didFromAddress,
  signCredential,
  subjectRef,
  verifyVC,
} from "@proven/vc";
import type { Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterAll, describe, expect, it } from "vitest";
import { createChainAdapter } from "../src/chain/adapter";
import { ProblemError } from "../src/problem";
import { hasDatabase, testPrisma } from "./helpers";

// Requires `anvil` + `pnpm contracts:deploy:local` (the CI build job does both).
const RPC = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";
const deploymentsFile = fileURLToPath(
  new URL("../../../packages/contracts/deployments/31337.json", import.meta.url),
);
// Anvil default key #1: the issuer registered by deploy-local.sh. Public test key, never used on a real chain.
const ISSUER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

async function anvilReady(): Promise<boolean> {
  if (!existsSync(deploymentsFile)) return false;
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    return (await res.json()).result === "0x7a69";
  } catch {
    return false;
  }
}

const ready = hasDatabase && (await anvilReady());
if (process.env.REQUIRE_ANVIL && !ready) {
  throw new Error("REQUIRE_ANVIL is set but Anvil, deployments/31337.json or DATABASE_URL_TEST is missing");
}

describe.skipIf(!ready)("chain adapter against Anvil (hash parity)", () => {
  const deployment = ready
    ? (JSON.parse(readFileSync(deploymentsFile, "utf8")) as {
        credentialRegistry: Address;
        issuerRegistry: Address;
      })
    : { credentialRegistry: "0x0" as Address, issuerRegistry: "0x0" as Address };
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
      issuerPrivateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
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
