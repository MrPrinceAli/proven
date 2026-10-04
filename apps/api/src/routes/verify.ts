import { EntityType, type Prisma } from "@proven/db";
import type { FastifyInstance } from "fastify";
import type { Hex } from "viem";
import { z } from "zod";
import { audit } from "../audit";
import { requireUser } from "../auth/guards";
import { CLAIM_KIND_LIST, CLAIM_KINDS } from "../claims";
import { credentialUrn } from "../credentials/service";
import { cachedVerify, storeVerify } from "../credentials/verify-cache";
import { problem } from "../problem";
import { truncateDid } from "./public";

const CredentialParam = z.object({
  credentialId: z
    .string()
    .transform((v) => decodeURIComponent(v).replace(/^urn:uuid:/i, ""))
    .pipe(z.string().uuid()),
});

export interface VerifyResult {
  credentialId: string;
  issuer: string;
  issuerDid: string;
  subject: string;
  anchor: { txHash: string; block: number | null; contract: string; chainId: number } | null;
  status: "active" | "revoked" | "expired";
  revoked: boolean;
  expired: boolean;
  /** False when the chain could not be read and the DB value was used. */
  chainChecked: boolean;
  /** Issued to a demo-mode sandbox: example content, not a real achievement (D-035). */
  sandbox: boolean;
  checkedAt: string;
  vc: unknown;
}

const include = {
  issuer: true,
  statusEntry: true,
  chainAnchors: true,
  subject: { select: { authProvider: true } },
} satisfies Prisma.CredentialInclude;

export async function verifyRoutes(app: FastifyInstance) {
  const { prisma } = app;

  /** On-chain isRevoked is the source of truth; the DB is synced to it when they differ (§W7 1). */
  async function verify(id: string): Promise<VerifyResult> {
    const hit = cachedVerify<VerifyResult>(id);
    if (hit) return hit;

    let credential = await prisma.credential.findUnique({ where: { id }, include });
    if (!credential) throw problem(404, "not-found", "Credential not found");

    const hash = `0x${Buffer.from(credential.vcHash).toString("hex")}` as Hex;
    let revoked = credential.statusEntry?.revoked ?? credential.status === "revoked";
    let chainChecked = false;
    if (app.chain) {
      try {
        const onChain = await app.chain.isRevoked(hash);
        chainChecked = true;
        if (onChain !== revoked) {
          await syncRevocation(id, onChain);
          credential = (await prisma.credential.findUnique({ where: { id }, include }))!;
          revoked = onChain;
        }
      } catch {
        // RPC down: fall back to the DB and say so.
      }
    }

    const expired = Boolean(credential.expiresAt && credential.expiresAt.getTime() <= Date.now());
    const status = revoked ? "revoked" : expired ? "expired" : "active";
    if (status === "expired" && credential.status === "active") {
      await prisma.credential.update({ where: { id }, data: { status: "expired" } });
    }

    const vc = credential.vcJson as { credentialSubject?: { id?: string } };
    const anchor = credential.chainAnchors[0];
    const value: VerifyResult = {
      credentialId: credentialUrn(id),
      issuer: credential.issuer.name,
      issuerDid: credential.issuer.did,
      subject: vc.credentialSubject?.id ?? "",
      anchor: anchor
        ? {
            txHash: anchor.txHash,
            block: anchor.blockNumber === null ? null : Number(anchor.blockNumber),
            contract: anchor.contractAddress,
            chainId: anchor.chainId,
          }
        : null,
      status,
      revoked,
      expired,
      chainChecked,
      sandbox: credential.subject.authProvider === "demo",
      checkedAt: new Date().toISOString(),
      vc: credential.vcJson,
    };
    storeVerify(id, value);
    return value;
  }

  async function syncRevocation(id: string, revoked: boolean) {
    await prisma.$transaction(async (tx) => {
      await tx.credential.update({ where: { id }, data: { status: revoked ? "revoked" : "active" } });
      await tx.credentialStatus.update({
        where: { credentialId: id },
        data: revoked
          ? { revoked: true, revokedAt: new Date(), reason: "Disinkronkan dari status on-chain" }
          : { revoked: false, revokedAt: null, reason: null },
      });
      const request = await tx.verificationRequest.findFirst({ where: { draftCredentialId: id } });
      if (request) {
        const kind = CLAIM_KINDS[EntityType.parse(request.entityType)];
        // updateMany: never let a deleted claim block syncing the on-chain status.
        await kind.delegate(tx).updateMany({
          where: { id: request.entityId },
          data: { status: revoked ? "REVOKED" : "VERIFIED" },
        });
      }
      await audit(tx, {
        actorType: "system",
        action: "credential.synced",
        entityType: "credential",
        entityId: id,
        after: { revoked, source: "chain" },
      });
    });
  }

  app.get("/verify/:credentialId", async (request, reply) => {
    const { credentialId } = CredentialParam.parse(request.params);
    const result = await verify(credentialId);
    reply.header("cache-control", "public, max-age=30");
    return result;
  });

  app.get("/credentials/:credentialId/status", async (request, reply) => {
    const { credentialId } = CredentialParam.parse(request.params);
    const { status, revoked, checkedAt, chainChecked } = await verify(credentialId);
    reply.header("cache-control", "public, max-age=30");
    return { status, revoked, checkedAt, chainChecked };
  });

  /** UU PDP / GDPR access & portability (§S11.3): everything Proven stores about the user. */
  app.get("/me/data-export", { preHandler: requireUser }, async (request, reply) => {
    const userId = request.auth!.userId;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { wallets: true, profile: true, consents: true },
    });
    const claims: Record<string, unknown[]> = {};
    for (const kind of CLAIM_KIND_LIST) {
      claims[kind.path] = (
        await kind.delegate(prisma).findMany({ where: { userId }, orderBy: { createdAt: "asc" } })
      ).map((row) => ({ id: row.id, ...kind.fields(row), status: row.status, createdAt: row.createdAt }));
    }
    const evidence = await prisma.evidence.findMany({ where: { userId }, include: { links: true } });
    const requests = await prisma.verificationRequest.findMany({ where: { requestedBy: userId } });
    const credentials = await prisma.credential.findMany({
      where: { subjectUserId: userId },
      include: { issuer: true, statusEntry: true, chainAnchors: true },
    });
    const activity = await prisma.auditLog.findMany({
      where: { actorId: userId },
      orderBy: { id: "asc" },
      select: { action: true, entityType: true, entityId: true, createdAt: true },
    });

    await audit(prisma, { actorType: "user", actorId: userId, action: "user.data_exported", ip: request.ip });
    reply
      .header("content-disposition", `attachment; filename="proven-export-${userId.slice(0, 8)}.json"`)
      .header("cache-control", "private, no-store");
    return {
      exportedAt: new Date().toISOString(),
      user: { id: user.id, email: user.email, status: user.status, createdAt: user.createdAt },
      wallets: user.wallets.map((w) => ({
        address: w.address,
        chainId: w.chainId,
        did: w.did,
        verifiedAt: w.verifiedAt,
      })),
      profile: user.profile,
      claims,
      // Metadata and hashes only; files are downloadable one by one from /me/evidence/:id/download.
      evidence: evidence.map((e) => {
        const m = e.metadata as {
          title?: string;
          description?: string;
          filename?: string;
          custody?: unknown;
        };
        return {
          id: e.id,
          type: e.type,
          title: m.title ?? null,
          description: m.description ?? null,
          filename: m.filename ?? null,
          mimeType: e.mimeType,
          sizeBytes: e.sizeBytes === null ? null : Number(e.sizeBytes),
          sha256: Buffer.from(e.sha256).toString("hex"),
          capturedAt: e.capturedAt,
          custody: m.custody ?? [],
          links: e.links.map((l) => ({ entityType: l.entityType, entityId: l.entityId })),
        };
      }),
      verificationRequests: requests.map((r) => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        state: r.state,
        reason: r.decisionReason,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
      })),
      credentials: credentials.map((c) => ({
        credentialId: credentialUrn(c.id),
        status: c.status,
        issuer: { name: c.issuer.name, did: c.issuer.did },
        vcHash: `0x${Buffer.from(c.vcHash).toString("hex")}`,
        anchor: c.chainAnchors[0]
          ? {
              txHash: c.chainAnchors[0].txHash,
              chainId: c.chainAnchors[0].chainId,
              contract: c.chainAnchors[0].contractAddress,
            }
          : null,
        revoked: c.statusEntry?.revoked ?? false,
        vc: c.vcJson,
      })),
      consents: user.consents,
      activity,
    };
  });
}

/** Public credential summaries for /p/:slug. */
export async function publicCredentials(app: FastifyInstance, userId: string) {
  const rows = await app.prisma.credential.findMany({
    where: { subjectUserId: userId },
    include: { issuer: true, subject: { select: { authProvider: true } } },
    orderBy: { issuedAt: "desc" },
  });
  return rows.map((c) => {
    const vc = c.vcJson as { credentialSubject?: { achievement?: { name?: string } } };
    return {
      credentialId: credentialUrn(c.id),
      name: vc.credentialSubject?.achievement?.name ?? "Kredensial",
      issuer: c.issuer.name,
      issuerDid: truncateDid(c.issuer.did),
      status: c.status,
      issuedAt: c.issuedAt.toISOString(),
      expiresAt: c.expiresAt?.toISOString() ?? null,
      sandbox: c.subject.authProvider === "demo",
    };
  });
}
