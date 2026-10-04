import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { createSiweMessage } from "viem/siwe";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { createPrismaClient, type PrismaClient } from "@proven/db";
import { buildApp } from "../src/app";
import { loadConfig, type Config } from "../src/config";
import { SESSION_COOKIE } from "../src/auth/session";

export const TEST_DATABASE_URL = process.env.DATABASE_URL_TEST;
export const hasDatabase = Boolean(TEST_DATABASE_URL);

export const TEST_DOMAIN = "proven.test";
export const TEST_ORIGIN = `https://${TEST_DOMAIN}`;
export const TEST_CHAIN_ID = 97;

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: TEST_DATABASE_URL ?? "postgresql://unused@localhost/unused",
    SESSION_SECRET: "test-session-secret-0123456789abcdef0123456789",
    CHAIN_ID: String(TEST_CHAIN_ID),
    // Unroutable on purpose: tests must never reach a real chain.
    RPC_URL: "http://127.0.0.1:1",
    APP_DOMAIN: TEST_DOMAIN,
    APP_URL: TEST_ORIGIN,
    ADMIN_ADDRESSES: "",
    ...overrides,
  });
}

let sharedPrisma: PrismaClient | undefined;
export function testPrisma(): PrismaClient {
  sharedPrisma ??= createPrismaClient(TEST_DATABASE_URL);
  return sharedPrisma;
}

export async function testApp(configOverrides: Record<string, string> = {}): Promise<FastifyInstance> {
  return buildApp({ config: testConfig(configOverrides), prisma: testPrisma() });
}

/** Empties every table between tests (TRUNCATE does not fire the audit_logs row trigger). */
export async function resetDatabase(prisma = testPrisma()) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export const newAccount = () => privateKeyToAccount(generatePrivateKey());

export interface SiweOverrides {
  domain?: string;
  uri?: string;
  chainId?: number;
  address?: `0x${string}`;
  expirationTime?: Date;
}

export async function requestNonce(app: FastifyInstance, address: string, chainId = TEST_CHAIN_ID) {
  return app.inject({ method: "POST", url: "/auth/siwe/nonce", payload: { address, chainId } });
}

export async function signIn(
  app: FastifyInstance,
  account: PrivateKeyAccount,
  overrides: SiweOverrides & { nonce?: string } = {},
): Promise<{ response: LightMyRequestResponse; message: string; signature: string }> {
  const nonce = overrides.nonce ?? (await requestNonce(app, account.address)).json().nonce;
  const message = createSiweMessage({
    address: overrides.address ?? account.address,
    chainId: overrides.chainId ?? TEST_CHAIN_ID,
    domain: overrides.domain ?? TEST_DOMAIN,
    uri: overrides.uri ?? TEST_ORIGIN,
    nonce,
    version: "1",
    issuedAt: new Date(),
    expirationTime: overrides.expirationTime,
    statement: "Masuk ke Proven",
  });
  const signature = await account.signMessage({ message });
  const response = await app.inject({
    method: "POST",
    url: "/auth/siwe/verify",
    payload: { message, signature },
  });
  return { response, message, signature };
}

export function sessionCookie(response: LightMyRequestResponse): Record<string, string> {
  const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE);
  if (!cookie) throw new Error("no session cookie in response");
  return { [SESSION_COOKIE]: cookie.value };
}
