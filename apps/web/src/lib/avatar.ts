/** URL of the illustrated avatar for a profile seed (served by app/avatar/[seed]/route.ts, D-034). */
export function avatarUri(seed: string): string {
  return `/avatar/${encodeURIComponent(seed)}`;
}

/** Seeds a user can cycle through in the profile editor ("Ganti avatar"). */
export const AVATAR_CHOICES = Array.from({ length: 80 }, (_, i) => `pv-${i}`);
