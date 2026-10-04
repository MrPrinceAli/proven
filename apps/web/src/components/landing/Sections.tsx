import {
  IconAlert,
  IconAward,
  IconCheckBadge,
  IconFile,
  IconGlobe,
  IconLink,
  IconLock,
  IconShield,
  IconSparkles,
} from "@proven/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { publicEnv } from "@/lib/env";
import { Logo } from "./Logo";

const STANDARDS = [
  "W3C Verifiable Credentials 2.0",
  "EIP-712",
  "BNB Smart Chain",
  "did:ethr",
  "SHA-256 · JCS",
  "Open Badges 3.0",
];

export function TrustStrip() {
  return (
    <section aria-label="Standar terbuka" className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:justify-between">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Dibangun di atas standar terbuka
        </p>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 lg:justify-end">
          {STANDARDS.map((s) => (
            <li key={s} className="flex items-center gap-2 text-sm font-medium text-ink/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              {s}
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
    <h2 id={id} className="mt-3 text-3xl font-bold tracking-tight text-brand-950 sm:text-4xl">
      {children}
    </h2>
  );
}

const STEPS = [
  {
    n: "01",
    icon: IconFile,
    title: "Create",
    text: "Tulis klaim profesionalmu — prestasi, pengalaman, keahlian — lalu lampirkan bukti. File dienkripsi dan sidik jarinya (SHA-256) dicatat.",
  },
  {
    n: "02",
    icon: IconShield,
    title: "Prove",
    text: "Issuer yang terdaftar memeriksa bukti dan menerbitkan kredensial W3C. Hash-nya dicatat di BNB Smart Chain — tanpa data pribadi.",
  },
  {
    n: "03",
    icon: IconGlobe,
    title: "Share",
    text: "Bagikan profil, QR, atau CV PDF. Siapa pun bisa memverifikasi langsung dari blockchain, bahkan tanpa server Proven.",
  },
];

export function Steps() {
  return (
    <section aria-labelledby="cara-kerja" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="max-w-2xl">
        <Eyebrow>Cara kerja</Eyebrow>
        <Heading id="cara-kerja">
          Dari klaim ke <em className="font-display text-[1.15em] font-normal text-brand-700">bukti</em>,
          dalam tiga langkah.
        </Heading>
      </div>
      <ol className="relative mt-12 grid gap-5 md:grid-cols-3">
        {/* connector line */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent md:block"
        />
        {STEPS.map(({ n, icon: Icon, title, text }) => (
          <li
            key={title}
            className="gradient-border group relative rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition group-hover:bg-brand-700 group-hover:text-white">
                <Icon className="h-6 w-6" />
              </span>
              <span className="font-display text-4xl text-brand-200">{n}</span>
            </div>
            <h3 className="mt-6 text-xl font-semibold text-brand-950">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
          </li>
        ))}
      </ol>
    </section>
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
      className={`relative overflow-hidden rounded-3xl border border-line bg-white p-6 transition duration-300 hover:shadow-lift sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}

export function Bento() {
  return (
    <section aria-labelledby="keunggulan" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>Kenapa Proven</Eyebrow>
          <Heading id="keunggulan">
            Kepercayaan yang bisa{" "}
            <em className="font-display text-[1.15em] font-normal text-brand-700">dicek</em>, bukan sekadar
            diklaim.
          </Heading>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-6">
          {/* Independent verification */}
          <div className="relative overflow-hidden rounded-3xl bg-brand-950 p-6 text-white sm:p-8 md:col-span-4">
            <div aria-hidden className="bg-grid absolute inset-0 opacity-60 mask-fade" />
            <div
              aria-hidden
              className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/25 blur-3xl"
            />
            <div className="relative grid gap-8 sm:grid-cols-2 sm:items-center">
              <div>
                <IconCheckBadge className="h-8 w-8 text-emerald-300" />
                <h3 className="mt-4 text-2xl font-semibold">Verifikasi independen</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  Browser pemeriksa membaca blockchain langsung — tanpa harus mempercayai server Proven.
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
              href="/p/rina-demo"
              className="mt-5 flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5 text-xs text-ink/80 transition hover:bg-brand-50"
            >
              <span className="truncate font-mono">proven-id.vercel.app/p/rina-demo</span>
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
    <section aria-labelledby="cta" className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-brand-950 px-6 py-16 text-center text-white sm:px-12">
        <div aria-hidden className="bg-grid absolute inset-0 mask-fade" />
        <div
          aria-hidden
          className="absolute -bottom-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/30 blur-3xl"
        />
        <div className="relative">
          <h2 id="cta" className="text-3xl font-bold tracking-tight sm:text-5xl">
            Berhenti mengklaim. <em className="font-display font-normal text-shine">Mulai membuktikan.</em>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Gratis untuk dicoba. Tidak perlu wallet untuk menjelajahi mode demo.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>
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
          <p className="mt-2 text-sm text-muted">Indonesia Web3 Hackathon Bali · BNB Smart Chain Testnet</p>
        </div>
        <nav
          aria-label="Tautan kaki"
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink/70"
        >
          <Link href="/p/rina-demo" className="hover:text-brand-700">
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
