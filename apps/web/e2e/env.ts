// Environment for the W7/W8 browser tests: Next on :3100 against Anvil (31337) and the test database.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Resolved from apps/web (Playwright and `pnpm e2e` both run there).
const deployments = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../packages/contracts/deployments/31337.json"), "utf8"),
) as { credentialRegistry: string; issuerRegistry: string; credentialSBT: string };

export const E2E_PORT = 3100;
export const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;
// Anvil default key #1 — public test key, registered as issuer by deploy-local.sh.
export const ISSUER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

export const e2eEnv: Record<string, string> = {
  NODE_ENV: "production",
  DATABASE_URL: process.env.DATABASE_URL_TEST ?? "postgresql://proven:proven@localhost:5432/proven_test",
  SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123456789",
  EVIDENCE_ENC_KEY: Buffer.alloc(32, 9).toString("base64"),
  CHAIN_ID: "31337",
  RPC_URL: "http://127.0.0.1:8545",
  APP_DOMAIN: `localhost:${E2E_PORT}`,
  APP_URL: E2E_ORIGIN,
  ISSUER_ADDRESS: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  ISSUER_NAME: "XYZ Community",
  ISSUER_PRIVATE_KEY: ISSUER_KEY,
  REGISTRY_ADDRESS: deployments.credentialRegistry,
  ISSUER_REGISTRY_ADDRESS: deployments.issuerRegistry,
  CREDENTIAL_SBT_ADDRESS: deployments.credentialSBT,
  LLM_PROVIDER: "mock",
  // Build-time (client) values.
  NEXT_PUBLIC_CHAIN_ID: "31337",
  NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:8545",
  NEXT_PUBLIC_REGISTRY_ADDRESS: deployments.credentialRegistry,
  NEXT_PUBLIC_EXPLORER_URL: "",
};
