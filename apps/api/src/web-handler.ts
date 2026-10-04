import type { FastifyInstance, InjectOptions } from "fastify";

export interface WebHandlerOptions {
  /** Path prefix under which the API is mounted in Next.js. */
  prefix?: string;
}

// Hop-by-hop or length headers that must not be copied onto a Web Response.
const SKIPPED_RESPONSE_HEADERS = new Set(["connection", "keep-alive", "transfer-encoding", "content-length"]);

/**
 * Adapts a Fastify app to a Web `Request -> Response` handler so it can run inside a
 * Next.js route handler (apps/web/src/app/api/[...path]/route.ts). The app is built once
 * per function instance and reused across invocations.
 */
export function createWebHandler(
  factory: () => Promise<FastifyInstance>,
  { prefix = "/api" }: WebHandlerOptions = {},
): (request: Request) => Promise<Response> {
  let ready: Promise<FastifyInstance> | undefined;

  const getApp = () => {
    if (!ready) {
      ready = factory().then(async (app) => {
        await app.ready();
        return app;
      });
      // Do not cache a failed build; the next request retries.
      ready.catch(() => {
        ready = undefined;
      });
    }
    return ready;
  };

  return async (request) => {
    const app = await getApp();
    const url = new URL(request.url);

    let path = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname;
    if (!path.startsWith("/")) path = `/${path}`;

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const method = request.method.toUpperCase() as NonNullable<InjectOptions["method"]>;
    const hasBody = method !== "GET" && method !== "HEAD";
    const payload = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;

    const res = await app.inject({
      method,
      url: `${path}${url.search}`,
      headers,
      payload: payload && payload.length > 0 ? payload : undefined,
    });

    const out = new Headers();
    for (const [key, value] of Object.entries(res.headers)) {
      if (value === undefined || SKIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) continue;
      if (Array.isArray(value)) {
        for (const v of value) out.append(key, String(v));
      } else {
        out.set(key, String(value));
      }
    }

    const noBody = method === "HEAD" || res.statusCode === 204 || res.statusCode === 304;
    return new Response(noBody ? null : res.rawPayload, { status: res.statusCode, headers: out });
  };
}
