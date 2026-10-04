// Runs during the Vercel build after migrations (D-034): makes the showcase certificate name the
// showcase persona. Idempotent and never fails the build — a problem is only logged.
import { createPrismaClient } from "@proven/db";
import { healShowcase } from "../src/seed/demo";

const url = process.env.DATABASE_URL;
const key = Buffer.from(process.env.EVIDENCE_ENC_KEY ?? "", "base64");
if (!url || key.length !== 32) {
  console.warn("heal-showcase: DATABASE_URL/EVIDENCE_ENC_KEY tidak tersedia — dilewati.");
  process.exit(0);
}

const prisma = createPrismaClient(url);
try {
  const result = await healShowcase(prisma, key, process.env.ISSUER_NAME?.trim() || "XYZ Community");
  console.log(
    `heal-showcase: ${result.changed ? "sertifikat diperbarui" : `tidak ada perubahan (${result.reason})`}`,
  );
} catch (error) {
  console.warn("heal-showcase: gagal, dilewati —", error instanceof Error ? error.message : error);
} finally {
  await prisma.$disconnect();
}
