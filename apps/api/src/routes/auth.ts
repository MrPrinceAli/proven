import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { createPublicClient, getAddress, http, isAddress, verifyMessage, type Hex } from "viem";
import { parseSiweMessage, type SiweMessage } from "viem/siwe";
import { z } from "zod";
import { audit } from "../audit";
import { requireUser } from "../auth/guards";
import { clearSessionCookie, createSession, setSessionCookie } from "../auth/session";
import { problem } from "../problem";

const NONCE_TTL_MS = 5 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const isEip55 = (value: string) => isAddress(value, { strict: false }) && getAddress(value) === value;

const NonceBody = z.object({
  address: z.string().refine(isEip55, "address must be EIP-55 checksummed"),
  chainId: z.number().int().positive(),
});

const VerifyBody = z.object({
  message: z.string().min(1).max(4000),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, "signature must be hex"),
});

export const didFor = (chainId: number, address: string) => `did:ethr:${chainId}:${address.toLowerCase()}`;

const authRateLimit = { rateLimit: { max: 20, timeWindow: "1 minute" } };

export async function authRoutes(app: FastifyInstance) {
  const { config, prisma } = app;
  const publicClient = createPublicClient({ transport: http(config.rpcUrl) });

  /** EOA signatures are checked locally; smart-contract wallets fall back to ERC-1271/6492 via RPC. */
  async function signatureValid(message: string, address: Hex, signature: Hex): Promise<boolean> {
    try {
      if (await verifyMessage({ address, message, signature })) return true;
    } catch {
      // Not a 65-byte ECDSA signature; try the contract-wallet path.
    }
    try {
      return await publicClient.verifyMessage({ address, message, signature });
    } catch {
      return false;
    }
  }

  app.post("/auth/siwe/nonce", { config: authRateLimit }, async (request) => {
    const body = NonceBody.parse(request.body);
    if (body.chainId !== config.chainId) {
      throw problem(400, "validation-error", `chainId must be ${config.chainId}`);
    }
    const nonce = randomBytes(16).toString("hex");
    await prisma.siweNonce.create({
      data: {
        nonce,
        address: body.address,
        chainId: body.chainId,
        expiresAt: new Date(Date.now() + NONCE_TTL_MS),
      },
    });
    return { nonce };
  });

  app.post("/auth/siwe/verify", { config: authRateLimit }, async (request, reply) => {
    const body = VerifyBody.parse(request.body);

    let fields: Partial<SiweMessage>;
    try {
      fields = parseSiweMessage(body.message);
    } catch {
      throw problem(401, "unauthorized", "Malformed SIWE message");
    }
    const { address, domain, uri, chainId, nonce, version, issuedAt, expirationTime, notBefore } = fields;
    if (!address || !domain || !uri || !chainId || !nonce || version !== "1") {
      throw problem(401, "unauthorized", "Incomplete SIWE message");
    }

    if (!config.allowedDomains.includes(domain.toLowerCase())) {
      throw problem(401, "unauthorized", "SIWE domain mismatch");
    }
    let origin: string;
    try {
      origin = new URL(uri).origin;
    } catch {
      throw problem(401, "unauthorized", "SIWE uri is not a URL");
    }
    if (!config.allowedOrigins.includes(origin)) {
      throw problem(401, "unauthorized", "SIWE uri origin mismatch");
    }
    if (chainId !== config.chainId) {
      throw problem(401, "unauthorized", "SIWE chainId mismatch");
    }
    const now = Date.now();
    if (issuedAt && issuedAt.getTime() > now + CLOCK_SKEW_MS) {
      throw problem(401, "unauthorized", "SIWE message issued in the future");
    }
    if (expirationTime && expirationTime.getTime() <= now) {
      throw problem(401, "unauthorized", "SIWE message expired");
    }
    if (notBefore && notBefore.getTime() > now) {
      throw problem(401, "unauthorized", "SIWE message not yet valid");
    }

    const stored = await prisma.siweNonce.findUnique({ where: { nonce } });
    if (!stored || stored.usedAt || stored.expiresAt.getTime() <= now) {
      throw problem(401, "unauthorized", "Invalid or expired nonce");
    }
    if (stored.address !== address || stored.chainId !== chainId) {
      throw problem(401, "unauthorized", "Nonce was issued for a different address or chain");
    }

    if (!(await signatureValid(body.message, address, body.signature as Hex))) {
      throw problem(401, "unauthorized", "Invalid signature");
    }

    const did = didFor(chainId, address);
    const { session, userId } = await prisma.$transaction(async (tx) => {
      // Atomic single use: only one request can flip used_at from NULL.
      const consumed = await tx.siweNonce.updateMany({
        where: { nonce, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw problem(401, "unauthorized", "Invalid or expired nonce");

      let wallet = await tx.wallet.findUnique({ where: { did } });
      if (!wallet) {
        const user = await tx.user.create({ data: { profile: { create: {} } } });
        wallet = await tx.wallet.create({
          data: { userId: user.id, address, chainId, did, verifiedAt: new Date() },
        });
        await audit(tx, {
          actorType: "user",
          actorId: user.id,
          action: "user.created",
          entityType: "user",
          entityId: user.id,
          after: { did },
          ip: request.ip,
        });
      } else {
        await tx.wallet.update({ where: { id: wallet.id }, data: { verifiedAt: new Date() } });
      }

      const created = await createSession(tx, wallet.userId, address);
      await audit(tx, {
        actorType: "user",
        actorId: wallet.userId,
        action: "auth.login",
        entityType: "user",
        entityId: wallet.userId,
        after: { did },
        ip: request.ip,
      });
      return { session: created, userId: wallet.userId };
    });

    setSessionCookie(reply, config, session.token, session.expiresAt);
    return { userId, did, address };
  });

  app.post("/auth/logout", { preHandler: requireUser }, async (request, reply) => {
    const { sessionId, userId } = request.auth!;
    await prisma.session.delete({ where: { id: sessionId } });
    await audit(prisma, {
      actorType: "user",
      actorId: userId,
      action: "auth.logout",
      entityType: "user",
      entityId: userId,
      ip: request.ip,
    });
    clearSessionCookie(reply, config);
    return reply.code(204).send();
  });
}
