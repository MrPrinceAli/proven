// Server-only: calls the API in-process (no network hop). Fetching our own public URL would be
// blocked by Vercel preview protection and adds latency. Import only from server components.
import { buildApp, createWebHandler } from "@proven/api";

const handle = createWebHandler(() => buildApp());

export async function serverApi<T>(path: string): Promise<{ status: number; body: T | null }> {
  try {
    const res = await handle(new Request(`http://internal/api${path}`));
    return { status: res.status, body: res.ok ? ((await res.json()) as T) : null };
  } catch {
    return { status: 503, body: null };
  }
}

/** Absolute site origin for metadata/QR on the server (Vercel production URL, else APP_URL). */
export function siteOrigin(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return process.env.APP_URL ?? "http://localhost:3000";
}
