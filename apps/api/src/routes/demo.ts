import type { FastifyInstance, FastifyRequest } from "fastify";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { audit } from "../audit";
import { createSession, setSessionCookie } from "../auth/session";
import { problem } from "../problem";
import { seedDemo } from "../seed/demo";
import { PERSONAS, personaSlug } from "../seed/personas";
import { didFor } from "./auth";

const DemoBody = z
  .object({
    role: z.enum(["user", "issuer"]),
    /** Resume a previous demo sandbox (only users created by demo mode). */
    userId: z.string().uuid().optional(),
  })
  .strict();

/** A demo issuer session may only act on demo sandboxes, never on real wallets or the showcase (D-032). */
export async function assertDemoScope(request: FastifyRequest, subjectUserId: string) {
  if (request.auth?.via !== "demo") return;
  const subject = await request.server.prisma.user.findUnique({ where: { id: subjectUserId } });
  if (subject?.authProvider !== "demo") {
    throw problem(403, "forbidden", "Issuer demo hanya bisa memproses akun demo");
  }
}

/**
 * Demo mode (D-032): judges explore Proven without a wallet. "user" gets a fresh sandbox seeded with
 * example data under a fictional persona (or resumes theirs); "issuer" acts as the relay issuer, whose approvals are real
 * transactions on the test network, limited to demo sandboxes.
 */
export async function demoRoutes(app: FastifyInstance) {
  const { config, prisma } = app;

  app.get("/config", async () => ({
    demoMode: config.demoMode,
    chainId: config.chainId,
    issuerName: config.issuer?.name ?? null,
  }));

  app.post(
    "/auth/demo",
    { config: { rateLimit: { max: app.authRateLimit, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!config.demoMode) throw problem(404, "not-found", "Demo mode is off");
      if (!config.issuer) throw problem(409, "conflict", "Demo mode needs ISSUER_ADDRESS and ISSUER_NAME");
      const body = DemoBody.parse(request.body ?? {});

      let userId: string;
      let address: string;
      if (body.role === "issuer") {
        const did = didFor(config.chainId, config.issuer.address);
        const wallet = await prisma.wallet.findUnique({ where: { did } });
        if (wallet) {
          userId = wallet.userId;
        } else {
          const user = await prisma.user.create({
            data: { profile: { create: { headline: config.issuer.name } } },
          });
          await prisma.wallet.create({
            data: { userId: user.id, address: config.issuer.address, chainId: config.chainId, did },
          });
          userId = user.id;
        }
        address = config.issuer.address;
      } else {
        const existing = body.userId
          ? await prisma.user.findFirst({
              where: { id: body.userId, authProvider: "demo" },
              include: { wallets: true },
            })
          : null;
        if (existing?.wallets[0]) {
          userId = existing.id;
          address = existing.wallets[0].address;
        } else {
          // A throwaway address: nobody holds its key, so it can only be used through demo mode.
          address = privateKeyToAccount(generatePrivateKey()).address;
          const persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)]!;
          const seeded = await seedDemo({
            prisma,
            chainId: config.chainId,
            evidenceKey: config.evidenceKey,
            issuer: config.issuer,
            demoAddress: address,
            persona,
            slug: personaSlug(persona, address.slice(2, 6)),
            authProvider: "demo",
          });
          userId = seeded.userId;
        }
      }

      const session = await createSession(prisma, userId, address, "demo");
      await audit(prisma, {
        actorType: body.role === "issuer" ? "issuer" : "user",
        actorId: userId,
        action: "auth.demo_login",
        entityType: "user",
        entityId: userId,
        after: { role: body.role },
        ip: request.ip,
      });
      setSessionCookie(reply, config, session.token, session.expiresAt);
      return { role: body.role, userId, did: didFor(config.chainId, address) };
    },
  );
}
