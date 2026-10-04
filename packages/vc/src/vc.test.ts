import { createHash } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { addressFromDid, didFromAddress } from "./did";
import { signCredential, verifyCredentialSignature } from "./eip712";
import { FIXTURE_INPUT, fixtureVC } from "./fixtures";
import { credentialHash, jcs, stripProof, subjectRef } from "./hash";
import { VerifiableCredentialSchema } from "./schema";
import { anchorFromTuple, verifyVC, type Anchor } from "./verify";

/** Golden vector: if this changes, every anchored credential would stop verifying. */
const GOLDEN_HASH = "0x4933d97f4509f1686c8b2c157134605198b5e1ba686dcc6d6bf37a3f9a8b1a1f";
const GOLDEN_SUBJECT_REF = "0x0363718761c8fa81ac70a478beab4bf58d9a1beab448072133a209fd19360ef8";

// Anvil default key #1 — public test key; its address is the fixture issuer.
const ISSUER = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const OTHER = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const CHAIN = { chainId: 97, verifyingContract: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const };

/** Independent canonical JSON for plain string/array/object data (sorted keys, no whitespace). */
function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${sortedJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

describe("DID helpers", () => {
  it("builds did:ethr from a lowercase address", () => {
    expect(didFromAddress(97, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")).toBe(FIXTURE_INPUT.issuer.did);
  });

  it("extracts the checksummed address back", () => {
    expect(addressFromDid(FIXTURE_INPUT.issuer.did)).toBe(ISSUER.address);
    expect(addressFromDid("did:web:example.com")).toBeNull();
  });
});

describe("credentialHash (golden rule #5)", () => {
  it("matches the golden vector", () => {
    expect(credentialHash(fixtureVC())).toBe(GOLDEN_HASH);
    expect(subjectRef(FIXTURE_INPUT.subjectDid)).toBe(GOLDEN_SUBJECT_REF);
  });

  it("equals sha256 of the canonical JSON computed independently", () => {
    const vc = fixtureVC();
    expect(jcs(vc)).toBe(sortedJson(vc));
    expect(credentialHash(vc)).toBe(`0x${createHash("sha256").update(sortedJson(vc), "utf8").digest("hex")}`);
    expect(subjectRef(vc.credentialSubject.id)).toBe(
      `0x${createHash("sha256").update(vc.credentialSubject.id, "utf8").digest("hex")}`,
    );
  });

  it("is independent of key order at every depth (JCS)", () => {
    const reverseKeys = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(reverseKeys)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .reverse()
                .map(([k, v]) => [k, reverseKeys(v)]),
            )
          : value;
    const vc = fixtureVC();
    const reversed = reverseKeys(vc) as typeof vc;
    expect(JSON.stringify(reversed)).not.toBe(JSON.stringify(vc));
    expect(credentialHash(reversed)).toBe(GOLDEN_HASH);
  });

  it("changes when a single character changes", () => {
    const vc = fixtureVC();
    vc.credentialSubject.achievement.name = "XYZ Hackathon 2026 — Winnen";
    expect(credentialHash(vc)).not.toBe(GOLDEN_HASH);
  });

  it("ignores the proof", async () => {
    const signed = await signCredential(ISSUER, fixtureVC(), CHAIN);
    expect(signed.proof).toBeDefined();
    expect(credentialHash(signed)).toBe(GOLDEN_HASH);
    expect(stripProof(signed)).toEqual(fixtureVC());
  });
});

describe("EIP-712 proof", () => {
  it("round-trips: the issuer signature verifies and the VC matches the schema", async () => {
    const signed = await signCredential(ISSUER, fixtureVC(), {
      ...CHAIN,
      created: new Date("2026-09-20T09:00:01Z"),
    });
    expect(VerifiableCredentialSchema.safeParse(signed).success).toBe(true);
    expect(signed.proof).toMatchObject({
      type: "DataIntegrityProof",
      cryptosuite: "eip712-secp256k1-proven-2026",
      created: "2026-09-20T09:00:01Z",
      verificationMethod: `${FIXTURE_INPUT.issuer.did}#controller`,
      proofPurpose: "assertionMethod",
    });
    expect(await verifyCredentialSignature(signed, ISSUER.address, CHAIN)).toBe(true);
  });

  it("rejects a signature made with another key", async () => {
    const signed = await signCredential(OTHER, fixtureVC(), CHAIN);
    expect(await verifyCredentialSignature(signed, ISSUER.address, CHAIN)).toBe(false);
  });

  it("is bound to the chain and contract (domain separator)", async () => {
    const signed = await signCredential(ISSUER, fixtureVC(), CHAIN);
    expect(await verifyCredentialSignature(signed, ISSUER.address, { ...CHAIN, chainId: 56 })).toBe(false);
  });
});

describe("verifyVC", () => {
  const anchored = (overrides: Partial<Anchor> = {}): Anchor => ({
    credentialHash: GOLDEN_HASH,
    subjectRef: GOLDEN_SUBJECT_REF,
    issuer: ISSUER.address,
    issuedAt: 1_790_000_000n,
    revoked: false,
    ...overrides,
  });
  const reader = (anchor: Anchor | null) => async (hash: string) =>
    anchor && hash === anchor.credentialHash ? anchor : null;
  const now = new Date("2027-01-01T00:00:00Z");

  it("reports valid for an anchored, signed, unexpired VC", async () => {
    const vc = await signCredential(ISSUER, fixtureVC(), CHAIN);
    const report = await verifyVC({
      vc,
      readAnchor: reader(anchored()),
      ...CHAIN,
      now,
      expectedHash: GOLDEN_HASH,
    });
    expect(report).toMatchObject({
      schemaValid: true,
      hashMatches: true,
      anchorFound: true,
      subjectMatches: true,
      issuerMatches: true,
      signatureValid: true,
      revoked: false,
      expired: false,
      overall: "valid",
    });
  });

  it("reports revoked", async () => {
    const vc = await signCredential(ISSUER, fixtureVC(), CHAIN);
    const report = await verifyVC({ vc, readAnchor: reader(anchored({ revoked: true })), ...CHAIN, now });
    expect(report.overall).toBe("revoked");
  });

  it("reports expired after validUntil", async () => {
    const vc = await signCredential(ISSUER, fixtureVC(), CHAIN);
    const report = await verifyVC({
      vc,
      readAnchor: reader(anchored()),
      ...CHAIN,
      now: new Date("2032-01-01T00:00:00Z"),
    });
    expect(report.overall).toBe("expired");
  });

  it("reports tampered when one character of a signed VC changes", async () => {
    const vc = await signCredential(ISSUER, fixtureVC(), CHAIN);
    const forged = {
      ...vc,
      credentialSubject: {
        ...vc.credentialSubject,
        achievement: { ...vc.credentialSubject.achievement, name: "XYZ Hackathon 2026 — Winnen" },
      },
    };
    const report = await verifyVC({ vc: forged, readAnchor: reader(anchored()), ...CHAIN, now });
    expect(report).toMatchObject({ anchorFound: false, signatureValid: false, overall: "tampered" });
  });

  it("reports tampered when the hash differs from the expected one", async () => {
    const vc = fixtureVC();
    const report = await verifyVC({
      vc,
      readAnchor: reader(null),
      ...CHAIN,
      now,
      expectedHash: `0x${"ab".repeat(32)}`,
    });
    expect(report).toMatchObject({ hashMatches: false, overall: "tampered" });
  });

  it("reports tampered when the anchor names another issuer", async () => {
    const vc = await signCredential(ISSUER, fixtureVC(), CHAIN);
    const report = await verifyVC({
      vc,
      readAnchor: reader(anchored({ issuer: OTHER.address })),
      ...CHAIN,
      now,
    });
    expect(report).toMatchObject({ issuerMatches: false, overall: "tampered" });
  });

  it("reports not_anchored for an untouched VC that was never anchored", async () => {
    const vc = await signCredential(ISSUER, fixtureVC(), CHAIN);
    const report = await verifyVC({ vc, readAnchor: reader(null), ...CHAIN, now });
    expect(report.overall).toBe("not_anchored");
  });

  it("reports tampered for a document that is not a Proven VC", async () => {
    const report = await verifyVC({ vc: { hello: "world" }, readAnchor: reader(null), ...CHAIN, now });
    expect(report).toMatchObject({ schemaValid: false, overall: "tampered" });
  });

  it("parses the getAnchor tuple and treats a zero hash as missing", () => {
    expect(
      anchorFromTuple([`0x${"0".repeat(64)}`, `0x${"0".repeat(64)}`, ISSUER.address, 0n, false]),
    ).toBeNull();
    expect(anchorFromTuple([GOLDEN_HASH, GOLDEN_SUBJECT_REF, ISSUER.address, 5n, true])).toMatchObject({
      revoked: true,
    });
  });
});
