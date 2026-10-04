import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";

/**
 * Illustrated avatar for a profile seed (D-034): DiceBear "notionists" (artwork CC0 1.0), rendered on
 * the server so the library stays out of the browser bundle. Deterministic, so cached for a year.
 */
export function GET(_request: Request, { params }: { params: { seed: string } }) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(params.seed)) return new Response("Not found", { status: 404 });
  const svg = createAvatar(notionists, {
    seed: params.seed,
    backgroundColor: ["d1fae5", "ccfbf1", "ecfccb"],
  }).toString();
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      // Only ever used as an <img>; forbid scripts if opened directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
