import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CLAIM_KIND_LIST, linkedEvidence } from "../claims";
import { problem } from "../problem";

const SlugParam = z.object({ slug: z.string().min(1).max(64) });

/** did:ethr:97:0x1234…abcd — enough to recognise, without echoing the full address. */
export function truncateDid(did: string): string {
  const match = /^(did:ethr:\d+:)(0x[0-9a-f]{40})$/.exec(did);
  return match ? `${match[1]}${match[2]!.slice(0, 6)}…${match[2]!.slice(-4)}` : did;
}

export async function publicRoutes(app: FastifyInstance) {
  const { prisma } = app;

  /** Public profile (FR-14). Never returns email, storage keys, evidence contents or hashes. */
  app.get("/p/:slug", async (request) => {
    const { slug } = SlugParam.parse(request.params);
    const profile = await prisma.profile.findFirst({
      where: { slug: slug.toLowerCase(), visibility: "public" },
      include: { user: { include: { wallets: { orderBy: { verifiedAt: "asc" }, take: 1 } } } },
    });
    // private and recruiter-only (roadmap) are indistinguishable from a missing profile.
    if (!profile || profile.user.status !== "active") throw problem(404, "not-found", "Profile not found");

    const claims: Record<string, unknown[]> = {};
    for (const kind of CLAIM_KIND_LIST) {
      const rows = await kind
        .delegate(prisma)
        .findMany({ where: { userId: profile.userId }, orderBy: { createdAt: "asc" } });
      const links = await linkedEvidence(
        prisma,
        kind.type,
        rows.map((r) => r.id),
      );
      claims[kind.path] = rows.map((r) => ({
        id: r.id,
        entityType: kind.type,
        ...kind.fields(r),
        status: r.status,
        evidenceCount: links.get(r.id)?.length ?? 0,
      }));
    }

    const wallet = profile.user.wallets[0];
    return {
      slug: profile.slug,
      headline: profile.headline,
      summary: profile.summary,
      did: wallet ? truncateDid(wallet.did) : null,
      claims,
    };
  });
}
