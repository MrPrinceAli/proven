import { z } from "zod";

export const VC_V2_CONTEXT = "https://www.w3.org/ns/credentials/v2";
export const PROVEN_ACHIEVEMENT_CONTEXT = "https://proven.app/contexts/achievement/v1";
/** EIP-712 secp256k1 signature over (credentialHash, subjectRef); see D-011. */
export const PROVEN_CRYPTOSUITE = "eip712-secp256k1-proven-2026";

const isoDateTime = z.string().datetime({ offset: true });
const didEthr = z
  .string()
  .regex(/^did:ethr:(?:\d+|0x[0-9a-fA-F]+):0x[0-9a-f]{40}$/, "did:ethr with lowercase address");

export const AchievementSchema = z
  .object({
    id: z.string().min(1),
    type: z.array(z.string()).refine((t) => t.includes("Achievement"), "must include Achievement"),
    name: z.string().min(1),
    description: z.string(),
    criteria: z.object({ narrative: z.string() }).passthrough(),
  })
  .passthrough();

export const CredentialStatusSchema = z.object({
  id: z.string().url(),
  type: z.literal("BitstringStatusListEntry"),
  statusPurpose: z.literal("revocation"),
  statusListIndex: z.string().regex(/^\d+$/),
  statusListCredential: z.string().url(),
});

export const ProofSchema = z.object({
  type: z.literal("DataIntegrityProof"),
  cryptosuite: z.literal(PROVEN_CRYPTOSUITE),
  created: isoDateTime,
  verificationMethod: z.string().min(1),
  proofPurpose: z.literal("assertionMethod"),
  proofValue: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "65-byte hex signature"),
});

/** W3C VC 2.0 + Open Badges 3.0 achievement credential as issued by Proven (§S7.1). */
export const VerifiableCredentialSchema = z
  .object({
    "@context": z
      .array(z.string())
      .refine((c) => c[0] === VC_V2_CONTEXT, "first @context must be the VC 2.0 context"),
    id: z.string().regex(/^urn:uuid:[0-9a-f-]{36}$/i, "id must be urn:uuid:…"),
    type: z
      .array(z.string())
      .refine((t) => t.includes("VerifiableCredential") && t.includes("OpenBadgeCredential"), {
        message: "type must include VerifiableCredential and OpenBadgeCredential",
      }),
    issuer: z.object({ id: didEthr, name: z.string().min(1) }),
    validFrom: isoDateTime,
    validUntil: isoDateTime.optional(),
    credentialSubject: z.object({ id: didEthr, achievement: AchievementSchema }),
    credentialStatus: CredentialStatusSchema,
    proof: ProofSchema.optional(),
  })
  .strict();

export type VerifiableCredential = z.infer<typeof VerifiableCredentialSchema>;
export type CredentialProof = z.infer<typeof ProofSchema>;
export type UnsignedCredential = Omit<VerifiableCredential, "proof">;
