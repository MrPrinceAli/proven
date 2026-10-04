import type { FastifyInstance } from "fastify";
import { EntityType, EvidenceType, type Evidence, type EvidenceLink, type Prisma } from "@proven/db";
import { z } from "zod";
import { audit } from "../audit";
import { requireUser } from "../auth/guards";
import { CLAIM_KINDS, syncClaimStatus } from "../claims";
import { decrypt, encrypt, sha256 } from "../evidence/crypto";
import { detectMime, EXTENSION, type EvidenceMime } from "../evidence/mime";
import { postgresEvidenceStore as store } from "../evidence/store";
import { problem } from "../problem";

/** Vercel Functions accept at most 4.5 MB per request (D-005). */
export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

const IdParam = z.object({ id: z.string().uuid() });
const UploadFields = z.object({
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  type: EvidenceType.default("certificate"),
});
const EvidencePatch = z
  .object({
    type: EvidenceType,
    title: z.string().trim().max(160),
    description: z.string().trim().max(2000),
  })
  .partial()
  .strict();
const LinkTarget = z.object({ entityType: EntityType, entityId: z.string().uuid() });

interface CustodyEvent {
  event: string;
  at: string;
  by: string;
  sha256: string;
}

interface EvidenceMetadata {
  title?: string;
  description?: string;
  filename?: string;
  iv: string;
  tag: string;
  custody: CustodyEvent[];
}

const meta = (e: Evidence) => e.metadata as unknown as EvidenceMetadata;

export function serializeEvidence(e: Evidence & { links: EvidenceLink[] }) {
  const m = meta(e);
  return {
    id: e.id,
    type: e.type,
    title: m.title ?? null,
    description: m.description ?? null,
    filename: m.filename ?? null,
    mimeType: e.mimeType,
    sizeBytes: e.sizeBytes === null ? null : Number(e.sizeBytes),
    sha256: Buffer.from(e.sha256).toString("hex"),
    aiType: e.aiType,
    aiConfidence: e.aiConfidence === null ? null : Number(e.aiConfidence),
    capturedAt: e.capturedAt.toISOString(),
    links: e.links.map((l) => ({ entityType: l.entityType, entityId: l.entityId })),
    custody: m.custody,
  };
}

export async function evidenceRoutes(app: FastifyInstance) {
  const { prisma, config } = app;

  const own = async (id: string, userId: string) => {
    const evidence = await prisma.evidence.findFirst({ where: { id, userId }, include: { links: true } });
    if (!evidence) throw problem(404, "not-found", "Evidence not found");
    return evidence;
  };

  app.post("/me/evidence", { preHandler: requireUser }, async (request, reply) => {
    const userId = request.auth!.userId;
    if (!request.isMultipart()) throw problem(415, "unsupported-media-type", "Use multipart/form-data");

    let file: { data: Buffer; filename: string } | undefined;
    const rawFields: Record<string, string> = {};
    for await (const part of request.parts()) {
      if (part.type === "file") {
        // toBuffer() throws a 413 when the file exceeds limits.fileSize.
        file = { data: await part.toBuffer(), filename: part.filename };
      } else {
        rawFields[part.fieldname] = String(part.value);
      }
    }
    if (!file || file.data.length === 0) throw problem(400, "validation-error", "File is required");

    const fields = UploadFields.parse(rawFields);
    const mime = detectMime(file.data);
    if (!mime) throw problem(415, "unsupported-media-type", "Only PDF, PNG and JPG files are accepted");

    const digest = sha256(file.data);
    const sealed = encrypt(config.evidenceKey, file.data);
    const now = new Date();

    const evidence = await prisma.$transaction(async (tx) => {
      const storageKey = await store.put(tx, sealed.ciphertext);
      const metadata: EvidenceMetadata = {
        ...(fields.title ? { title: fields.title } : {}),
        ...(fields.description ? { description: fields.description } : {}),
        filename: file.filename.slice(0, 200),
        iv: sealed.iv,
        tag: sealed.tag,
        custody: [{ event: "uploaded", at: now.toISOString(), by: userId, sha256: digest.toString("hex") }],
      };
      const created = await tx.evidence.create({
        data: {
          userId,
          type: fields.type,
          storageKey,
          sha256: digest,
          mimeType: mime,
          sizeBytes: file.data.length,
          capturedAt: now,
          metadata: metadata as unknown as Prisma.InputJsonValue,
        },
        include: { links: true },
      });
      await audit(tx, {
        actorType: "user",
        actorId: userId,
        action: "evidence.uploaded",
        entityType: "evidence",
        entityId: created.id,
        after: { sha256: digest.toString("hex"), size: file.data.length, mime },
        ip: request.ip,
      });
      return created;
    });

    return reply.code(201).send(serializeEvidence(evidence));
  });

  app.get("/me/evidence", { preHandler: requireUser }, async (request) => {
    const rows = await prisma.evidence.findMany({
      where: { userId: request.auth!.userId },
      include: { links: true },
      orderBy: { capturedAt: "desc" },
    });
    return rows.map(serializeEvidence);
  });

  app.get("/me/evidence/:id/download", { preHandler: requireUser }, async (request, reply) => {
    const userId = request.auth!.userId;
    const { id } = IdParam.parse(request.params);
    const evidence = await own(id, userId);
    const m = meta(evidence);

    const ciphertext = await store.get(prisma, evidence.storageKey);
    if (!ciphertext) throw problem(409, "integrity-mismatch", "Stored file is missing");
    let plaintext: Buffer;
    try {
      plaintext = decrypt(config.evidenceKey, { ciphertext, iv: m.iv, tag: m.tag });
    } catch {
      throw problem(409, "integrity-mismatch", "Stored file failed authentication");
    }
    const digest = sha256(plaintext);
    if (!digest.equals(Buffer.from(evidence.sha256))) {
      throw problem(409, "integrity-mismatch", "SHA-256 of the stored file does not match the recorded hash");
    }

    await audit(prisma, {
      actorType: "user",
      actorId: userId,
      action: "evidence.downloaded",
      entityType: "evidence",
      entityId: id,
      ip: request.ip,
    });
    const ext = EXTENSION[evidence.mimeType as EvidenceMime] ?? "bin";
    return reply
      .header("content-type", evidence.mimeType ?? "application/octet-stream")
      .header("content-disposition", `attachment; filename="evidence-${id.slice(0, 8)}.${ext}"`)
      .header("cache-control", "private, no-store")
      .header("x-content-sha256", digest.toString("hex"))
      .send(plaintext);
  });

  app.patch("/me/evidence/:id", { preHandler: requireUser }, async (request) => {
    const userId = request.auth!.userId;
    const { id } = IdParam.parse(request.params);
    const patch = EvidencePatch.parse(request.body);
    const evidence = await own(id, userId);
    const m = meta(evidence);

    const metadata: EvidenceMetadata = {
      ...m,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
    };
    const updated = await prisma.evidence.update({
      where: { id },
      data: {
        ...(patch.type ? { type: patch.type } : {}),
        metadata: metadata as unknown as Prisma.InputJsonValue,
      },
      include: { links: true },
    });
    await audit(prisma, {
      actorType: "user",
      actorId: userId,
      action: "evidence.updated",
      entityType: "evidence",
      entityId: id,
      before: { type: evidence.type, title: m.title ?? null },
      after: { type: updated.type, title: metadata.title ?? null },
      ip: request.ip,
    });
    return serializeEvidence(updated);
  });

  app.delete("/me/evidence/:id", { preHandler: requireUser }, async (request, reply) => {
    const userId = request.auth!.userId;
    const { id } = IdParam.parse(request.params);
    const evidence = await own(id, userId);

    await prisma.$transaction(async (tx) => {
      await tx.evidence.delete({ where: { id } }); // evidence_links cascade
      await store.delete(tx, evidence.storageKey);
      for (const link of evidence.links) {
        await syncClaimStatus(tx, CLAIM_KINDS[EntityType.parse(link.entityType)], link.entityId);
      }
      await audit(tx, {
        actorType: "user",
        actorId: userId,
        action: "evidence.deleted",
        entityType: "evidence",
        entityId: id,
        before: { sha256: Buffer.from(evidence.sha256).toString("hex"), links: evidence.links.length },
        ip: request.ip,
      });
    });
    return reply.code(204).send();
  });

  app.post("/me/evidence/:id/links", { preHandler: requireUser }, async (request, reply) => {
    const userId = request.auth!.userId;
    const { id } = IdParam.parse(request.params);
    const target = LinkTarget.parse(request.body);
    await own(id, userId);
    const kind = CLAIM_KINDS[target.entityType];
    const entity = await kind.delegate(prisma).findFirst({ where: { id: target.entityId, userId } });
    if (!entity) throw problem(404, "not-found", `${target.entityType} not found`);

    const status = await prisma.$transaction(async (tx) => {
      const existing = await tx.evidenceLink.findFirst({ where: { evidenceId: id, ...target } });
      if (!existing) await tx.evidenceLink.create({ data: { evidenceId: id, ...target } });
      const next = await syncClaimStatus(tx, kind, target.entityId);
      if (!existing) {
        await audit(tx, {
          actorType: "user",
          actorId: userId,
          action: "evidence.linked",
          entityType: target.entityType,
          entityId: target.entityId,
          before: { status: entity.status },
          after: { evidenceId: id, status: next },
          ip: request.ip,
        });
      }
      return next;
    });
    return reply.code(201).send({ evidenceId: id, ...target, status });
  });

  app.delete("/me/evidence/:id/links", { preHandler: requireUser }, async (request) => {
    const userId = request.auth!.userId;
    const { id } = IdParam.parse(request.params);
    const target = LinkTarget.parse(request.query);
    await own(id, userId);
    const kind = CLAIM_KINDS[target.entityType];

    const status = await prisma.$transaction(async (tx) => {
      const removed = await tx.evidenceLink.deleteMany({ where: { evidenceId: id, ...target } });
      if (removed.count === 0) throw problem(404, "not-found", "Link not found");
      const next = await syncClaimStatus(tx, kind, target.entityId);
      await audit(tx, {
        actorType: "user",
        actorId: userId,
        action: "evidence.unlinked",
        entityType: target.entityType,
        entityId: target.entityId,
        after: { evidenceId: id, status: next },
        ip: request.ip,
      });
      return next;
    });
    return { evidenceId: id, ...target, status };
  });
}
