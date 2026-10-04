import { buildApp, createWebHandler } from "@proven/api";

// The Fastify API is served from this route under /api/* (D-003).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = createWebHandler(() => buildApp());

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
  handle as HEAD,
};
