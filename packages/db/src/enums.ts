import { z } from "zod";

// Text columns in the DDL validated in code instead of Postgres enums (D-016).

export const claimStatuses = [
  "UNVERIFIED",
  "EVIDENCE_ATTACHED",
  "PENDING_ISSUER",
  "VERIFIED",
  "EXPIRED",
  "REVOKED",
] as const;
export const ClaimStatus = z.enum(claimStatuses);
export type ClaimStatus = z.infer<typeof ClaimStatus>;

/** Display-only label from AI claim-check; never stored as an entity status (§S4). */
export const CLAIM_WITHOUT_EVIDENCE = "CLAIM_WITHOUT_EVIDENCE" as const;

export const Visibility = z.enum(["public", "private", "recruiter-only"]);
export type Visibility = z.infer<typeof Visibility>;

export const RequestState = z.enum(["pending", "approved", "rejected"]);
export type RequestState = z.infer<typeof RequestState>;

export const CredentialState = z.enum(["active", "expired", "revoked"]);
export type CredentialState = z.infer<typeof CredentialState>;

export const EvidenceType = z.enum([
  "certificate",
  "award",
  "hackathon",
  "competition",
  "project",
  "community",
  "employment",
  "education",
]);
export type EvidenceType = z.infer<typeof EvidenceType>;

export const EntityType = z.enum(["skill", "experience", "project", "achievement", "community_role"]);
export type EntityType = z.infer<typeof EntityType>;

export const SkillLevel = z.enum(["beginner", "intermediate", "advanced", "expert"]);
export type SkillLevel = z.infer<typeof SkillLevel>;

export const UserStatus = z.enum(["active", "suspended", "deleted"]);
export type UserStatus = z.infer<typeof UserStatus>;
