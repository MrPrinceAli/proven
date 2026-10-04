import { PROVEN_ACHIEVEMENT_CONTEXT, VC_V2_CONTEXT, type UnsignedCredential } from "./schema";

export interface BuildAchievementInput {
  /** UUID of the credentials row; becomes urn:uuid:{id}. */
  credentialId: string;
  issuer: { did: string; name: string };
  subjectDid: string;
  achievement: { id: string; name: string; description: string; criteria: string };
  validFrom: Date | string;
  validUntil?: Date | string;
  status: { index: number; listUrl: string };
  /** Extra VC types, e.g. "HackathonWinner". */
  extraTypes?: string[];
}

/** ISO 8601 UTC without milliseconds, e.g. 2026-09-20T09:00:00Z. */
export function isoSeconds(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${String(value)}`);
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Builds an unsigned W3C VC 2.0 / Open Badges achievement credential (§S7.1). */
export function buildAchievementVC(input: BuildAchievementInput): UnsignedCredential {
  const { index, listUrl } = input.status;
  return {
    "@context": [VC_V2_CONTEXT, PROVEN_ACHIEVEMENT_CONTEXT],
    id: `urn:uuid:${input.credentialId}`,
    type: ["VerifiableCredential", "OpenBadgeCredential", ...(input.extraTypes ?? [])],
    issuer: { id: input.issuer.did, name: input.issuer.name },
    validFrom: isoSeconds(input.validFrom),
    ...(input.validUntil ? { validUntil: isoSeconds(input.validUntil) } : {}),
    credentialSubject: {
      id: input.subjectDid,
      achievement: {
        id: input.achievement.id,
        type: ["Achievement"],
        name: input.achievement.name,
        description: input.achievement.description,
        criteria: { narrative: input.achievement.criteria },
      },
    },
    credentialStatus: {
      id: `${listUrl}#${index}`,
      type: "BitstringStatusListEntry",
      statusPurpose: "revocation",
      statusListIndex: String(index),
      statusListCredential: listUrl,
    },
  };
}
