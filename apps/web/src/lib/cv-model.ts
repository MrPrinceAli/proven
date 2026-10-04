import { KINDS, type Claim } from "./claims";
import type { AiCv, ClaimsResponse, MyRequest } from "./queries";
import type { Me } from "./session";

export interface CvItem {
  text: string;
  sub?: string | null;
  /** Set when an issuer verified the claim behind this item. */
  verifyUrl?: string;
}

export interface CvModel {
  name: string;
  headline: string;
  summary: string;
  did: string;
  sections: { title: string; items: CvItem[] }[];
  /** e.g. https://proven-id.vercel.app — used in the footer and verify links. */
  origin: string;
  aiGenerated: boolean;
}

/** claim id → verify URL for claims with an approved request whose credential is still VERIFIED. */
function verifiedLinks(claims: ClaimsResponse, requests: MyRequest[], origin: string): Map<string, string> {
  const verified = new Set(
    KINDS.flatMap((k) =>
      (claims.claims[k.path] ?? []).filter((c) => c.status === "VERIFIED").map((c) => c.id),
    ),
  );
  const links = new Map<string, string>();
  for (const r of requests) {
    if (r.state === "approved" && r.credentialId && verified.has(r.entityId)) {
      links.set(r.entityId, `${origin}/verify/${encodeURIComponent(r.credentialId)}`);
    }
  }
  return links;
}

const header = (me: Me) => ({
  name: me.profile?.displayName || (me.profile?.slug ? `@${me.profile.slug}` : "Profil Proven-ID"),
  headline: me.profile?.headline ?? "",
  summary: me.profile?.summary ?? "",
  did: me.wallet?.did ?? "",
});

/** CV straight from the profile data (§W7 7). */
export function cvFromProfile(
  me: Me,
  claims: ClaimsResponse,
  requests: MyRequest[],
  origin: string,
): CvModel {
  const links = verifiedLinks(claims, requests, origin);
  return {
    ...header(me),
    origin,
    aiGenerated: false,
    sections: KINDS.map((kind) => ({
      title: kind.title,
      items: (claims.claims[kind.path] ?? [])
        .filter((c: Claim) => c.status !== "REVOKED")
        .map((c) => ({ text: kind.primary(c), sub: kind.secondary(c), verifyUrl: links.get(c.id) })),
    })).filter((s) => s.items.length > 0),
  };
}

/** CV from an AI draft the user chose to export; an item is verified only via its cited claims. */
export function cvFromAi(
  me: Me,
  ai: AiCv,
  claims: ClaimsResponse,
  requests: MyRequest[],
  origin: string,
): CvModel {
  const links = verifiedLinks(claims, requests, origin);
  return {
    ...header(me),
    origin,
    aiGenerated: true,
    sections: ai.sections.map((s) => ({
      title: s.title,
      items: s.items.map((item) => {
        const claimId = item.citations.map((c) => c.split(":")[1]).find((id) => id && links.has(id));
        return { text: item.text, verifyUrl: claimId ? links.get(claimId) : undefined };
      }),
    })),
  };
}
