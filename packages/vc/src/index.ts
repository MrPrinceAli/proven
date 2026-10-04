// Isomorphic VC toolkit (Node + browser): no node:* imports — hashing uses viem's sha256.
export { buildAchievementVC, isoSeconds } from "./build";
export type { BuildAchievementInput } from "./build";
export { addressFromDid, chainIdFromDid, didFromAddress } from "./did";
export {
  credentialTypes,
  getTypedData,
  issuerAddressOf,
  provenDomain,
  signCredential,
  verifyCredentialSignature,
} from "./eip712";
export type { SignOptions, TypedDataInput } from "./eip712";
export { credentialHash, jcs, stripProof, subjectRef } from "./hash";
export {
  AchievementSchema,
  CredentialStatusSchema,
  PROVEN_ACHIEVEMENT_CONTEXT,
  PROVEN_CRYPTOSUITE,
  ProofSchema,
  VC_V2_CONTEXT,
  VerifiableCredentialSchema,
} from "./schema";
export type { CredentialProof, UnsignedCredential, VerifiableCredential } from "./schema";
export { anchorFromTuple, verifyVC } from "./verify";
export type { Anchor, VerificationOverall, VerificationReport, VerifyVcInput } from "./verify";
