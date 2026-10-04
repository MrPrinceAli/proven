"use client";

import { Avatar, Card } from "@proven/ui";
import Link from "next/link";
import { shortDid } from "@/lib/chains";
import { useClaims } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { avatarLabel, displayName } from "./identity";

export function ProfileMiniCard() {
  const { data: me } = useSession();
  const { data: claims } = useClaims();
  if (!me?.wallet) return null;

  const verified = claims?.summary.VERIFIED ?? 0;
  const withEvidence = claims?.summary.EVIDENCE_ATTACHED ?? 0;

  return (
    <Card className="overflow-hidden">
      <div className="h-14 bg-gradient-to-r from-brand-700 to-brand-900" />
      <div className="-mt-7 flex flex-col items-center px-4 pb-4 text-center">
        <Avatar
          seed={me.profile?.slug ?? me.wallet.address}
          label={avatarLabel(me.profile?.slug, me.wallet.did)}
          size={56}
        />
        <Link href="/dashboard/profile" className="mt-2 font-semibold text-ink hover:underline">
          {displayName(me.profile?.slug, me.wallet.did)}
        </Link>
        <p className="mt-1 text-xs text-muted">{me.profile?.headline || "Tambahkan headline di profil"}</p>
        <p className="mt-2 font-mono text-[11px] text-gray-500" title={me.wallet.did}>
          {shortDid(me.wallet.did)}
        </p>
      </div>
      <dl className="border-t border-line px-4 py-3 text-xs">
        <div className="flex justify-between py-0.5">
          <dt className="text-muted">Terverifikasi</dt>
          <dd className="font-semibold text-brand-800">{verified}</dd>
        </div>
        <div className="flex justify-between py-0.5">
          <dt className="text-muted">Ada bukti</dt>
          <dd className="font-semibold text-ink">{withEvidence}</dd>
        </div>
      </dl>
    </Card>
  );
}
