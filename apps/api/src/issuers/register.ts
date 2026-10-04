import { issuerRegistryAbi } from "@proven/contracts";
import type { PrismaClient } from "@proven/db";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainFor, confirmationsFor } from "../chain/adapter";

export interface IssuerIdentity {
  address: Address;
  name: string;
  did: string;
}

/** Upserts the configured relay issuer as a verified row (D-025). Idempotent. */
export async function bootstrapIssuer(prisma: PrismaClient, issuer: IssuerIdentity) {
  return prisma.issuer.upsert({
    where: { address: issuer.address },
    create: { address: issuer.address, name: issuer.name, did: issuer.did, verified: true },
    update: { name: issuer.name, did: issuer.did, verified: true },
  });
}

/** keccak256(abi.encodePacked(string)), as in RegisterIssuer.s.sol. */
export const packedHash = (value: string): Hex => keccak256(toBytes(value));

export interface RegisterIssuerInput {
  prisma: PrismaClient;
  issuer: IssuerIdentity;
  chainId: number;
  rpcUrl: string;
  issuerRegistryAddress: Address;
  /** Admin of IssuerRegistry. Only needed when the issuer is not active on-chain yet. */
  deployerPrivateKey?: Hex;
}

/** `pnpm issuer:register`: DB row + IssuerRegistry.register when not active yet. Safe to re-run. */
export async function registerIssuer(input: RegisterIssuerInput) {
  const row = await bootstrapIssuer(input.prisma, input.issuer);
  const chain = chainFor(input.chainId, input.rpcUrl);
  const publicClient = createPublicClient({ chain, transport: http(input.rpcUrl) });
  const registry = { address: input.issuerRegistryAddress, abi: issuerRegistryAbi } as const;

  const active = await publicClient.readContract({
    ...registry,
    functionName: "isActive",
    args: [input.issuer.address],
  });
  if (active) return { issuerId: row.id, txHash: null, alreadyActive: true };

  if (!input.deployerPrivateKey)
    throw new Error("Issuer is not active on-chain and DEPLOYER_PRIVATE_KEY is missing");
  const account = privateKeyToAccount(input.deployerPrivateKey);
  const walletClient = createWalletClient({ account, chain, transport: http(input.rpcUrl) });
  const { request } = await publicClient.simulateContract({
    ...registry,
    functionName: "register",
    args: [input.issuer.address, packedHash(input.issuer.name), packedHash(input.issuer.did)],
    account,
  });
  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: confirmationsFor(input.chainId),
  });
  return { issuerId: row.id, txHash, alreadyActive: false };
}
