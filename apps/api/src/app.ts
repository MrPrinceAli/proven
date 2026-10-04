import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";

/**
 * Builds the Proven API without listening on a port. The same instance serves
 * Vercel (via createWebHandler, D-003), tests (app.inject) and the optional dev server.
 */
export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    // Vercel sits behind a proxy; client IP comes from x-forwarded-for.
    trustProxy: true,
    logger: false,
    ...opts,
  });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
