"use client";

import { Button, IconSparkles, SectionCard, useToast } from "@proven/ui";
import { useState } from "react";
import { AiLabel } from "@/components/AiLabel";
import { ClaimSection, type ClaimCheckHint } from "@/components/ClaimSection";
import { ApiError } from "@/lib/api";
import { ProfileEditDialog } from "@/components/ProfileEditDialog";
import { ProfileHeader } from "@/components/ProfileHeader";
import { KINDS } from "@/lib/claims";
import { useClaimCheck, useClaims } from "@/lib/queries";
import { useSession } from "@/lib/session";

export default function ProfilePage() {
  const { data: me } = useSession();
  const { data: claims, isLoading, isError } = useClaims();
  const [editing, setEditing] = useState(false);
  const check = useClaimCheck();
  const toast = useToast();
  const checks: Record<string, ClaimCheckHint> | undefined = check.data
    ? Object.fromEntries(
        check.data.result.claims.map((c) => [c.claimId, { status: c.status, reason: c.reason }]),
      )
    : undefined;
  if (!me?.profile || !me.wallet) return null;

  return (
    <div className="flex flex-col gap-4">
      <ProfileHeader
        name={me.profile.displayName}
        slug={me.profile.slug}
        headline={me.profile.headline}
        did={me.wallet.did}
        avatarSeed={me.profile.avatarSeed}
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
      <SectionCard title="Cek klaim dengan AI" icon={<IconSparkles className="h-5 w-5" />}>
        <p className="text-sm text-muted">
          AI menilai apakah tiap klaim didukung bukti. Statusnya dihitung ulang dari data issuer — AI tidak
          bisa memberi status Terverifikasi.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              check.mutateAsync().catch((e) => toast(e instanceof ApiError ? e.message : "Gagal", "error"))
            }
            disabled={check.isPending}
          >
            {check.isPending ? "Memeriksa…" : "Cek semua klaim"}
          </Button>
          {check.data && <AiLabel model={check.data.model} />}
        </div>
      </SectionCard>
      {isLoading && <p className="text-sm text-muted">Memuat klaim…</p>}
      {isError && <p className="text-sm text-red-700">Gagal memuat klaim. Muat ulang halaman.</p>}
      {claims &&
        KINDS.map((kind) => (
          <ClaimSection
            key={kind.path}
            kind={kind}
            items={claims.claims[kind.path] ?? []}
            editable
            checks={checks}
          />
        ))}
      {editing && <ProfileEditDialog profile={me.profile} onClose={() => setEditing(false)} />}
    </div>
  );
}
