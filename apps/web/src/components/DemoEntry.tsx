"use client";

import { Button, Card, IconShield, IconUser } from "@proven/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { useAppConfig, useDemoLogin } from "@/lib/demo";

const DARK_BUTTON =
  "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold " +
  "text-white transition hover:border-emerald-300/60 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50";

/** Landing entry for judges and visitors without a wallet (D-032). */
export function DemoEntry({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { data: config } = useAppConfig();
  const login = useDemoLogin();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (!config?.demoMode) return null;

  async function enter(role: "user" | "issuer") {
    setError(null);
    try {
      await login.mutateAsync(role);
      router.push(role === "issuer" ? "/issuer" : "/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal masuk mode demo");
    }
  }

  const issuerLabel = `Coba sebagai Issuer${config.issuerName ? ` (${config.issuerName})` : ""}`;

  if (tone === "dark") {
    return (
      <div className="glass w-full max-w-xl rounded-2xl p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Tanpa wallet</p>
        <p className="mt-1.5 text-sm leading-relaxed text-white/70">
          Masuk ke akun contoh berisi profil, bukti, dan permintaan verifikasi. Persetujuan issuer benar-benar
          dicatat di BNB Smart Chain Testnet.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={DARK_BUTTON}
            onClick={() => enter("user")}
            disabled={login.isPending}
          >
            <IconUser className="h-4 w-4 text-emerald-300" /> Coba sebagai User
          </button>
          <button
            type="button"
            className={DARK_BUTTON}
            onClick={() => enter("issuer")}
            disabled={login.isPending}
          >
            <IconShield className="h-4 w-4 text-emerald-300" /> {issuerLabel}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-200">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full max-w-xl p-5 text-left">
      <h2 className="font-semibold">Coba tanpa wallet</h2>
      <p className="mt-1 text-sm text-muted">
        Masuk ke akun contoh yang sudah berisi profil, bukti, dan permintaan verifikasi. Sebagai issuer,
        persetujuanmu benar-benar dicatat di BNB Smart Chain Testnet.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => enter("user")} disabled={login.isPending}>
          <IconUser className="h-4 w-4" /> Coba sebagai User
        </Button>
        <Button variant="secondary" onClick={() => enter("issuer")} disabled={login.isPending}>
          <IconShield className="h-4 w-4" /> {issuerLabel}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </Card>
  );
}
