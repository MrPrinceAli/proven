"use client";

import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";
import { useSession } from "@/lib/session";
import { site } from "@/lib/site";

export default function HomePage() {
  const { data: me } = useSession();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">{site.name}</p>
      <h1 className="text-3xl font-bold sm:text-5xl">{site.tagline}</h1>
      <p className="max-w-xl text-gray-600">{site.description}</p>
      {me ? (
        <Link
          href="/dashboard"
          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Buka dashboard
        </Link>
      ) : (
        <LoginButton />
      )}
      <p className="text-xs text-gray-500">
        Login memakai tanda tangan wallet (Sign-In with Ethereum) di BNB Smart Chain Testnet. Gratis, tanpa
        transaksi.
      </p>
    </main>
  );
}
