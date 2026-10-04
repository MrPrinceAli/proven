"use client";

import { Button, Card, IconShield, IconUser } from "@proven/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { useAppConfig, useDemoLogin } from "@/lib/demo";

/** Landing card for judges and visitors without a wallet (D-032). */
export function DemoEntry() {
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
          <IconShield className="h-4 w-4" /> Coba sebagai Issuer
          {config.issuerName ? ` (${config.issuerName})` : ""}
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
