import { IconCheckBadge, IconLock, IconSparkles } from "@proven/ui";
import { site } from "@/lib/site";

/**
 * Decorative preview of a verified credential for the hero. Mirrors the showcase profile
 * (/p/{showcaseSlug}); hidden from assistive tech because the real data lives on that page.
 */
export function CredentialMock() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-sm select-none lg:ml-auto lg:mr-0">
      {/* halo */}
      <div className="absolute -inset-12 bg-[radial-gradient(closest-side,rgb(52_211_153/0.22),transparent)]" />

      <div className="animate-float relative">
        <div className="glass relative overflow-hidden rounded-3xl p-5 shadow-glow">
          {/* light sweep */}
          <div className="animate-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
              Verifiable Credential
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[10px] text-white/70">
              VC 2.0
            </span>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-teal-600 text-lg font-bold text-brand-950 ring-4 ring-white/10">
              {site.showcaseName
                .split(" ")
                .map((w) => w[0])
                .join("")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-white">{site.showcaseName}</p>
              <p className="truncate text-sm text-white/60">Smart Contract Engineer · BNB Chain</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-white/50">Prestasi</p>
            <p className="mt-1 font-semibold text-white">XYZ Hackathon 2026 — Winner</p>
            <p className="mt-0.5 text-sm text-white/60">Diterbitkan oleh XYZ Community</p>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-400/15 p-3 ring-1 ring-emerald-300/30">
            <span className="relative flex h-9 w-9 items-center justify-center">
              <span className="animate-pulse-ring absolute inset-0 rounded-full bg-emerald-400/40" />
              <IconCheckBadge className="relative h-8 w-8 text-emerald-300" />
            </span>
            <div>
              <p className="font-semibold text-emerald-100">Terverifikasi</p>
              <p className="text-xs text-emerald-100/70">Tanda tangan issuer valid · belum dicabut</p>
            </div>
          </div>

          <dl className="mt-5 space-y-2 font-mono text-[11px]">
            <div className="flex justify-between gap-4">
              <dt className="text-white/40">credentialHash</dt>
              <dd className="truncate text-emerald-200/90">0x7f3a…9c1e</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-white/40">network</dt>
              <dd className="text-white/70">BNB Smart Chain · 97</dd>
            </div>
          </dl>
        </div>

        {/* floating chips */}
        <div className="glass absolute -bottom-5 -left-8 hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-white shadow-xl sm:flex">
          <IconLock className="h-3.5 w-3.5 text-emerald-300" /> 0 data pribadi on-chain
        </div>
        <div className="glass absolute -right-4 -top-4 hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-white shadow-xl sm:flex">
          <IconSparkles className="h-3.5 w-3.5 text-emerald-300" /> SHA-256 cocok
        </div>
      </div>
    </div>
  );
}
