import type { FastifyInstance } from "fastify";
import { isAdmin, isIssuer, requireUser } from "../auth/guards";
import { profileIdentity } from "../identity";
import { problem } from "../problem";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: requireUser }, async (request) => {
    const { userId, address } = request.auth!;
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      include: { wallets: true, profile: true },
    });
    if (!user) throw problem(401, "unauthorized", "Session user no longer exists");

    const wallet = user.wallets.find((w) => w.address === address) ?? user.wallets[0];
    const roles = ["user"];
    if (await isIssuer(request, address)) roles.push("issuer");
    if (isAdmin(request, address)) roles.push("admin");

    return {
      user: { id: user.id, status: user.status, createdAt: user.createdAt.toISOString() },
      wallet: wallet ? { address: wallet.address, chainId: wallet.chainId, did: wallet.did } : null,
      profile: user.profile
        ? {
            ...profileIdentity(user.profile),
            headline: user.profile.headline,
            summary: user.profile.summary,
            visibility: user.profile.visibility,
            slug: user.profile.slug,
            updatedAt: user.profile.updatedAt.toISOString(),
          }
        : null,
      roles,
      // Demo-mode session (D-032): the UI shows a banner and role switcher.
      demo: request.auth!.via === "demo",
      sandbox: user.authProvider === "demo",
    };
  });
}
