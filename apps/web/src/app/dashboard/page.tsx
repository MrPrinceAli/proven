"use client";

import { Card, IconFile, IconUser, SectionCard, StatusBadge, STATUS_STYLES, buttonClasses } from "@proven/ui";
import Link from "next/link";
import { useClaims, useEvidence } from "@/lib/queries";
import { useSession } from "@/lib/session";

const STATUSES = [
  "UNVERIFIED",
  "EVIDENCE_ATTACHED",
  "PENDING_ISSUER",
  "VERIFIED",
  "EXPIRED",
  "REVOKED",
] as const;

export default function DashboardPage() {
  const { data: me } = useSession();
  const { data: claims, isLoading } = useClaims();
  const { data: evidence } = useEvidence();
  if (!me) return null;

  const total = claims ? Object.values(claims.summary).reduce((a, b) => a + b, 0) : 0;
  const steps = [
    {
      done: Boolean(me.profile?.headline && me.profile.slug),
      label: "Isi headline dan slug profil",
      href: "/dashboard/profile",
    },
    {
      done: total > 0,
      label: "Tambahkan minimal satu klaim (prestasi, keahlian, …)",
      href: "/dashboard/profile",
    },
    { done: (evidence?.length ?? 0) > 0, label: "Unggah bukti (PDF/PNG/JPG)", href: "/dashboard/evidence" },
    {
      done: (claims?.summary.EVIDENCE_ATTACHED ?? 0) + (claims?.summary.VERIFIED ?? 0) > 0,
      label: "Tautkan bukti ke klaim",
      href: "/dashboard/evidence",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h1 className="text-xl font-semibold">Halo! Ini ringkasan klaimmu</h1>
        <p className="mt-1 text-sm text-muted">
          Setiap klaim bergerak dari <em>klaim</em> → <em>bukti</em> → <em>verifikasi issuer</em> →{" "}
          <em>terbukti</em>.
        </p>
        {isLoading ? (
          <p className="mt-4 text-sm text-muted">Memuat…</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Jumlah klaim per status">
            {STATUSES.map((status) => (
              <li key={status} className="rounded-md border border-line p-3">
                <p
                  className="text-2xl font-semibold text-ink"
                  aria-label={`${claims?.summary[status] ?? 0} klaim`}
                >
                  {claims?.summary[status] ?? 0}
                </p>
                <StatusBadge status={status} className="mt-1" />
                <p className="sr-only">{STATUS_STYLES[status].description}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SectionCard title="Langkah berikutnya">
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  s.done ? "bg-brand-700 text-white" : "bg-gray-100 text-muted"
                }`}
                aria-hidden
              >
                {s.done ? "✓" : i + 1}
              </span>
              <Link href={s.href} className={s.done ? "text-muted line-through" : "text-ink hover:underline"}>
                {s.label}
              </Link>
              <span className="sr-only">{s.done ? "(selesai)" : "(belum)"}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/dashboard/profile" className={buttonClasses("primary")}>
            <IconUser className="h-4 w-4" /> Kelola profil
          </Link>
          <Link href="/dashboard/evidence" className={buttonClasses("secondary")}>
            <IconFile className="h-4 w-4" /> Unggah bukti
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
