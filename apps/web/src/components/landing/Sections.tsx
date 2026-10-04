import { IconAlert, IconAward, IconCheckBadge, IconLink, IconLock, IconSparkles } from "@proven/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { publicEnv } from "@/lib/env";
import { site } from "@/lib/site";
import { Logo } from "./Logo";
import { LogoBnbChain, LogoDid, LogoEthereum, LogoHash, LogoOpenBadges, LogoW3C } from "./StandardLogos";

const STANDARDS = [
  { logo: LogoW3C, name: "Verifiable Credentials 2.0", note: "Standar W3C" },
  { logo: LogoBnbChain, name: "BNB Smart Chain", note: "Jaringan anchor" },
  { logo: LogoEthereum, name: "EIP-712", note: "Tanda tangan issuer" },
  { logo: LogoDid, name: "did:ethr", note: "Identitas terdesentralisasi" },
  { logo: LogoHash, name: "SHA-256 · JCS", note: "Integritas data" },
  { logo: LogoOpenBadges, name: "Open Badges 3.0", note: "Format prestasi" },
];

export function TrustStrip() {
  return (
    <section aria-labelledby="standar" className="border-b border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p id="standar" className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Dibangun di atas standar terbuka
        </p>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STANDARDS.map(({ logo: Logo, name, note }) => (
            <li
              key={name}
              className="group flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-3 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas ring-1 ring-black/5 transition group-hover:bg-white">
                <Logo className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                <span className="block truncate text-xs text-muted">{note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">{children}</p>;
}

function Heading({ children, id }: { children: ReactNode; id: string }) {
  return (
    <h2
      id={id}
      className="mt-3 text-2xl font-bold tracking-tight text-brand-950 sm:text-[2rem] sm:leading-tight"
    >
      {children}
    </h2>
  );
}

const CHECKS = [
  "Tanda tangan EIP-712 issuer valid",
  "credentialHash cocok dengan isi kredensial",
  "Tercatat di CredentialRegistry",
  "Issuer terdaftar & kredensial belum dicabut",
];

function Tile({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-line bg-white p-6 transition duration-300 hover:shadow-lift sm:p-7 ${className}`}
    >
      {children}
    </div>
  );
}

export function Bento() {
  return (
    <section aria-labelledby="keunggulan" className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>Kenapa Proven-ID</Eyebrow>
          <Heading id="keunggulan">
            Kepercayaan yang bisa{" "}
            <em className="font-display text-[1.15em] font-normal text-brand-700">dicek</em>, bukan sekadar
            diklaim.
          </Heading>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-6">
          {/* Independent verification */}
          <div className="relative overflow-hidden rounded-3xl bg-brand-950 p-6 text-white sm:p-7 md:col-span-4">
            <div aria-hidden className="bg-grid absolute inset-0 opacity-60 mask-fade" />
            <div
              aria-hidden
              className="absolute -right-24 -top-24 h-72 w-72 bg-[radial-gradient(closest-side,rgb(16_185_129/0.3),transparent)]"
            />
            <div className="relative grid gap-8 sm:grid-cols-2 sm:items-center">
              <div>
                <IconCheckBadge className="h-8 w-8 text-emerald-300" />
                <h3 className="mt-4 text-2xl font-semibold">Verifikasi independen</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Browser pemeriksa membaca blockchain langsung — tanpa harus mempercayai server Proven-ID.
                </p>
                <Link
                  href="/verify"
                  className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                >
                  Coba verifikasi <span aria-hidden>→</span>
                </Link>
              </div>
              <ul className="space-y-2.5">
                {CHECKS.map((c) => (
                  <li key={c} className="glass flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-brand-950">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        aria-hidden
                      >
                        <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Honest AI */}
          <Tile className="md:col-span-2">
            <IconSparkles className="h-7 w-7 text-brand-700" />
            <h3 className="mt-4 text-xl font-semibold text-brand-950">AI yang jujur</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              AI hanya membantu merapikan. Ia tidak mengarang skill dan tidak pernah memberi status
              terverifikasi.
            </p>
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
              <IconAlert className="mt-px h-4 w-4 shrink-0" /> Skill detected — evidence not found.
            </p>
          </Tile>

          {/* No PII on-chain */}
          <Tile className="md:col-span-2">
            <IconLock className="h-7 w-7 text-brand-700" />
            <h3 className="mt-4 text-xl font-semibold text-brand-950">Nol data pribadi on-chain</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Blockchain hanya menyimpan hash dan alamat. Bukti disimpan terenkripsi AES-256-GCM.
            </p>
            <code className="mt-5 block truncate rounded-xl bg-canvas px-3 py-2.5 font-mono text-xs text-brand-800">
              bytes32 0x9b1e…a4c7
            </code>
          </Tile>

          {/* Issuer authority */}
          <Tile className="md:col-span-2">
            <IconAward className="h-7 w-7 text-brand-700" />
            <h3 className="mt-4 text-xl font-semibold text-brand-950">Issuer adalah otoritas</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Status <strong className="font-semibold text-brand-800">Terverifikasi</strong> hanya lahir dari
              kredensial yang diterbitkan issuer terdaftar — kampus, komunitas, atau perusahaan.
            </p>
          </Tile>

          {/* Share */}
          <Tile className="md:col-span-2">
            <IconLink className="h-7 w-7 text-brand-700" />
            <h3 className="mt-4 text-xl font-semibold text-brand-950">Satu tautan, semua bukti</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Profil publik, QR, dan CV PDF terverifikasi yang siap dikirim ke rekruter.
            </p>
            <Link
              href={`/p/${site.showcaseSlug}`}
              className="mt-5 flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5 text-xs text-ink/80 transition hover:bg-brand-50"
            >
              <span className="truncate font-mono">proven-id.vercel.app/p/{site.showcaseSlug}</span>
              <span aria-hidden className="text-brand-700">
                ↗
              </span>
            </Link>
          </Tile>
        </div>
      </div>
    </section>
  );
}

export function CtaBand({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="cta" className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-brand-950 px-6 py-12 text-center text-white sm:px-12 sm:py-14">
        <div aria-hidden className="bg-grid absolute inset-0 mask-fade" />
        <div
          aria-hidden
          className="absolute -bottom-40 left-1/2 h-80 w-[min(48rem,100%)] -translate-x-1/2 bg-[radial-gradient(closest-side,rgb(16_185_129/0.4),transparent)]"
        />
        <div className="relative">
          <h2 id="cta" className="text-2xl font-bold tracking-tight sm:text-4xl">
            Berhenti mengklaim. <em className="font-display font-normal text-shine">Mulai membuktikan.</em>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Gratis untuk dicoba. Tidak perlu wallet untuk menjelajahi mode demo.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

const registry = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? "";

export function LandingFooter() {
  const contractUrl =
    registry && publicEnv.explorerUrl
      ? `${publicEnv.explorerUrl.replace(/\/$/, "")}/address/${registry}`
      : null;
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-muted">Indonesia Web3 Hackathon · BNB Smart Chain Testnet</p>
        </div>
        <nav
          aria-label="Tautan kaki"
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink/70"
        >
          <Link href={`/p/${site.showcaseSlug}`} className="hover:text-brand-700">
            Contoh profil
          </Link>
          <Link href="/verify" className="hover:text-brand-700">
            Verifikasi
          </Link>
          {contractUrl && (
            <a href={contractUrl} target="_blank" rel="noreferrer" className="hover:text-brand-700">
              Kontrak di BscScan
            </a>
          )}
          <a
            href="https://github.com/MrPrinceAli/proven"
            target="_blank"
            rel="noreferrer"
            className="hover:text-brand-700"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
