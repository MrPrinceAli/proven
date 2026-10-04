import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { createLlmClient, type LlmClient } from "@proven/ai";
import { getPrisma, type PrismaClient } from "@proven/db";
import { chainFromConfig, type ChainAdapter } from "./chain/adapter";
import { bootstrapIssuer } from "./issuers/register";
import { loadConfig, type Config } from "./config";
import { problem, registerProblemHandlers } from "./problem";
import { adminRoutes } from "./routes/admin";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { demoRoutes } from "./routes/demo";
import { claimRoutes } from "./routes/claims";
import { evidenceRoutes, MAX_EVIDENCE_BYTES } from "./routes/evidence";
import { meRoutes } from "./routes/me";
import { publicRoutes } from "./routes/public";
import { verificationRoutes } from "./routes/verification";
import { verifyRoutes } from "./routes/verify";

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
  /** Defaults to the client configured by LLM_PROVIDER (mock unless set to anthropic). */
  llm?: LlmClient;
  /** Requests per minute: global and SIWE per IP, AI per user. */
  rateLimit?: { max?: number; authMax?: number; aiMax?: number };
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
  app.decorate("aiRateLimit", options.rateLimit?.aiMax ?? 10);
  app.decorate("llm", options.llm ?? createLlmClient(config.llm));
  app.decorate("chain", options.chain === undefined ? chainFromConfig(config, prisma) : options.chain);
  registerProblemHandlers(app);
  if (config.issuer) await bootstrapIssuer(prisma, config.issuer);

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
  await app.register(verificationRoutes);
  await app.register(aiRoutes);
  await app.register(verifyRoutes);
  await app.register(adminRoutes);
  await app.register(demoRoutes);

  return app;
}
