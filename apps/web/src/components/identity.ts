import { shortDid } from "@/lib/chains";

/** The profile's display name (D-034), else its @slug, else its short DID. */
export function displayName(
  name: string | null | undefined,
  slug: string | null | undefined,
  did: string | null | undefined,
): string {
  if (name?.trim()) return name.trim();
  if (slug) return `@${slug}`;
  return did ? shortDid(did) : "Profil Proven-ID";
}

export function avatarLabel(
  name: string | null | undefined,
  slug: string | null | undefined,
  did: string | null | undefined,
): string {
  if (name?.trim()) return `Foto profil ${name.trim()}`;
  if (slug) return `Foto profil @${slug}`;
  return did ? `Foto profil ${shortDid(did)}` : "Foto profil";
}
