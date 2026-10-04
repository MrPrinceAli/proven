import { EntityType, type Issuer, type Prisma, type VerificationRequest } from "@proven/db";
import {
  buildAchievementVC,
  credentialHash,
  signCredential,
  subjectRef,
  VerifiableCredentialSchema,
  type UnsignedCredential,
} from "@proven/vc";
import type { FastifyInstance } from "fastify";
import { hexToBytes, isAddressEqual, type Hex } from "viem";
import { audit } from "../audit";
import type { ChainAdapter } from "../chain/adapter";
import { CLAIM_KINDS, linkedEvidence, statusAfterLinkChange } from "../claims";
import { problem } from "../problem";
import { invalidateVerifyCache } from "./verify-cache";

/** Credentials are valid for five years (§W5 6c). */
const VALIDITY_MS = 5 * 365 * 24 * 60 * 60 * 1000;

export const credentialUrn = (id: string) => `urn:uuid:${id}`;

function requireChain(app: FastifyInstance, issuer: Issuer): ChainAdapter {
  const chain = app.chain;
  if (!chain || !chain.issuerAccount) {
    throw problem(502, "chain-unavailable", "Kontrak atau kunci issuer belum dikonfigurasi di server");
  }
  // The backend only holds the relay issuer's key (§S1.3); it cannot sign for anyone else.
  if (!isAddressEqual(chain.issuerAccount.address, issuer.address as Hex)) {
    throw problem(403, "forbidden", "Server tidak memegang kunci untuk issuer ini");
  }
  return chain;
}

/** Locks the request row; throws 404/409 unless it belongs to the issuer and is still pending. */
async function lockPending(tx: Prisma.TransactionClient, requestId: string, issuerId: string) {
  await tx.$queryRaw`SELECT id FROM verification_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
  const request = await tx.verificationRequest.findUnique({ where: { id: requestId } });
  if (!request || request.issuerId !== issuerId)
    throw problem(404, "not-found", "Verification request not found");
  if (request.state !== "pending") throw problem(409, "conflict", `Request is already ${request.state}`);
  return request;
}

async function nextStatusIndex(tx: Prisma.TransactionClient, issuerId: string): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`status-index:${issuerId}`}))`;
  const [{ max }] = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT GREATEST(
      (SELECT MAX(cs.status_list_index) FROM credential_status cs
         JOIN credentials c ON c.id = cs.credential_id WHERE c.issuer_id = ${issuerId}::uuid),
      (SELECT MAX(draft_status_index) FROM verification_requests WHERE issuer_id = ${issuerId}::uuid)
    ) AS max`;
  return max === null ? 0 : Number(max) + 1;
}

/** Builds the unsigned VC from the claim the user asked to verify. */
async function buildDraft(
  app: FastifyInstance,
  tx: Prisma.TransactionClient,
  request: VerificationRequest,
  issuer: Issuer,
): Promise<{ vc: UnsignedCredential; credentialId: string; statusIndex: number }> {
  const kind = CLAIM_KINDS[EntityType.parse(request.entityType)];
  const entity = await kind
    .delegate(tx)
    .findFirst({ where: { id: request.entityId, userId: request.requestedBy } });
  if (!entity) throw problem(409, "conflict", "The claim no longer exists");
  const wallet = await tx.wallet.findFirst({
    where: { userId: request.requestedBy, chainId: app.config.chainId },
    orderBy: { verifiedAt: "asc" },
  });
  if (!wallet) throw problem(409, "conflict", "The user has no wallet on this chain");
  if (isAddressEqual(wallet.address as Hex, issuer.address as Hex)) {
    throw problem(403, "forbidden", "Issuer tidak bisa memverifikasi klaimnya sendiri");
  }
  const present = await tx.evidence.count({
    where: { id: { in: request.evidenceIds }, userId: request.requestedBy },
  });
  if (present !== request.evidenceIds.length) {
    throw problem(409, "conflict", "Sebagian bukti yang diajukan sudah tidak ada");
  }
  // Demo-mode sandboxes get credentials that say so in the VC itself (D-035).
  const requester = await tx.user.findUnique({
    where: { id: request.requestedBy },
    select: { authProvider: true },
  });
  const sandbox = requester?.authProvider === "demo";

  const fields = kind.fields(entity);
  const description = [fields.description, fields.event, fields.org, fields.role, fields.level, fields.year]
    .filter((v) => v !== null && v !== undefined && v !== "")
    .join(" · ");
  const credentialId = crypto.randomUUID();
  const statusIndex = await nextStatusIndex(tx, issuer.id);
  const now = new Date();
  const listUrl = `${app.config.appUrl}/status/${issuer.id}`;
  const vc = buildAchievementVC({
    credentialId,
    issuer: { did: issuer.did, name: issuer.name },
    subjectDid: wallet.did,
    achievement: {
      id: `urn:uuid:${entity.id}`,
      name: sandbox ? `[DEMO] ${kind.label(entity)}` : kind.label(entity),
      description,
      criteria: sandbox
        ? `Kredensial contoh dari mode demo Proven-ID — bukan prestasi yang diverifikasi sungguhan.`
        : `Diverifikasi oleh ${issuer.name} berdasarkan ${request.evidenceIds.length} bukti yang diajukan.`,
    },
    validFrom: now,
    validUntil: new Date(now.getTime() + VALIDITY_MS),
    status: { index: statusIndex, listUrl },
  });
  return { vc, credentialId, statusIndex };
}

export interface ApproveResult {
  credentialId: string;
  vcHash: Hex;
  txHash: Hex | null;
  blockNumber: number | null;
  status: "active";
}

/**
 * §W5 6: lock → draft VC (built once, D-010) → anchor on-chain → EIP-712 proof → one DB transaction.
 * If anchoring fails the request stays pending with its draft, so a retry anchors the same hash.
 */
export async function approveRequest(
  app: FastifyInstance,
  issuer: Issuer,
  requestId: string,
  ip: string,
): Promise<ApproveResult> {
  const { prisma } = app;
  // Ownership first (404), so other issuers cannot probe which requests exist.
  const owned = await prisma.verificationRequest.findFirst({ where: { id: requestId, issuerId: issuer.id } });
  if (!owned) throw problem(404, "not-found", "Verification request not found");
  const chain = requireChain(app, issuer);

  const draft = await prisma.$transaction(async (tx) => {
    const request = await lockPending(tx, requestId, issuer.id);
    if (request.draftVc && request.draftCredentialId) {
      return {
        vc: VerifiableCredentialSchema.parse(request.draftVc),
        credentialId: request.draftCredentialId,
      };
    }
    const built = await buildDraft(app, tx, request, issuer);
    await tx.verificationRequest.update({
      where: { id: requestId },
      data: {
        draftVc: built.vc as unknown as Prisma.InputJsonValue,
        draftCredentialId: built.credentialId,
        draftStatusIndex: built.statusIndex,
      },
    });
    return built;
  });

  const hash = credentialHash(draft.vc);
  const ref = subjectRef(draft.vc.credentialSubject.id);
  const anchored = await chain.anchorCredential(hash, ref);
  const signed = await signCredential(chain.issuerAccount!, draft.vc, {
    chainId: chain.chainId,
    verifyingContract: chain.registryAddress,
  });

  await prisma.$transaction(async (tx) => {
    const request = await lockPending(tx, requestId, issuer.id);
    const kind = CLAIM_KINDS[EntityType.parse(request.entityType)];
    await tx.credential.create({
      data: {
        id: draft.credentialId,
        issuerId: issuer.id,
        subjectUserId: request.requestedBy,
        type: signed.type,
        vcJson: signed as unknown as Prisma.InputJsonValue,
        vcHash: Buffer.from(hexToBytes(hash)),
        status: "active",
        issuedAt: new Date(signed.validFrom),
        expiresAt: signed.validUntil ? new Date(signed.validUntil) : null,
        statusEntry: { create: { statusListIndex: request.draftStatusIndex ?? 0 } },
        chainAnchors: {
          create: {
            txHash: anchored.txHash ?? "unknown",
            chainId: chain.chainId,
            blockNumber: anchored.blockNumber,
            contractAddress: chain.registryAddress,
            anchorHash: Buffer.from(hexToBytes(hash)),
          },
        },
      },
    });
    await tx.verificationRequest.update({
      where: { id: requestId },
      data: { state: "approved", decidedAt: new Date() },
    });
    await kind.delegate(tx).update({ where: { id: request.entityId }, data: { status: "VERIFIED" } });
    await audit(tx, {
      actorType: "issuer",
      actorId: issuer.id,
      action: "credential.issued",
      entityType: "credential",
      entityId: draft.credentialId,
      after: {
        requestId,
        vcHash: hash,
        txHash: anchored.txHash,
        chainId: chain.chainId,
        claim: { entityType: request.entityType, entityId: request.entityId },
      },
      ip,
    });
  });

  return {
    credentialId: credentialUrn(draft.credentialId),
    vcHash: hash,
    txHash: anchored.txHash,
    blockNumber: anchored.blockNumber === null ? null : Number(anchored.blockNumber),
    status: "active",
  };
}

export async function rejectRequest(
  app: FastifyInstance,
  issuer: Issuer,
  requestId: string,
  reason: string,
  ip: string,
) {
  await app.prisma.$transaction(async (tx) => {
    const request = await lockPending(tx, requestId, issuer.id);
    const kind = CLAIM_KINDS[EntityType.parse(request.entityType)];
    const links = await linkedEvidence(tx, kind.type, [request.entityId]);
    // Back to EVIDENCE_ATTACHED (or UNVERIFIED if every link was removed meanwhile).
    const status = statusAfterLinkChange("UNVERIFIED", links.get(request.entityId)?.length ?? 0);
    await tx.verificationRequest.update({
      where: { id: requestId },
      data: { state: "rejected", decidedAt: new Date(), decisionReason: reason },
    });
    await kind.delegate(tx).update({ where: { id: request.entityId }, data: { status } });
    await audit(tx, {
      actorType: "issuer",
      actorId: issuer.id,
      action: "verification.rejected",
      entityType: request.entityType,
      entityId: request.entityId,
      after: { requestId, reason, status },
      ip,
    });
  });
}

/** §W5 8: only the issuing issuer; on-chain first, then the DB mirrors it. */
export async function revokeCredential(
  app: FastifyInstance,
  issuer: Issuer,
  credentialId: string,
  reason: string,
  ip: string,
) {
  const { prisma } = app;
  const credential = await prisma.credential.findUnique({ where: { id: credentialId } });
  if (!credential || credential.issuerId !== issuer.id)
    throw problem(404, "not-found", "Credential not found");
  if (credential.status === "revoked") throw problem(409, "conflict", "Credential is already revoked");

  const chain = requireChain(app, issuer);
  const hash = `0x${Buffer.from(credential.vcHash).toString("hex")}` as Hex;
  const tx = await chain.revokeCredential(hash);

  await prisma.$transaction(async (db) => {
    await db.credential.update({ where: { id: credentialId }, data: { status: "revoked" } });
    await db.credentialStatus.update({
      where: { credentialId },
      data: { revoked: true, revokedAt: new Date(), reason },
    });
    const request = await db.verificationRequest.findFirst({ where: { draftCredentialId: credentialId } });
    if (request) {
      const kind = CLAIM_KINDS[EntityType.parse(request.entityType)];
      // updateMany: the claim may have been deleted after an earlier revocation.
      await kind.delegate(db).updateMany({ where: { id: request.entityId }, data: { status: "REVOKED" } });
    }
    await audit(db, {
      actorType: "issuer",
      actorId: issuer.id,
      action: "credential.revoked",
      entityType: "credential",
      entityId: credentialId,
      before: { status: credential.status },
      after: { status: "revoked", reason, txHash: tx.txHash },
      ip,
    });
  });
  invalidateVerifyCache(credentialId);
  return { credentialId: credentialUrn(credentialId), status: "revoked" as const, txHash: tx.txHash };
}
