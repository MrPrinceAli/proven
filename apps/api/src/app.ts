import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { getPrisma, type PrismaClient } from "@proven/db";
import { chainFromConfig, type ChainAdapter } from "./chain/adapter";
import { loadConfig, type Config } from "./config";
import { problem, registerProblemHandlers } from "./problem";
import { authRoutes } from "./routes/auth";
import { claimRoutes } from "./routes/claims";
import { evidenceRoutes, MAX_EVIDENCE_BYTES } from "./routes/evidence";
import { meRoutes } from "./routes/me";
import { publicRoutes } from "./routes/public";

declare module "fastify" {
  interface FastifyInstance {
    config: Config;
    prisma: PrismaClient;
    authRateLimit: number;
    /** null until contracts are configured (endpoints then answer 502 chain-unavailable). */
    chain: ChainAdapter | null;
  }
}

export interface BuildAppOptions {
  fastify?: FastifyServerOptions;
  /** Defaults to loadConfig(process.env), which throws on an invalid environment. */
  config?: Config;
  /** Defaults to the process-wide client. */
  prisma?: PrismaClient;
  /** Defaults to an adapter built from config (or null when contracts are not configured). */
  chain?: ChainAdapter | null;
  /** Requests per minute per IP: global and for the SIWE endpoints. */
  rateLimit?: { max?: number; authMax?: number };
}

/**
 * Builds the Proven API without listening on a port. The same instance serves
 * Vercel (via createWebHandler, D-003), tests (app.inject) and the optional dev server.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const prisma = options.prisma ?? getPrisma();

  const app = Fastify({
    // Vercel sits behind a proxy; client IP comes from x-forwarded-for.
    trustProxy: true,
    logger: false,
    ...options.fastify,
  });

  app.decorate("config", config);
  app.decorate("prisma", prisma);
  app.decorate("authRateLimit", options.rateLimit?.authMax ?? 20);
  app.decorate("chain", options.chain === undefined ? chainFromConfig(config, prisma) : options.chain);
  registerProblemHandlers(app);

  await app.register(helmet);
  await app.register(cors, { origin: config.allowedOrigins, credentials: true });
  await app.register(cookie, { secret: config.sessionSecret });
  // In-memory store: limits are per function instance on Vercel (best effort).
  await app.register(rateLimit, {
    max: options.rateLimit?.max ?? 300,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) =>
      problem(429, "rate-limited", `Rate limit exceeded, retry in ${context.after}`),
  });

  await app.register(multipart, {
    limits: { fileSize: MAX_EVIDENCE_BYTES, files: 1, fields: 10, fieldSize: 4096 },
  });

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(claimRoutes);
  await app.register(evidenceRoutes);
  await app.register(publicRoutes);

  return app;
}
