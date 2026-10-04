"use client";

import { Badge, EmptyState, IconAward, SectionCard } from "@proven/ui";
import Link from "next/link";
import { CredentialCard } from "@/components/CredentialCard";
import { useMyCredentials, useMyRequests } from "@/lib/queries";

const STATE_LABEL = {
  pending: { text: "Menunggu issuer", className: "bg-blue-50 text-blue-800" },
  approved: { text: "Disetujui", className: "bg-brand-50 text-brand-800" },
  rejected: { text: "Ditolak", className: "bg-red-50 text-red-800" },
} as const;

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });

export default function CredentialsPage() {
  const credentials = useMyCredentials();
  const requests = useMyRequests();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Kredensial</h1>
      {credentials.isLoading && <p className="text-sm text-muted">Memuat…</p>}
      {credentials.data?.length === 0 && (
        <EmptyState
          icon={<IconAward />}
          title="Belum ada kredensial"
          description="Lampirkan bukti ke klaim di profil, lalu klik “Minta verifikasi”. Kredensial terbit setelah issuer menyetujui."
          action={
            <Link href="/dashboard/profile" className="text-sm font-semibold text-brand-700 hover:underline">
              Buka profil
            </Link>
          }
        />
      )}
      {credentials.data?.map((c) => (
        <CredentialCard key={c.id} credential={c} />
      ))}

      <SectionCard title="Permintaan verifikasi">
        {requests.data?.length === 0 && <p className="text-sm text-muted">Belum ada permintaan.</p>}
        <ul className="divide-y divide-line">
          {requests.data?.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
              <Link
                href="/dashboard/profile"
                className="font-medium text-ink hover:text-brand-700 hover:underline"
              >
                {r.claim.label}
              </Link>
              <Badge className={STATE_LABEL[r.state].className}>{STATE_LABEL[r.state].text}</Badge>
              <span className="text-muted">
                → {r.issuer.name} · {dateFormat.format(new Date(r.createdAt))}
              </span>
              {r.reason && <span className="w-full text-red-800">Alasan: {r.reason}</span>}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
