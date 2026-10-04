"use client";

import { IconSparkles } from "@proven/ui";
import { useRouter } from "next/navigation";
import { useDemoLogin } from "@/lib/demo";
import { useSession } from "@/lib/session";

/** Shown during demo-mode sessions: explains the sandbox and switches role. */
export function DemoBanner() {
  const { data: me } = useSession();
  const login = useDemoLogin();
  const router = useRouter();
  if (!me?.demo) return null;
  const isIssuer = me.roles.includes("issuer");

  async function switchTo(role: "user" | "issuer") {
    await login.mutateAsync(role);
    router.push(role === "issuer" ? "/issuer" : "/dashboard");
  }

  return (
    <div role="note" className="border-b border-amber-200 bg-amber-50 text-amber-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <IconSparkles className="h-4 w-4" />
        <span>
          <strong>Mode demo</strong> —{" "}
          {isIssuer ? "kamu bertindak sebagai issuer XYZ Community" : "akun contoh milikmu sendiri"};
          transaksi tercatat sungguhan di BNB Smart Chain Testnet.
        </span>
        <button
          type="button"
          onClick={() => switchTo(isIssuer ? "user" : "issuer")}
          disabled={login.isPending}
          className="ml-auto rounded-full border border-amber-400 px-3 py-0.5 font-medium hover:bg-amber-100 disabled:opacity-50"
        >
          {login.isPending ? "Beralih…" : isIssuer ? "Beralih ke User demo" : "Beralih ke Issuer demo"}
        </button>
      </div>
    </div>
  );
}
