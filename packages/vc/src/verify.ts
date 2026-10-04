import { isAddressEqual, type Address, type Hex } from "viem";
import { addressFromDid } from "./did";
import { verifyCredentialSignature } from "./eip712";
import { credentialHash, subjectRef } from "./hash";
import { VerifiableCredentialSchema, type VerifiableCredential } from "./schema";

/** What CredentialRegistry.getAnchor returns for a known hash. */
export interface Anchor {
  credentialHash: Hex;
  subjectRef: Hex;
  issuer: Address;
  issuedAt: bigint;
  revoked: boolean;
}

const ZERO = `0x${"0".repeat(64)}`;

/** Converts the getAnchor tuple; an all-zero hash means "not anchored". */
export function anchorFromTuple(tuple: readonly [Hex, Hex, Address, bigint, boolean]): Anchor | null {
  const [hash, subject, issuer, issuedAt, revoked] = tuple;
  if (hash === ZERO) return null;
  return { credentialHash: hash, subjectRef: subject, issuer, issuedAt, revoked };
}

export type VerificationOverall = "valid" | "revoked" | "expired" | "tampered" | "not_anchored";

export interface VerificationReport {
  schemaValid: boolean;
  credentialHash: Hex | null;
  subjectRef: Hex | null;
  /** null when no expected hash was supplied. */
  hashMatches: boolean | null;
  anchorFound: boolean;
  subjectMatches: boolean;
  issuerMatches: boolean;
  signatureValid: boolean;
  revoked: boolean;
  expired: boolean;
  anchor: Anchor | null;
  overall: VerificationOverall;
}

export interface VerifyVcInput {
  vc: unknown;
  /** Reads CredentialRegistry.getAnchor (directly from an RPC in the browser, or via the API). */
  readAnchor: (hash: Hex) => Promise<Anchor | null>;
  chainId: number;
  /** CredentialRegistry address (EIP-712 verifyingContract). */
  verifyingContract: Address;
  /** Hash the verifier expects (e.g. from the issuer's records); a mismatch means tampering. */
  expectedHash?: Hex;
  now?: Date;
}

/** Pure verification: recomputes the hash, reads the anchor and checks subject, issuer, signature and status. */
export async function verifyVC({
  vc,
  readAnchor,
  chainId,
  verifyingContract,
  expectedHash,
  now = new Date(),
}: VerifyVcInput): Promise<VerificationReport> {
  const parsed = VerifiableCredentialSchema.safeParse(vc);
  const schemaValid = parsed.success;
  const doc = (parsed.success ? parsed.data : vc) as Partial<VerifiableCredential> | null;

  let hash: Hex | null = null;
  let subject: Hex | null = null;
  try {
    if (doc && typeof doc === "object") hash = credentialHash(doc);
    if (doc?.credentialSubject?.id) subject = subjectRef(doc.credentialSubject.id);
  } catch {
    hash = null;
  }

  const hashMatches =
    expectedHash && hash ? hash.toLowerCase() === expectedHash.toLowerCase() : expectedHash ? false : null;
  const anchor = hash ? await readAnchor(hash) : null;
  const issuerAddress = doc?.issuer?.id ? addressFromDid(doc.issuer.id) : null;

  const subjectMatches = Boolean(
    anchor && subject && anchor.subjectRef.toLowerCase() === subject.toLowerCase(),
  );
  const issuerMatches = Boolean(anchor && issuerAddress && isAddressEqual(anchor.issuer, issuerAddress));
  const hasProof = Boolean(parsed.success && parsed.data.proof);
  const signatureValid =
    parsed.success && issuerAddress
      ? await verifyCredentialSignature(parsed.data, issuerAddress, { chainId, verifyingContract })
      : false;
  const revoked = anchor?.revoked ?? false;
  const expired = Boolean(doc?.validUntil && Date.parse(doc.validUntil) <= now.getTime());

  let overall: VerificationOverall;
  if (!schemaValid || hashMatches === false) overall = "tampered";
  else if (!anchor) overall = hasProof && !signatureValid ? "tampered" : "not_anchored";
  else if (!subjectMatches || !issuerMatches || (hasProof && !signatureValid)) overall = "tampered";
  else if (revoked) overall = "revoked";
  else if (expired) overall = "expired";
  else overall = "valid";

  return {
    schemaValid,
    credentialHash: hash,
    subjectRef: subject,
    hashMatches,
    anchorFound: Boolean(anchor),
    subjectMatches,
    issuerMatches,
    signatureValid,
    revoked,
    expired,
    anchor,
    overall,
  };
}
