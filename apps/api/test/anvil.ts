import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Address } from "viem";
import { hasDatabase } from "./helpers";

// Shared setup for tests that need `anvil` + `pnpm contracts:deploy:local` (the CI build job does both).
export const ANVIL_RPC = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";
const deploymentsFile = fileURLToPath(
  new URL("../../../packages/contracts/deployments/31337.json", import.meta.url),
);

// Anvil default accounts — public test keys, never used on a real chain.
export const ANVIL_KEYS = {
  deployer: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  issuer: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  third: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  stranger: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
} as const;

export interface Deployment {
  credentialRegistry: Address;
  issuerRegistry: Address;
  credentialSBT: Address;
}

async function probe(): Promise<boolean> {
  if (!existsSync(deploymentsFile)) return false;
  try {
    const res = await fetch(ANVIL_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    return (await res.json()).result === "0x7a69";
  } catch {
    return false;
  }
}

export const anvilReady = hasDatabase && (await probe());
if (process.env.REQUIRE_ANVIL && !anvilReady) {
  throw new Error("REQUIRE_ANVIL is set but Anvil, deployments/31337.json or DATABASE_URL_TEST is missing");
}

export const deployment: Deployment = anvilReady
  ? JSON.parse(readFileSync(deploymentsFile, "utf8"))
  : { credentialRegistry: "0x0", issuerRegistry: "0x0", credentialSBT: "0x0" };
