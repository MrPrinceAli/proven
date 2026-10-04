import { buildApp, createWebHandler } from "@proven/api";

// The Fastify API is served from this route under /api/* (D-003).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const forward = createWebHandler(() => buildApp());

/** createWebHandler only rejects when the app cannot be built, e.g. missing environment variables. */
async function handle(request: Request): Promise<Response> {
  try {
    return await forward(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("API failed to start:", message);
    return Response.json(
      {
        type: "https://proven.app/problems/internal-error",
        title: "Service unavailable",
        status: 503,
        // Only variable names and validation messages, never values.
        detail: message.startsWith("Invalid environment") ? message : "API failed to start",
      },
      { status: 503, headers: { "content-type": "application/problem+json" } },
    );
  }
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
  handle as HEAD,
};
