"use client";

import { useSession } from "@/lib/session";

export default function DashboardPage() {
  const { data: me } = useSession();
  if (!me) return null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Selamat datang di Proven</h1>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[auto,1fr]">
        <dt className="text-gray-500">DID</dt>
        <dd className="break-all font-mono" data-testid="did">
          {me.wallet?.did}
        </dd>
        <dt className="text-gray-500">Wallet</dt>
        <dd className="break-all font-mono">{me.wallet?.address}</dd>
        <dt className="text-gray-500">Peran</dt>
        <dd>{me.roles.join(", ")}</dd>
      </dl>
      <p className="mt-4 text-sm text-gray-600">Ringkasan klaim per status hadir di gelombang W3.</p>
    </section>
  );
}
