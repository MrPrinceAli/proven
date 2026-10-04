import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod/v4";
import { renderSourcePack, type SourcePack } from "./source-pack";

export interface GenerateRequest<T> {
  /** Task name, e.g. "summary"; mock fixtures are keyed by it. */
  task: string;
  system: string;
  sourcePack: SourcePack;
  /** Task-specific instruction/input appended after the sources (already sanitised). */
  input: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

export interface LlmClient {
  readonly provider: "anthropic" | "mock";
  readonly model: string;
  generateStructured<T>(request: GenerateRequest<T>): Promise<T>;
}

/** The model returned something that did not satisfy the schema twice, or refused, or timed out. */
export class AiOutputInvalidError extends Error {
  constructor(
    message: string,
    readonly reason: "invalid" | "refusal" | "timeout" | "unavailable",
  ) {
    super(message);
  }
}

export function userContent(sourcePack: SourcePack, input: string): string {
  return `<sources>\n${renderSourcePack(sourcePack)}\n</sources>\n\n${input}`;
}

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  /** NFR-02: answers within 10 s. */
  timeoutMs?: number;
}

/**
 * Structured output through `output_config.format` (forced tool_choice is rejected by Claude Opus 5.5),
 * low effort for latency, server-side refusal fallback, and one retry when the output fails validation.
 */
export function createAnthropicClient({ apiKey, model, timeoutMs = 10_000 }: AnthropicOptions): LlmClient {
  // Our own single retry below covers invalid output; SDK retries would multiply the latency budget.
  const client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 0 });

  async function attempt<T>(req: GenerateRequest<T>): Promise<T | null> {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: req.maxTokens ?? 4000,
      system: req.system,
      messages: [{ role: "user", content: userContent(req.sourcePack, req.input) }],
      output_config: { effort: "low", format: betaZodOutputFormat(req.schema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal") {
      throw new AiOutputInvalidError("The model declined this request", "refusal");
    }
    return (response.parsed_output as T | null) ?? null;
  }

  return {
    provider: "anthropic",
    model,
    async generateStructured<T>(req: GenerateRequest<T>) {
      for (let i = 0; i < 2; i += 1) {
        try {
          const parsed = await attempt(req);
          const checked = parsed === null ? null : req.schema.safeParse(parsed);
          if (checked?.success) return checked.data;
        } catch (error) {
          if (error instanceof AiOutputInvalidError) throw error;
          if (error instanceof Anthropic.APIConnectionTimeoutError) {
            throw new AiOutputInvalidError("The AI did not answer within the time limit", "timeout");
          }
          if (error instanceof Anthropic.APIError) {
            throw new AiOutputInvalidError(`AI provider error ${error.status ?? ""}`.trim(), "unavailable");
          }
          // Parse errors from the SDK helper count as invalid output: retry once.
        }
      }
      throw new AiOutputInvalidError("The AI output did not match the expected schema", "invalid");
    },
  };
}
