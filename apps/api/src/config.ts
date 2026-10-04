import { getAddress, isAddress } from "viem";
import { z } from "zod";

const eip55Address = z
  .string()
  .trim()
  .refine((value) => isAddress(value, { strict: false }) && getAddress(value) === value, {
    message: "must be an EIP-55 checksummed address",
  });

const optionalAddress = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || isAddress(v, { strict: false }), { message: "must be an address" })
  .transform((v) => (v ? getAddress(v) : undefined));

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  CHAIN_ID: z.coerce.number().int().positive(),
  RPC_URL: z.string().url(),
  APP_DOMAIN: z.string().min(1),
  APP_URL: z.string().url(),
  EVIDENCE_ENC_KEY: z.string().refine((value) => Buffer.from(value, "base64").length === 32, {
    message: "must be 32 bytes encoded as base64 (openssl rand -base64 32)",
  }),
  ADMIN_ADDRESSES: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    )
    .pipe(z.array(eip55Address)),
  // Chain (W4). Optional so the API still serves profiles before contracts are deployed;
  // chain-dependent endpoints answer 502 chain-unavailable until these are set.
  ISSUER_PRIVATE_KEY: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^0x[0-9a-fA-F]{64}$/.test(v), {
      message: "must be a 0x-prefixed 32-byte hex key",
    }),
  REGISTRY_ADDRESS: optionalAddress,
  ISSUER_REGISTRY_ADDRESS: optionalAddress,
  CREDENTIAL_SBT_ADDRESS: optionalAddress,
  // Vercel system environment variables (D-007). Absent outside Vercel.
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
});

export interface Config {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  sessionSecret: string;
  chainId: number;
  rpcUrl: string;
  appUrl: string;
  /** AES-256-GCM key for evidence at rest (32 bytes). */
  evidenceKey: Buffer;
  adminAddresses: string[];
  /** Server-only issuer key (golden rule #4); never logged or returned. */
  issuerPrivateKey?: `0x${string}`;
  registryAddress?: `0x${string}`;
  issuerRegistryAddress?: `0x${string}`;
  credentialSbtAddress?: `0x${string}`;
  /** Hosts a SIWE message may name as its `domain` (D-007). */
  allowedDomains: string[];
  /** Origins a SIWE message may name as its `uri`. */
  allowedOrigins: string[];
}

const isLocalHost = (host: string) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);

/** Validates the environment once at startup and fails fast with every problem listed. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  const e = parsed.data;

  const allowedDomains = [
    ...new Set(
      [e.APP_DOMAIN, e.VERCEL_URL, e.VERCEL_BRANCH_URL, e.VERCEL_PROJECT_PRODUCTION_URL]
        .filter((d): d is string => Boolean(d))
        .map((d) => d.trim().toLowerCase()),
    ),
  ];
  const allowedOrigins = [
    ...new Set([
      new URL(e.APP_URL).origin,
      ...allowedDomains.map((d) => (isLocalHost(d) ? `http://${d}` : `https://${d}`)),
    ]),
  ];

  return {
    nodeEnv: e.NODE_ENV,
    databaseUrl: e.DATABASE_URL,
    sessionSecret: e.SESSION_SECRET,
    chainId: e.CHAIN_ID,
    rpcUrl: e.RPC_URL,
    appUrl: e.APP_URL,
    evidenceKey: Buffer.from(e.EVIDENCE_ENC_KEY, "base64"),
    adminAddresses: e.ADMIN_ADDRESSES,
    issuerPrivateKey: e.ISSUER_PRIVATE_KEY as `0x${string}` | undefined,
    registryAddress: e.REGISTRY_ADDRESS,
    issuerRegistryAddress: e.ISSUER_REGISTRY_ADDRESS,
    credentialSbtAddress: e.CREDENTIAL_SBT_ADDRESS,
    allowedDomains,
    allowedOrigins,
  };
}
