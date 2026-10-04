import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";

export const PROBLEM_BASE = "https://proven.app/problems/";

/** Problem slugs from §S9.4 (plus internal-error for unexpected failures). */
export type ProblemSlug =
  | "evidence-required"
  | "validation-error"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "integrity-mismatch"
  | "payload-too-large"
  | "unsupported-media-type"
  | "rate-limited"
  | "ai-output-invalid"
  | "chain-unavailable"
  | "already-anchored"
  | "internal-error";

const TITLES: Record<ProblemSlug, string> = {
  "evidence-required": "Evidence required",
  "validation-error": "Validation error",
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
  "not-found": "Not found",
  conflict: "Conflict",
  "integrity-mismatch": "Integrity mismatch",
  "payload-too-large": "Payload too large",
  "unsupported-media-type": "Unsupported media type",
  "rate-limited": "Too many requests",
  "ai-output-invalid": "AI output invalid",
  "chain-unavailable": "Chain unavailable",
  "already-anchored": "Already anchored",
  "internal-error": "Internal server error",
};

const SLUG_BY_STATUS: Record<number, ProblemSlug> = {
  400: "validation-error",
  401: "unauthorized",
  403: "forbidden",
  404: "not-found",
  409: "conflict",
  413: "payload-too-large",
  415: "unsupported-media-type",
  422: "evidence-required",
  429: "rate-limited",
};

/** Throw from handlers to answer with an RFC 9457 problem. */
export class ProblemError extends Error {
  constructor(
    readonly status: number,
    readonly slug: ProblemSlug,
    readonly detail?: string,
    readonly extensions: Record<string, unknown> = {},
  ) {
    super(detail ?? TITLES[slug]);
  }
}

export const problem = (
  status: number,
  slug: ProblemSlug,
  detail?: string,
  extensions?: Record<string, unknown>,
) => new ProblemError(status, slug, detail, extensions);

function send(
  reply: FastifyReply,
  status: number,
  slug: ProblemSlug,
  detail?: string,
  extensions: Record<string, unknown> = {},
) {
  return reply
    .code(status)
    .type("application/problem+json")
    .send({
      type: `${PROBLEM_BASE}${slug}`,
      title: TITLES[slug],
      status,
      ...(detail ? { detail } : {}),
      instance: reply.request.url,
      ...extensions,
    });
}

export function registerProblemHandlers(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | ProblemError | ZodError, request, reply) => {
    if (error instanceof ProblemError) {
      return send(reply, error.status, error.slug, error.detail, error.extensions);
    }
    if (error instanceof ZodError) {
      return send(reply, 400, "validation-error", "Request validation failed", {
        errors: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const status = error.statusCode ?? 500;
    if (status < 500) {
      return send(reply, status, SLUG_BY_STATUS[status] ?? "validation-error", error.message);
    }
    request.log.error({ err: error }, "unhandled error");
    return send(reply, 500, "internal-error");
  });

  app.setNotFoundHandler((request, reply) =>
    send(reply, 404, "not-found", `Route ${request.method} ${request.url} not found`),
  );
}
