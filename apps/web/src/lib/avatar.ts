import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";

const cache = new Map<string, string>();

/**
 * Illustrated avatar for a profile (D-034): DiceBear "notionists" (artwork CC0 1.0), rendered locally
 * as an SVG data URI — no request leaves the browser or server.
 */
export function avatarUri(seed: string): string {
  let uri = cache.get(seed);
  if (!uri) {
    uri = createAvatar(notionists, { seed, backgroundColor: ["d1fae5", "ccfbf1", "ecfccb"] }).toDataUri();
    cache.set(seed, uri);
  }
  return uri;
}

/** Seeds a user can cycle through in the profile editor ("Ganti avatar"). */
export const AVATAR_CHOICES = Array.from({ length: 80 }, (_, i) => `pv-${i}`);
