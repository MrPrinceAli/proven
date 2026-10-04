// Model-facing output schemas (§S10.3). zod/v4 because the Anthropic SDK structured-output helper uses it.
import { z } from "zod/v4";

export const EVIDENCE_TYPES = [
  "certificate",
  "award",
  "hackathon",
  "competition",
  "project",
  "community",
  "employment",
  "education",
] as const;

export const CLAIM_CHECK_STATUSES = [
  "VERIFIED",
  "EVIDENCE_ATTACHED",
  "PENDING_ISSUER",
  "CLAIM_WITHOUT_EVIDENCE",
] as const;

/** Exact wording required by golden rule #2 / FR-08. */
export const NO_EVIDENCE_NOTE = "Skill detected — evidence not found.";

const citations = z.array(z.string()).describe("ids of the <source> elements that support this text");

export const SummarySchema = z.object({
  headline: z.string().describe("one-line professional headline"),
  summary: z.string().describe("2-4 sentence profile summary in Indonesian"),
  citations,
});

export const CvSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      items: z.array(z.object({ text: z.string(), citations })),
    }),
  ),
});

export const TailorSchema = z.object({
  matched: z.array(z.object({ skill: z.string(), evidenceId: z.string() })),
  gaps: z.array(z.object({ skill: z.string(), note: z.string() })),
  cv: z.string(),
});

export const ClassifySchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  confidence: z.number().describe("0..1"),
  rationale: z.string(),
});

export const ClaimCheckSchema = z.object({
  claims: z.array(
    z.object({
      claimId: z.string().describe("id of the <source> claim being checked"),
      claim: z.string(),
      status: z.enum(CLAIM_CHECK_STATUSES),
      evidenceIds: z.array(z.string()),
      confidence: z.number().describe("0..1"),
      reason: z.string(),
    }),
  ),
});

export type SummaryOutput = z.infer<typeof SummarySchema>;
export type CvOutput = z.infer<typeof CvSchema>;
export type TailorOutput = z.infer<typeof TailorSchema>;
export type ClassifyOutput = z.infer<typeof ClassifySchema>;
export type ClaimCheckOutput = z.infer<typeof ClaimCheckSchema>;
export type ClaimCheckStatus = (typeof CLAIM_CHECK_STATUSES)[number];
