import type { FastifyInstance } from "fastify";
import { claimStatuses, Prisma, Visibility } from "@proven/db";
import { z } from "zod";
import { audit } from "../audit";
import { requireUser } from "../auth/guards";
import { CLAIM_KIND_LIST, linkedEvidence, serializeClaim, type ClaimKind } from "../claims";
import { problem } from "../problem";

/** Slugs that would collide with app routes (§W3). */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "verify",
  "p",
  "issuer",
  "dashboard",
  "login",
  "settings",
]);

const Slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "3–40 karakter a-z, 0-9, '-' dan tidak diawali/diakhiri '-'")
  .refine((s) => !RESERVED_SLUGS.has(s), "slug ini dicadangkan");

const ProfilePatch = z
  .object({
    headline: z.string().trim().max(160),
    summary: z.string().trim().max(2600),
    visibility: Visibility,
    slug: Slug.nullable(),
  })
  .partial()
  .strict();

const IdParam = z.object({ id: z.string().uuid() });

/** Claims in these states are locked: editing would change what an issuer reviewed or verified (D-020). */
const EDITABLE = new Set(["UNVERIFIED", "EVIDENCE_ATTACHED"]);

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function claimRoutes(app: FastifyInstance) {
  const { prisma } = app;

  app.patch("/me/profile", { preHandler: requireUser }, async (request) => {
    const userId = request.auth!.userId;
    const patch = ProfilePatch.parse(request.body);

    if (patch.slug) {
      const taken = await prisma.profile.findFirst({ where: { slug: patch.slug, NOT: { userId } } });
      if (taken) throw problem(409, "conflict", "Slug sudah dipakai");
    }

    const before = await prisma.profile.findUniqueOrThrow({ where: { userId } });
    let profile;
    try {
      profile = await prisma.profile.update({ where: { userId }, data: patch });
    } catch (e) {
      if (isUniqueViolation(e)) throw problem(409, "conflict", "Slug sudah dipakai");
      throw e;
    }
    await audit(prisma, {
      actorType: "user",
      actorId: userId,
      action: "profile.updated",
      entityType: "profile",
      entityId: profile.id,
      before: { headline: before.headline, visibility: before.visibility, slug: before.slug },
      after: { headline: profile.headline, visibility: profile.visibility, slug: profile.slug },
      ip: request.ip,
    });
    return {
      headline: profile.headline,
      summary: profile.summary,
      visibility: profile.visibility,
      slug: profile.slug,
      updatedAt: profile.updatedAt.toISOString(),
    };
  });

  /** Every claim of the user grouped by kind, plus counts per status for the dashboard. */
  app.get("/me/claims", { preHandler: requireUser }, async (request) => {
    const userId = request.auth!.userId;
    const groups: Record<string, ReturnType<typeof serializeClaim>[]> = {};
    const summary: Record<string, number> = Object.fromEntries(claimStatuses.map((s) => [s, 0]));

    for (const kind of CLAIM_KIND_LIST) {
      const rows = await kind.delegate(prisma).findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
      const links = await linkedEvidence(
        prisma,
        kind.type,
        rows.map((r) => r.id),
      );
      groups[kind.path] = rows.map((r) => serializeClaim(kind, r, links.get(r.id) ?? []));
      for (const r of rows) summary[r.status] = (summary[r.status] ?? 0) + 1;
    }
    return { claims: groups, summary };
  });

  for (const kind of CLAIM_KIND_LIST) registerCrud(app, kind);
}

function registerCrud(app: FastifyInstance, kind: ClaimKind) {
  const { prisma } = app;
  const base = `/me/${kind.path}`;

  const own = async (id: string, userId: string) => {
    const row = await kind.delegate(prisma).findFirst({ where: { id, userId } });
    // Another user's record is indistinguishable from a missing one.
    if (!row) throw problem(404, "not-found", `${kind.type} not found`);
    return row;
  };

  app.get(base, { preHandler: requireUser }, async (request) => {
    const rows = await kind
      .delegate(prisma)
      .findMany({ where: { userId: request.auth!.userId }, orderBy: { createdAt: "asc" } });
    const links = await linkedEvidence(
      prisma,
      kind.type,
      rows.map((r) => r.id),
    );
    return rows.map((r) => serializeClaim(kind, r, links.get(r.id) ?? []));
  });

  app.post(base, { preHandler: requireUser }, async (request, reply) => {
    const userId = request.auth!.userId;
    const data = kind.create.parse(request.body);
    const row = await kind.delegate(prisma).create({ data: { ...data, userId } });
    await audit(prisma, {
      actorType: "user",
      actorId: userId,
      action: `${kind.type}.created`,
      entityType: kind.type,
      entityId: row.id,
      after: { label: kind.label(row) },
      ip: request.ip,
    });
    return reply.code(201).send(serializeClaim(kind, row, []));
  });

  app.patch(`${base}/:id`, { preHandler: requireUser }, async (request) => {
    const userId = request.auth!.userId;
    const { id } = IdParam.parse(request.params);
    const data = kind.update.parse(request.body);
    const before = await own(id, userId);
    if (!EDITABLE.has(before.status)) {
      throw problem(409, "conflict", `Klaim berstatus ${before.status} tidak bisa diubah`);
    }
    const row = await kind.delegate(prisma).update({ where: { id }, data });
    const links = await linkedEvidence(prisma, kind.type, [id]);
    await audit(prisma, {
      actorType: "user",
      actorId: userId,
      action: `${kind.type}.updated`,
      entityType: kind.type,
      entityId: id,
      before: { label: kind.label(before) },
      after: { label: kind.label(row) },
      ip: request.ip,
    });
    return serializeClaim(kind, row, links.get(id) ?? []);
  });

  app.delete(`${base}/:id`, { preHandler: requireUser }, async (request, reply) => {
    const userId = request.auth!.userId;
    const { id } = IdParam.parse(request.params);
    const row = await own(id, userId);
    if (row.status === "PENDING_ISSUER") {
      throw problem(409, "conflict", "Klaim sedang menunggu issuer dan tidak bisa dihapus");
    }
    await prisma.$transaction(async (tx) => {
      await tx.evidenceLink.deleteMany({ where: { entityType: kind.type, entityId: id } });
      await kind.delegate(tx).delete({ where: { id } });
      await audit(tx, {
        actorType: "user",
        actorId: userId,
        action: `${kind.type}.deleted`,
        entityType: kind.type,
        entityId: id,
        before: { label: kind.label(row), status: row.status },
        ip: request.ip,
      });
    });
    return reply.code(204).send();
  });
}
