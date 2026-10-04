import { createAnthropicClient } from "./llm";
import { createMockClient } from "./mock";

export {
  guardClaimCheck,
  guardCv,
  guardSummary,
  guardTailor,
  ruleStatus,
  validCitations,
} from "./guardrails";
export type { ClaimFact, Guarded } from "./guardrails";
export { AiOutputInvalidError, createAnthropicClient, userContent } from "./llm";
export type { AnthropicOptions, GenerateRequest, LlmClient } from "./llm";
export { createMockClient, defaultFixtures } from "./mock";
export type { MockFixture } from "./mock";
export { PROMPTS } from "./prompts";
export { CLAIM_CHECK_STATUSES, EVIDENCE_TYPES, NO_EVIDENCE_NOTE } from "./schemas";
export type { ClaimCheckOutput, ClassifyOutput, CvOutput, SummaryOutput, TailorOutput } from "./schemas";
export { claimCheck, classifyEvidence, generateCv, summarize, tailorCv } from "./service";
export type { AiResult } from "./service";
export { SKILL_LEXICON, mentions, skillsInText } from "./skills";
export { escapeSourceText, MAX_JOB_DESCRIPTION, renderSourcePack, sanitize } from "./source-pack";
export type { SourceItem, SourcePack } from "./source-pack";

/** Builds the configured client: "anthropic" needs LLM_API_KEY; "mock" is for dev, tests and CI. */
export function createLlmClient(options: {
  provider: "anthropic" | "mock";
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}) {
  if (options.provider === "mock") return createMockClient();
  if (!options.apiKey) throw new Error("LLM_API_KEY is required when LLM_PROVIDER=anthropic");
  return createAnthropicClient({
    apiKey: options.apiKey,
    model: options.model || "claude-opus-5-5",
    timeoutMs: options.timeoutMs,
  });
}
