// pnpm issuer:register — run by .github/workflows/ops.yml (task issuer-register) or locally against Anvil.
import { getAddress } from "viem";
import { createPrismaClient } from "@proven/db";
import { registerIssuer } from "../src/issuers/register";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const chainId = Number(required("CHAIN_ID"));
const address = getAddress(required("ISSUER_ADDRESS"));
const did = process.env.ISSUER_DID?.trim() || `did:ethr:${chainId}:${address.toLowerCase()}`;
const prisma = createPrismaClient(required("DATABASE_URL"));

try {
  const result = await registerIssuer({
    prisma,
    issuer: { address, name: required("ISSUER_NAME"), did },
    chainId,
    rpcUrl: required("RPC_URL"),
    issuerRegistryAddress: getAddress(required("ISSUER_REGISTRY_ADDRESS")),
    deployerPrivateKey: process.env.DEPLOYER_PRIVATE_KEY?.trim() as `0x${string}` | undefined,
  });
  console.log(
    result.alreadyActive
      ? `Issuer ${address} already active on-chain; DB row ${result.issuerId} upserted.`
      : `Issuer ${address} registered on-chain (tx ${result.txHash}); DB row ${result.issuerId} upserted.`,
  );
} finally {
  await prisma.$disconnect();
}
