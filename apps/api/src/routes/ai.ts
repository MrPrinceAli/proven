import {
  AiOutputInvalidError,
  claimCheck,
  classifyEvidence,
  generateCv,
  summarize,
  tailorCv,
  type LlmClient,
} from "@proven/ai";
import { EntityType } from "@proven/db";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { buildClaimFacts, buildSourcePack } from "../ai/source-pack";
import { audit } from "../audit";
import { requireIssuer, requireUser } from "../auth/guards";
import { SESSION_COOKIE } from "../auth/session";
import { problem } from "../problem";

declare module "fastify" {
  interface FastifyInstance {
    llm: LlmClient;
    aiRateLimit: number;
  }
}

const SummaryBody = z.object({ freeText: z.string().max(4000).optional() }).strict();
const CvBody = z.object({ jobDescription: z.string().max(20_000).optional() }).strict();
const ClassifyBody = z.object({ evidenceId: z.string().uuid() }).strict();
const ClaimCheckBody = z
  .object({ entityType: EntityType.optional(), entityId: z.string().uuid().optional() })
  .strict()
  .refine((b) => Boolean(b.entityType) === Boolean(b.entityId), "entityType and entityId go together");
const IdParam = z.object({ id: z.string().uuid() });

/** AI failures become 502 ai-output-invalid; nothing partial is ever returned. */
async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AiOutputInvalidError) {
      const detail = {
        invalid: "Output AI tidak sesuai skema setelah dicoba ulang.",
        refusal: "AI menolak permintaan ini.",
        timeout: "AI tidak menjawab dalam batas waktu.",
        unavailable: "Layanan AI sedang tidak tersedia.",
      }[error.reason];
      throw problem(502, "ai-output-invalid", detail);
    }
    throw error;
  }
}

export async function aiRoutes(app: FastifyInstance) {
  const { prisma } = app;
  // Strict per-user limit for AI endpoints (§W6): keyed by session cookie, falling back to IP.
  const aiLimit = {
    rateLimit: {
      max: app.aiRateLimit,
      timeWindow: "1 minute",
      keyGenerator: (req: FastifyRequest) => `ai:${req.cookies[SESSION_COOKIE] ?? req.ip}`,
    },
  };
  const opts = { preHandler: requireUser, config: aiLimit };

  /** Draft only — the user saves it through PATCH /me/profile (golden rule #6). */
  app.post("/ai/summary", opts, async (request) => {
    const { freeText } = SummaryBody.parse(request.body ?? {});
    const pack = await buildSourcePack(prisma, request.auth!.userId);
    return run(() => summarize(app.llm, pack, freeText));
  });

  app.post("/ai/cv", opts, async (request) => {
    const { jobDescription } = CvBody.parse(request.body ?? {});
    const pack = await buildSourcePack(prisma, request.auth!.userId);
    if (jobDescription?.trim()) {
      return { mode: "tailor" as const, ...(await run(() => tailorCv(app.llm, pack, jobDescription))) };
    }
    return { mode: "cv" as const, ...(await run(() => generateCv(app.llm, pack))) };
  });

  /** Stores ai_type/ai_confidence as a suggestion; evidence.type changes only when the user applies it. */
  app.post("/ai/classify-evidence", opts, async (request) => {
    const userId = request.auth!.userId;
    const { evidenceId } = ClassifyBody.parse(request.body);
    const pack = await buildSourcePack(prisma, userId);
    const item = pack.find((s) => s.id === `evidence:${evidenceId}`);
    if (!item) throw problem(404, "not-found", "Evidence not found");

    const res = await run(() => classifyEvidence(app.llm, [item]));
    await prisma.evidence.update({
      where: { id: evidenceId },
      data: { aiType: res.result.type, aiConfidence: Math.round(res.result.confidence * 100) / 100 },
    });
    await audit(prisma, {
      actorType: "user",
      actorId: userId,
      action: "evidence.classified",
      entityType: "evidence",
      entityId: evidenceId,
      after: { aiType: res.result.type, aiConfidence: res.result.confidence, model: res.model },
      ip: request.ip,
    });
    return { evidenceId, ...res };
  });

  app.post("/ai/claim-check", opts, async (request) => {
    const userId = request.auth!.userId;
    const body = ClaimCheckBody.parse(request.body ?? {});
    const only =
      body.entityType && body.entityId ? { entityType: body.entityType, entityId: body.entityId } : undefined;
    const facts = await buildClaimFacts(prisma, userId, only);
    if (only && facts.length === 0) throw problem(404, "not-found", `${only.entityType} not found`);
    const pack = await buildSourcePack(prisma, userId);
    return run(() => claimCheck(app.llm, pack, facts));
  });

  /** The same claim-check as a suggestion for the issuer reviewing a request. */
  app.get(
    "/issuer/verification-requests/:id/claim-check",
    { preHandler: requireIssuer, config: aiLimit },
    async (request) => {
      const { id } = IdParam.parse(request.params);
      const issuer = await prisma.issuer.findFirst({
        where: { address: request.auth!.address, verified: true },
      });
      const row =
        issuer && (await prisma.verificationRequest.findFirst({ where: { id, issuerId: issuer.id } }));
      if (!row) throw problem(404, "not-found", "Verification request not found");
      const facts = await buildClaimFacts(prisma, row.requestedBy, {
        entityType: row.entityType,
        entityId: row.entityId,
      });
      const pack = await buildSourcePack(prisma, row.requestedBy);
      return {
        note: "AI hanya asisten. Keputusan ada di tangan issuer.",
        ...(await run(() => claimCheck(app.llm, pack, facts))),
      };
    },
  );
}
