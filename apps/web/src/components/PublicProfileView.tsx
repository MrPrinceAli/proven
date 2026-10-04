"use client";

import { Card, IconAward, SectionCard, StatusBadge } from "@proven/ui";
import Link from "next/link";
import { KINDS, type ClaimPath, type PublicClaim } from "@/lib/claims";
import { credentialBadge } from "@/lib/explorer";
import { ClaimSection } from "./ClaimSection";
import { CopyLinkButton } from "./CopyLinkButton";
import { ProfileHeader } from "./ProfileHeader";
import { Qr } from "./Qr";
import { StatusLegend } from "./StatusLegend";

export interface PublicProfile {
  slug: string;
  displayName: string;
  avatarSeed: string | null;
  headline: string;
  summary: string;
  did: string | null;
  claims: Record<ClaimPath, PublicClaim[]>;
  credentials: {
    credentialId: string;
    name: string;
    issuer: string;
    status: string;
    issuedAt: string;
  }[];
}

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" });

export function PublicProfileView({ profile }: { profile: PublicProfile }) {
  const path = `/p/${profile.slug}`;
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr),300px]">
      <main className="flex min-w-0 flex-col gap-4">
        <ProfileHeader
          name={profile.displayName}
          slug={profile.slug}
          headline={profile.headline}
          did={profile.did}
          avatarSeed={profile.avatarSeed}
        />
        {profile.summary && (
          <SectionCard title="Tentang">
            <p className="whitespace-pre-line text-sm text-ink">{profile.summary}</p>
          </SectionCard>
        )}
        {profile.credentials.length > 0 && (
          <SectionCard title="Kredensial terverifikasi" icon={<IconAward className="h-5 w-5" />}>
            <ul className="divide-y divide-line">
              {profile.credentials.map((c) => (
                <li
                  key={c.credentialId}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <Qr
                    value={`/verify/${encodeURIComponent(c.credentialId)}`}
                    label={`verifikasi ${c.name}`}
                    size={64}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{c.name}</p>
                      <StatusBadge status={credentialBadge(c.status)} />
                    </div>
                    <p className="text-sm text-muted">
                      {c.issuer} · {dateFormat.format(new Date(c.issuedAt))}
                    </p>
                    <Link
                      href={`/verify/${encodeURIComponent(c.credentialId)}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      Verifikasi kredensial ini
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
        {KINDS.map((kind) => (
          <ClaimSection key={kind.path} kind={kind} items={profile.claims[kind.path] ?? []} />
        ))}
      </main>
      <aside className="flex flex-col gap-4">
        <Card className="flex flex-col items-center gap-3 p-4 text-center">
          <Qr value={path} label={`profil publik ${profile.displayName || `@${profile.slug}`}`} size={160} />
          <p className="text-sm text-muted">Pindai atau bagikan profil ini</p>
          <CopyLinkButton path={path} label="Salin tautan profil" />
        </Card>
        <div className="hidden lg:block">
          <StatusLegend />
        </div>
      </aside>
    </div>
  );
}
