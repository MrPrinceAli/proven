import { shortDid } from "@/lib/chains";

/** Proven has no name field: profiles are known by their slug, otherwise by their DID. */
export function displayName(slug: string | null | undefined, did: string | null | undefined): string {
  if (slug) return `@${slug}`;
  return did ? shortDid(did) : "Profil Proven-ID";
}

export function avatarLabel(slug: string | null | undefined, did: string | null | undefined): string {
  if (slug) return slug.replace(/-/g, "");
  const address = did?.split(":").pop() ?? "";
  return address.slice(2, 4) || "PR";
}
