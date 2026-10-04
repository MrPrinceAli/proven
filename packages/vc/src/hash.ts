import canonicalize from "canonicalize";
import { sha256, toBytes, type Hex } from "viem";

/** The document that is hashed and anchored: the VC without its `proof` (§S7.2 step 1). */
export function stripProof<T extends object>(vc: T): Omit<T, "proof"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { proof: _proof, ...rest } = vc as T & { proof?: unknown };
  return rest;
}

/** RFC 8785 JSON Canonicalization of any JSON value. */
export function jcs(value: unknown): string {
  const canonical = canonicalize(value);
  if (canonical === undefined) throw new Error("JCS failed: value is not JSON-serialisable");
  return canonical;
}

/**
 * credentialHash = SHA-256(JCS(vc without proof)) as bytes32 (golden rule #5).
 * The proof is always stripped, so a signed and an unsigned VC hash the same.
 */
export function credentialHash(vc: object): Hex {
  return sha256(toBytes(jcs(stripProof(vc))));
}

/** subjectRef = SHA-256(UTF-8(credentialSubject.id)) as bytes32. */
export function subjectRef(subjectDid: string): Hex {
  return sha256(toBytes(subjectDid));
}
