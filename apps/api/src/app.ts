import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { getPrisma, type PrismaClient } from "@proven/db";
import { loadConfig, type Config } from "./config";
import { problem, registerProblemHandlers } from "./problem";
import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";

declare module "fastify" {
  interface FastifyInstance {
    config: Config;
    prisma: PrismaClient;
  }
}

export interface BuildAppOptions {
  fastify?: FastifyServerOptions;
  /** Defaults to loadConfig(process.env), which throws on an invalid environment. */
  config?: Config;
  /** Defaults to the process-wide client. */
  prisma?: PrismaClient;
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
  registerProblemHandlers(app);

  await app.register(helmet);
  await app.register(cors, { origin: config.allowedOrigins, credentials: true });
  await app.register(cookie, { secret: config.sessionSecret });
  // In-memory store: limits are per function instance on Vercel (best effort).
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) =>
      problem(429, "rate-limited", `Rate limit exceeded, retry in ${context.after}`),
  });

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(authRoutes);
  await app.register(meRoutes);

  return app;
}
