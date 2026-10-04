import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  EntityType,
  RequestState,
  type ChainAnchor,
  type Credential,
  type CredentialStatus,
  type Issuer,
} from "@proven/db";
import { z } from "zod";
import { audit } from "../audit";
import { requireIssuer, requireUser } from "../auth/guards";
import { CLAIM_KINDS } from "../claims";
import { approveRequest, credentialUrn, rejectRequest, revokeCredential } from "../credentials/service";
import { profileIdentity } from "../identity";
import { problem } from "../problem";
import { assertDemoScope } from "./demo";
import { readEvidence, sendEvidence } from "./evidence";

const IdParam = z.object({ id: z.string().uuid() });
const EvidenceParam = z.object({ id: z.string().uuid(), evidenceId: z.string().uuid() });
const CreateRequest = z
  .object({
    entityType: EntityType,
    entityId: z.string().uuid(),
    issuerId: z.string().uuid(),
    evidenceIds: z.array(z.string().uuid()).max(20).default([]),
  })
  .strict();
const Reason = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
const StateQuery = z.object({ state: RequestState.optional() });

/** Claims in these states may be submitted for verification. */
const REQUESTABLE = new Set(["UNVERIFIED", "EVIDENCE_ATTACHED"]);

type CredentialRow = Credential & {
  issuer: Issuer;
  statusEntry: CredentialStatus | null;
  chainAnchors: ChainAnchor[];
};

/** Public shape of a credential: the VC plus its anchor; never PII beyond what the VC itself holds. */
export function serializeCredential(c: CredentialRow) {
  const anchor = c.chainAnchors[0];
  const vc = c.vcJson as { credentialSubject?: { achievement?: { name?: string } } };
  return {
    id: c.id,
    credentialId: credentialUrn(c.id),
    status: c.status,
    name: vc.credentialSubject?.achievement?.name ?? null,
    issuer: { id: c.issuer.id, name: c.issuer.name, did: c.issuer.did },
    issuedAt: c.issuedAt.toISOString(),
    expiresAt: c.expiresAt?.toISOString() ?? null,
    vcHash: `0x${Buffer.from(c.vcHash).toString("hex")}`,
    revoked: c.statusEntry?.revoked ?? false,
    revokedAt: c.statusEntry?.revokedAt?.toISOString() ?? null,
    revocationReason: c.statusEntry?.reason ?? null,
    anchor: anchor
      ? {
          txHash: anchor.txHash,
          block: anchor.blockNumber === null ? null : Number(anchor.blockNumber),
          contract: anchor.contractAddress,
          chainId: anchor.chainId,
        }
      : null,
    vc: c.vcJson,
  };
}

const credentialInclude = { issuer: true, statusEntry: true, chainAnchors: true } as const;

export async function verificationRoutes(app: FastifyInstance) {
  const { prisma } = app;

  /** Issuer row of the logged-in issuer (requireIssuer already checked DB + on-chain). */
  const currentIssuer = async (request: FastifyRequest) => {
    const issuer = await prisma.issuer.findFirst({
      where: { address: request.auth!.address, verified: true },
    });
    if (!issuer) throw problem(403, "forbidden", "Issuer role required");
    return issuer;
  };

  async function describeRequest(r: { entityType: string; entityId: string; requestedBy: string }) {
    const kind = CLAIM_KINDS[EntityType.parse(r.entityType)];
    const entity = await kind
      .delegate(prisma)
      .findFirst({ where: { id: r.entityId, userId: r.requestedBy } });
    return entity
      ? { label: kind.label(entity), status: entity.status, ...kind.fields(entity) }
      : { label: "(klaim dihapus)", status: null };
  }

  // ----- public -----

  app.get("/issuers", async () => {
    const issuers = await prisma.issuer.findMany({ where: { verified: true }, orderBy: { name: "asc" } });
    return issuers.map((i) => ({ id: i.id, name: i.name, did: i.did, domain: i.domain }));
  });

  // ----- user side -----

  app.post("/me/verification-requests", { preHandler: requireUser }, async (request, reply) => {
    const userId = request.auth!.userId;
    const body = CreateRequest.parse(request.body);
    const kind = CLAIM_KINDS[body.entityType];

    const entity = await kind.delegate(prisma).findFirst({ where: { id: body.entityId, userId } });
    if (!entity) throw problem(404, "not-found", `${body.entityType} not found`);
    if (body.evidenceIds.length === 0) {
      throw problem(
        422,
        "evidence-required",
        `Klaim '${kind.label(entity)}' tidak memiliki bukti yang dapat diverifikasi.`,
      );
    }
    const evidenceIds = [...new Set(body.evidenceIds)];
    const owned = await prisma.evidence.count({ where: { id: { in: evidenceIds }, userId } });
    if (owned !== evidenceIds.length) throw problem(404, "not-found", "Evidence not found");
    // Only evidence linked to this claim may back the request (D-035).
    const linked = await prisma.evidenceLink.count({
      where: { evidenceId: { in: evidenceIds }, entityType: body.entityType, entityId: body.entityId },
    });
    if (linked !== evidenceIds.length) {
      throw problem(422, "evidence-required", "Semua bukti yang diajukan harus tertaut ke klaim ini");
    }

    const issuer = await prisma.issuer.findFirst({ where: { id: body.issuerId, verified: true } });
    if (!issuer) throw problem(404, "not-found", "Issuer not found");
    // No self-issuance: an issuer cannot verify their own claims (D-035).
    const self = await prisma.wallet.count({ where: { userId, address: issuer.address } });
    if (self > 0) throw problem(403, "forbidden", "Issuer tidak bisa memverifikasi klaimnya sendiri");
    if (!REQUESTABLE.has(entity.status)) {
      throw problem(409, "conflict", `Klaim berstatus ${entity.status} tidak bisa diajukan`);
    }

    const created = await prisma.$transaction(async (tx) => {
      const pending = await tx.verificationRequest.findFirst({
        where: { entityType: body.entityType, entityId: body.entityId, state: "pending" },
      });
      if (pending) throw problem(409, "conflict", "Klaim ini sudah menunggu issuer");
      const row = await tx.verificationRequest.create({
        data: {
          entityType: body.entityType,
          entityId: body.entityId,
          issuerId: issuer.id,
          requestedBy: userId,
          evidenceIds,
        },
      });
      await kind.delegate(tx).update({ where: { id: body.entityId }, data: { status: "PENDING_ISSUER" } });
      await audit(tx, {
        actorType: "user",
        actorId: userId,
        action: "verification.requested",
        entityType: body.entityType,
        entityId: body.entityId,
        after: { requestId: row.id, issuerId: issuer.id, evidenceIds },
        ip: request.ip,
      });
      return row;
    });

    return reply.code(201).send({
      id: created.id,
      entityType: created.entityType,
      entityId: created.entityId,
      issuerId: created.issuerId,
      evidenceIds: created.evidenceIds,
      state: created.state,
      createdAt: created.createdAt.toISOString(),
    });
  });

  app.get("/me/verification-requests", { preHandler: requireUser }, async (request) => {
    const rows = await prisma.verificationRequest.findMany({
      where: { requestedBy: request.auth!.userId },
      include: { issuer: true },
      orderBy: { createdAt: "desc" },
    });
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        claim: await describeRequest(r),
        issuer: { id: r.issuer.id, name: r.issuer.name },
        state: r.state,
        evidenceIds: r.evidenceIds,
        reason: r.decisionReason,
        createdAt: r.createdAt.toISOString(),
        decidedAt: r.decidedAt?.toISOString() ?? null,
        credentialId:
          r.state === "approved" && r.draftCredentialId ? credentialUrn(r.draftCredentialId) : null,
      })),
    );
  });

  app.get("/me/credentials", { preHandler: requireUser }, async (request) => {
    const rows = await prisma.credential.findMany({
      where: { subjectUserId: request.auth!.userId },
      include: credentialInclude,
      orderBy: { issuedAt: "desc" },
    });
    return rows.map(serializeCredential);
  });

  // ----- issuer side (requireIssuer + only this issuer's records; others → 404) -----

  app.get("/issuer/verification-requests", { preHandler: requireIssuer }, async (request) => {
    const issuer = await currentIssuer(request);
    const { state } = StateQuery.parse(request.query);
    const rows = await prisma.verificationRequest.findMany({
      where: {
        issuerId: issuer.id,
        ...(state ? { state } : {}),
        // Demo issuers only see demo sandboxes (D-032).
        ...(request.auth!.via === "demo" ? { requester: { authProvider: "demo" } } : {}),
      },
      include: { requester: { include: { wallets: true, profile: true } } },
      // Demo issuers see the newest sandbox first — usually the visitor's own (D-032).
      orderBy: { createdAt: request.auth!.via === "demo" ? "desc" : "asc" },
    });
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        claim: await describeRequest(r),
        requester: {
          did: r.requester.wallets[0]?.did ?? null,
          slug: r.requester.profile?.visibility === "public" ? r.requester.profile.slug : null,
          headline: r.requester.profile?.headline ?? "",
          // The requester shares their name with the issuer they ask (D-034).
          ...profileIdentity(r.requester.profile),
        },
        state: r.state,
        evidenceCount: r.evidenceIds.length,
        createdAt: r.createdAt.toISOString(),
        decidedAt: r.decidedAt?.toISOString() ?? null,
      })),
    );
  });

  const ownRequest = async (request: FastifyRequest, id: string) => {
    const issuer = await currentIssuer(request);
    const row = await prisma.verificationRequest.findFirst({
      where: { id, issuerId: issuer.id },
      include: { requester: { include: { wallets: true, profile: true } } },
    });
    if (!row) throw problem(404, "not-found", "Verification request not found");
    await assertDemoScope(request, row.requestedBy);
    return { issuer, row };
  };

  app.get("/issuer/verification-requests/:id", { preHandler: requireIssuer }, async (request) => {
    const { id } = IdParam.parse(request.params);
    const { row } = await ownRequest(request, id);
    const evidence = await prisma.evidence.findMany({ where: { id: { in: row.evidenceIds } } });
    return {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      claim: await describeRequest(row),
      requester: {
        did: row.requester.wallets[0]?.did ?? null,
        slug: row.requester.profile?.visibility === "public" ? row.requester.profile.slug : null,
        headline: row.requester.profile?.headline ?? "",
        ...profileIdentity(row.requester.profile),
      },
      state: row.state,
      reason: row.decisionReason,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
      evidence: evidence.map((e) => {
        const m = e.metadata as { title?: string; filename?: string };
        return {
          id: e.id,
          type: e.type,
          title: m.title ?? null,
          filename: m.filename ?? null,
          mimeType: e.mimeType,
          sizeBytes: e.sizeBytes === null ? null : Number(e.sizeBytes),
          sha256: Buffer.from(e.sha256).toString("hex"),
          capturedAt: e.capturedAt.toISOString(),
        };
      }),
    };
  });

  app.get(
    "/issuer/verification-requests/:id/evidence/:evidenceId",
    { preHandler: requireIssuer },
    async (request, reply) => {
      const { id, evidenceId } = EvidenceParam.parse(request.params);
      const { issuer, row } = await ownRequest(request, id);
      // Only evidence attached to this request, never the user's other files.
      if (!row.evidenceIds.includes(evidenceId)) throw problem(404, "not-found", "Evidence not found");
      const evidence = await prisma.evidence.findUnique({ where: { id: evidenceId } });
      if (!evidence) throw problem(404, "not-found", "Evidence not found");
      const { plaintext, digest } = await readEvidence(app, evidence);
      await audit(prisma, {
        actorType: "issuer",
        actorId: issuer.id,
        action: "evidence.reviewed",
        entityType: "evidence",
        entityId: evidenceId,
        after: { requestId: id },
        ip: request.ip,
      });
      return sendEvidence(reply, evidence, plaintext, digest);
    },
  );

  app.post("/issuer/verification-requests/:id/approve", { preHandler: requireIssuer }, async (request) => {
    const { id } = IdParam.parse(request.params);
    const { issuer } = await ownRequest(request, id);
    return approveRequest(app, issuer, id, request.ip);
  });

  app.post("/issuer/verification-requests/:id/reject", { preHandler: requireIssuer }, async (request) => {
    const { id } = IdParam.parse(request.params);
    const { reason } = Reason.parse(request.body);
    const { issuer } = await ownRequest(request, id);
    await rejectRequest(app, issuer, id, reason, request.ip);
    return { id, state: "rejected", reason };
  });

  app.get("/issuer/credentials", { preHandler: requireIssuer }, async (request) => {
    const issuer = await currentIssuer(request);
    const rows = await prisma.credential.findMany({
      where: {
        issuerId: issuer.id,
        ...(request.auth!.via === "demo" ? { subject: { authProvider: "demo" } } : {}),
      },
      include: credentialInclude,
      orderBy: { issuedAt: "desc" },
    });
    return rows.map(serializeCredential);
  });

  app.post("/issuer/credentials/:id/revoke", { preHandler: requireIssuer }, async (request) => {
    const { id } = IdParam.parse(request.params);
    const { reason } = Reason.parse(request.body);
    const issuer = await currentIssuer(request);
    const credential = await prisma.credential.findFirst({ where: { id, issuerId: issuer.id } });
    if (credential) await assertDemoScope(request, credential.subjectUserId);
    return revokeCredential(app, issuer, id, reason, request.ip);
  });
}
