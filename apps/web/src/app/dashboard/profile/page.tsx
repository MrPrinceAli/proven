"use client";

import { SectionCard } from "@proven/ui";
import { useState } from "react";
import { ClaimSection } from "@/components/ClaimSection";
import { ProfileEditDialog } from "@/components/ProfileEditDialog";
import { ProfileHeader } from "@/components/ProfileHeader";
import { KINDS } from "@/lib/claims";
import { useClaims } from "@/lib/queries";
import { useSession } from "@/lib/session";

export default function ProfilePage() {
  const { data: me } = useSession();
  const { data: claims, isLoading, isError } = useClaims();
  const [editing, setEditing] = useState(false);
  if (!me?.profile || !me.wallet) return null;

  return (
    <div className="flex flex-col gap-4">
      <ProfileHeader
        slug={me.profile.slug}
        headline={me.profile.headline}
        did={me.wallet.did}
        seed={me.profile.slug ?? me.wallet.address}
        visibility={me.profile.visibility}
        onEdit={() => setEditing(true)}
      />
      <SectionCard title="Tentang">
        {me.profile.summary ? (
          <p className="whitespace-pre-line text-sm text-ink">{me.profile.summary}</p>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-brand-700 hover:underline"
          >
            Tulis ringkasan tentang dirimu
          </button>
        )}
      </SectionCard>
      {isLoading && <p className="text-sm text-muted">Memuat klaim…</p>}
      {isError && <p className="text-sm text-red-700">Gagal memuat klaim. Muat ulang halaman.</p>}
      {claims &&
        KINDS.map((kind) => (
          <ClaimSection key={kind.path} kind={kind} items={claims.claims[kind.path] ?? []} editable />
        ))}
      {editing && <ProfileEditDialog profile={me.profile} onClose={() => setEditing(false)} />}
    </div>
  );
}
