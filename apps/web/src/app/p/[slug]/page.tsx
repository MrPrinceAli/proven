import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicProfileView, type PublicProfile } from "@/components/PublicProfileView";
import { serverApi, siteOrigin } from "@/lib/server-api";

export const dynamic = "force-dynamic";

const load = (slug: string) => serverApi<PublicProfile>(`/p/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { body } = await load(params.slug);
  if (!body) return { title: "Profil tidak ditemukan" };
  const title = `@${body.slug}${body.headline ? ` — ${body.headline}` : ""}`;
  const verified = body.credentials.filter((c) => c.status === "active").length;
  const description =
    body.summary.slice(0, 160) ||
    `Profil profesional terverifikasi di Proven · ${verified} kredensial aktif.`;
  return {
    title,
    description,
    metadataBase: new URL(siteOrigin()),
    alternates: { canonical: `/p/${body.slug}` },
    openGraph: { title, description, url: `/p/${body.slug}`, type: "profile", siteName: "Proven" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicProfilePage({ params }: { params: { slug: string } }) {
  const { body } = await load(params.slug);
  // Private, recruiter-only (roadmap) and unknown profiles are all a real 404.
  if (!body) notFound();
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <PublicProfileView profile={body} />
    </div>
  );
}
