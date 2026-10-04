// pnpm smoke:testnet — reads the deployed contracts on BSC Testnet without writing (§W8 4).
import { credentialRegistryAbi, issuerRegistryAbi } from "@proven/contracts";
import { anchorFromTuple } from "@proven/vc";
import { createPublicClient, getAddress, http, type Hex } from "viem";
import { bscTestnet } from "viem/chains";

const env = (n: string) => {
  const v = process.env[n]?.trim();
  if (!v) throw new Error(`${n} is required`);
  return v;
};
const rpcUrl =
  process.env.BSC_TESTNET_RPC_URL?.trim() ||
  process.env.RPC_URL?.trim() ||
  "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const client = createPublicClient({ chain: bscTestnet, transport: http(rpcUrl) });

const issuer = getAddress(env("ISSUER_ADDRESS"));
const active = await client.readContract({
  address: getAddress(env("ISSUER_REGISTRY_ADDRESS")),
  abi: issuerRegistryAbi,
  functionName: "isActive",
  args: [issuer],
});
console.log(`IssuerRegistry.isActive(${issuer}) = ${active}`);

const hash = process.env.DEMO_CREDENTIAL_HASH?.trim() as Hex | undefined;
if (hash) {
  const anchor = anchorFromTuple(
    await client.readContract({
      address: getAddress(env("REGISTRY_ADDRESS")),
      abi: credentialRegistryAbi,
      functionName: "getAnchor",
      args: [hash],
    }),
  );
  console.log(
    anchor
      ? `getAnchor(${hash}): issuer ${anchor.issuer}, revoked ${anchor.revoked}`
      : `getAnchor(${hash}): tidak ditemukan`,
  );
} else {
  console.log("DEMO_CREDENTIAL_HASH tidak diisi — pengecekan anchor dilewati.");
}
if (!active) process.exit(1);
