import { getAddress, isAddress } from "viem";
import { z } from "zod";

const eip55Address = z
  .string()
  .trim()
  .refine((value) => isAddress(value, { strict: false }) && getAddress(value) === value, {
    message: "must be an EIP-55 checksummed address",
  });

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  CHAIN_ID: z.coerce.number().int().positive(),
  RPC_URL: z.string().url(),
  APP_DOMAIN: z.string().min(1),
  APP_URL: z.string().url(),
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
  adminAddresses: string[];
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
    adminAddresses: e.ADMIN_ADDRESSES,
    allowedDomains,
    allowedOrigins,
  };
}
