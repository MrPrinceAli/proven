import type { Prisma, PrismaClient } from "@proven/db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { audit } from "../audit";
import { CLAIM_KINDS, syncClaimStatus } from "../claims";
import { encrypt, sha256 } from "../evidence/crypto";
import { postgresEvidenceStore } from "../evidence/store";
import { bootstrapIssuer, type IssuerIdentity } from "../issuers/register";
import { SHOWCASE, type Persona } from "./personas";

export interface SeedInput {
  prisma: PrismaClient;
  chainId: number;
  evidenceKey: Buffer;
  issuer: IssuerIdentity;
  /** Wallet the presenter logs in with during the demo (EIP-55). */
  demoAddress: string;
  /** Public slug; defaults to the showcase slug (skipped when taken). */
  slug?: string;
  /** Who the example profile belongs to; defaults to the showcase persona (D-034). */
  persona?: Persona;
  /** "demo" marks wallet-less sandbox users created by demo mode (D-032). */
  authProvider?: "wallet" | "demo";
}

const ACHIEVEMENT = "XYZ Hackathon 2026 — Winner";
const CERT_FILE = "sertifikat-xyz-hackathon-2026.pdf";

/** A certificate PDF generated on the fly (§W8 2), so the demo needs no binary fixture in git. */
export async function certificatePdf(issuerName: string, recipient: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle("Sertifikat XYZ Hackathon 2026");
  const page = doc.addPage([842, 595]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const green = rgb(0.016, 0.47, 0.34);
  page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: green, borderWidth: 4 });
  page.drawText("SERTIFIKAT PENGHARGAAN", { x: 220, y: 470, size: 32, font: bold, color: green });
  page.drawText("diberikan kepada pemilik profil Proven-ID", { x: 285, y: 420, size: 14, font: regular });
  page.drawText(recipient, {
    x: (842 - bold.widthOfTextAtSize(recipient, 28)) / 2,
    y: 370,
    size: 28,
    font: bold,
  });
  page.drawText("sebagai JUARA 1 (Winner) XYZ Hackathon 2026", { x: 230, y: 310, size: 18, font: regular });
  page.drawText("Peringkat pertama dari 120 tim.", { x: 320, y: 280, size: 14, font: regular });
  page.drawText(`${issuerName} · 2026`, { x: 330, y: 120, size: 14, font: regular });
  page.drawText("Dokumen contoh untuk demo Proven-ID.", {
    x: 320,
    y: 60,
    size: 10,
    font: regular,
    color: rgb(0.4, 0.4, 0.4),
  });
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

/**
 * `pnpm db:seed` (§W8 2): issuer "XYZ Community", a demo user with a full profile, a certificate,
 * one skill deliberately without evidence, and one PENDING request for a live approve. Idempotent.
 */
export async function seedDemo({
  prisma,
  chainId,
  evidenceKey,
  issuer,
  demoAddress,
  slug = SHOWCASE.slug,
  persona = SHOWCASE,
  authProvider = "wallet",
}: SeedInput) {
  const issuerRow = await bootstrapIssuer(prisma, issuer);
  const did = `did:ethr:${chainId}:${demoAddress.toLowerCase()}`;

  const userId = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { did } });
    if (wallet) return wallet.userId;
    const user = await tx.user.create({ data: { authProvider, profile: { create: {} } } });
    await tx.wallet.create({ data: { userId: user.id, address: demoAddress, chainId, did } });
    return user.id;
  });

  const slugTaken = await prisma.profile.findFirst({ where: { slug, NOT: { userId } } });
  await prisma.profile.update({
    where: { userId },
    data: {
      displayName: persona.displayName,
      avatarSeed: persona.avatarSeed,
      headline: "Smart Contract Engineer · BNB Chain",
      summary:
        "Membangun dApp dan tooling Web3 di Indonesia. Fokus pada Solidity, keamanan kontrak, dan identitas profesional yang bisa diverifikasi.",
      visibility: "public",
      ...(slugTaken ? {} : { slug }),
    },
  });

  async function ensure(
    type: keyof typeof CLAIM_KINDS,
    match: Record<string, unknown>,
    data: Record<string, unknown>,
  ) {
    const delegate = CLAIM_KINDS[type].delegate(prisma);
    const existing = (await delegate.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })).find(
      (row) => Object.entries(match).every(([k, v]) => row[k] === v),
    );
    return existing ?? delegate.create({ data: { userId, ...match, ...data } });
  }

  const solidity = await ensure("skill", { name: "Solidity" }, { level: "advanced" });
  await ensure("skill", { name: "TypeScript" }, { level: "advanced" });
  // Deliberately without evidence: the AI tailoring demo shows "Skill detected — evidence not found."
  await ensure("skill", { name: "Rust" }, { level: "intermediate" });
  await ensure(
    "experience",
    { title: "Smart Contract Engineer", org: "XYZ Labs" },
    {
      startDate: new Date("2024-02-01T00:00:00Z"),
      description: "Merancang kontrak registry dan indexer on-chain.",
    },
  );
  await ensure(
    "project",
    { name: "Proven" },
    { url: "https://proven-id.vercel.app", description: "Identitas profesional terverifikasi." },
  );
  const achievement = await ensure(
    "achievement",
    { title: ACHIEVEMENT },
    { event: "XYZ Hackathon 2026", year: 2026 },
  );
  await ensure("community_role", { community: "BNB Builders ID" }, { role: "Mentor" });

  let evidence = (await prisma.evidence.findMany({ where: { userId } })).find(
    (e) => (e.metadata as { filename?: string }).filename === CERT_FILE,
  );
  if (!evidence) {
    const pdf = await certificatePdf(issuer.name, persona.displayName);
    const digest = sha256(pdf);
    const sealed = encrypt(evidenceKey, pdf);
    evidence = await prisma.$transaction(async (tx) => {
      const storageKey = await postgresEvidenceStore.put(tx, sealed.ciphertext);
      const now = new Date();
      const row = await tx.evidence.create({
        data: {
          userId,
          type: "hackathon",
          storageKey,
          sha256: digest,
          mimeType: "application/pdf",
          sizeBytes: pdf.length,
          capturedAt: now,
          metadata: {
            title: "Sertifikat Juara XYZ Hackathon 2026",
            filename: CERT_FILE,
            iv: sealed.iv,
            tag: sealed.tag,
            custody: [
              { event: "uploaded", at: now.toISOString(), by: userId, sha256: digest.toString("hex") },
            ],
          } as Prisma.InputJsonValue,
        },
      });
      await audit(tx, {
        actorType: "system",
        action: "evidence.uploaded",
        entityType: "evidence",
        entityId: row.id,
        after: { sha256: digest.toString("hex"), size: pdf.length, mime: "application/pdf", source: "seed" },
      });
      return row;
    });
  }

  for (const [type, entityId] of [
    ["achievement", achievement.id],
    ["skill", solidity.id],
  ] as const) {
    const exists = await prisma.evidenceLink.findFirst({
      where: { evidenceId: evidence.id, entityType: type, entityId },
    });
    if (!exists)
      await prisma.evidenceLink.create({ data: { evidenceId: evidence.id, entityType: type, entityId } });
    await syncClaimStatus(prisma, CLAIM_KINDS[type], entityId);
  }

  // One request left pending so the presenter can approve it live.
  const open = await prisma.verificationRequest.findFirst({
    where: { entityType: "achievement", entityId: achievement.id, state: { in: ["pending", "approved"] } },
  });
  if (!open) {
    await prisma.$transaction(async (tx) => {
      await tx.verificationRequest.create({
        data: {
          entityType: "achievement",
          entityId: achievement.id,
          issuerId: issuerRow.id,
          requestedBy: userId,
          evidenceIds: [evidence!.id],
        },
      });
      await CLAIM_KINDS.achievement
        .delegate(tx)
        .update({ where: { id: achievement.id }, data: { status: "PENDING_ISSUER" } });
    });
  }

  await audit(prisma, {
    actorType: "system",
    action: "seed.demo",
    entityType: "user",
    entityId: userId,
    after: { did },
  });
  return {
    userId,
    did,
    issuerId: issuerRow.id,
    slug: slugTaken ? null : slug,
    evidenceSha256: Buffer.from(evidence.sha256).toString("hex"),
  };
}
