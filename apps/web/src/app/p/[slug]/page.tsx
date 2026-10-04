"use client";

import { Card, EmptyState, IconShield, SectionCard } from "@proven/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ClaimSection } from "@/components/ClaimSection";
import { ProfileHeader } from "@/components/ProfileHeader";
import { StatusLegend } from "@/components/StatusLegend";
import { api, ApiError } from "@/lib/api";
import { KINDS, type ClaimPath, type PublicClaim } from "@/lib/claims";

interface PublicProfile {
  slug: string;
  headline: string;
  summary: string;
  did: string | null;
  claims: Record<ClaimPath, PublicClaim[]>;
}

export default function PublicProfilePage({ params }: { params: { slug: string } }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["public-profile", params.slug],
    queryFn: () => api<PublicProfile>(`/p/${encodeURIComponent(params.slug)}`),
  });
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Proven">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-white">
              <IconShield className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold text-brand-800">Proven</span>
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr),300px]">
        <main className="flex min-w-0 flex-col gap-4">
          {isLoading && <p className="text-sm text-muted">Memuat profil…</p>}
          {notFound && (
            <Card className="p-6">
              <EmptyState
                title="Profil tidak ditemukan"
                description="Profil ini tidak ada atau tidak dibagikan secara publik."
              />
            </Card>
          )}
          {error && !notFound && <p className="text-sm text-red-700">Gagal memuat profil.</p>}
          {data && (
            <>
              <ProfileHeader slug={data.slug} headline={data.headline} did={data.did} seed={data.slug} />
              {data.summary && (
                <SectionCard title="Tentang">
                  <p className="whitespace-pre-line text-sm text-ink">{data.summary}</p>
                </SectionCard>
              )}
              {KINDS.map((kind) => (
                <ClaimSection key={kind.path} kind={kind} items={data.claims[kind.path] ?? []} />
              ))}
            </>
          )}
        </main>
        <aside className="hidden lg:block">
          <StatusLegend />
        </aside>
      </div>
    </div>
  );
}
