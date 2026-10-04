import type { FastifyInstance } from "fastify";
import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { audit } from "../audit";
import { requireAdmin } from "../auth/guards";
import { problem } from "../problem";
import { seedDemo } from "../seed/demo";

const SeedBody = z
  .object({
    demoUserAddress: z.string().refine((a) => isAddress(a, { strict: false }), "must be an address"),
  })
  .strict();

/**
 * Admin-only operations that must run inside the deployment (they need its Sensitive env:
 * DATABASE_URL and EVIDENCE_ENC_KEY), so no secret has to be copied anywhere else (D-031).
 */
export async function adminRoutes(app: FastifyInstance) {
  app.post("/admin/seed-demo", { preHandler: requireAdmin }, async (request) => {
    const { config } = app;
    if (!config.issuer) throw problem(409, "conflict", "ISSUER_ADDRESS and ISSUER_NAME must be configured");
    const { demoUserAddress } = SeedBody.parse(request.body);
    const result = await seedDemo({
      prisma: app.prisma,
      chainId: config.chainId,
      evidenceKey: config.evidenceKey,
      issuer: config.issuer,
      demoAddress: getAddress(demoUserAddress),
    });
    await audit(app.prisma, {
      actorType: "admin",
      actorId: request.auth!.userId,
      action: "admin.seed_demo",
      entityType: "user",
      entityId: result.userId,
      ip: request.ip,
    });
    return result;
  });
}
