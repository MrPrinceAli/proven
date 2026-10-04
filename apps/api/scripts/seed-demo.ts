// pnpm db:seed — demo data (§W8 2). Run by ops.yml (task db-seed) against production, or locally.
// Needs only: DATABASE_URL, EVIDENCE_ENC_KEY, CHAIN_ID, ISSUER_ADDRESS, ISSUER_NAME, DEMO_USER_ADDRESS.
import { createPrismaClient } from "@proven/db";
import { getAddress } from "viem";
import { seedDemo } from "../src/seed/demo";

const env = (name: string, fallback?: string) => {
  const value = process.env[name]?.trim() || fallback;
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const chainId = Number(env("CHAIN_ID"));
const issuerAddress = getAddress(env("ISSUER_ADDRESS"));
const key = Buffer.from(env("EVIDENCE_ENC_KEY"), "base64");
if (key.length !== 32) throw new Error("EVIDENCE_ENC_KEY must be 32 bytes (base64)");
// Anvil #3 by default so local demos work out of the box.
const demoAddress = getAddress(env("DEMO_USER_ADDRESS", "0x90F79bf6EB2c4f870365E785982E1f101E93b906"));

const prisma = createPrismaClient(env("DATABASE_URL"));
try {
  const result = await seedDemo({
    prisma,
    chainId,
    evidenceKey: key,
    issuer: {
      address: issuerAddress,
      name: env("ISSUER_NAME", "XYZ Community"),
      did: `did:ethr:${chainId}:${issuerAddress.toLowerCase()}`,
    },
    demoAddress,
  });
  console.log(
    `Seed selesai: user ${result.did}${result.slug ? `, profil /p/${result.slug}` : ""}, sertifikat sha256 ${result.evidenceSha256.slice(0, 16)}…`,
  );
} finally {
  await prisma.$disconnect();
}
