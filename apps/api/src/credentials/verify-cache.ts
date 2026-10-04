/** Best-effort per-instance cache for public verification results (§W7 1: 30 s). */
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; value: unknown }>();

export function cachedVerify<T>(id: string): T | undefined {
  const hit = cache.get(id);
  return hit && Date.now() - hit.at < CACHE_MS ? (hit.value as T) : undefined;
}

export function storeVerify(id: string, value: unknown) {
  cache.set(id, { at: Date.now(), value });
}

/** Revocations through this instance clear the entry immediately. */
export const invalidateVerifyCache = (id: string) => cache.delete(id);
