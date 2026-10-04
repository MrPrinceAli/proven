"use client";

import { buttonClasses } from "@proven/ui";
import Link from "next/link";
import { DemoEntry } from "@/components/DemoEntry";
import { CredentialMock } from "@/components/landing/CredentialMock";
import { Logo } from "@/components/landing/Logo";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Bento, CtaBand, LandingFooter, TrustStrip } from "@/components/landing/Sections";
import { LoginButton } from "@/components/LoginButton";
import { useSession } from "@/lib/session";
import { site } from "@/lib/site";

const NAV_LINK =
  "rounded-full px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white";

export default function HomePage() {
  const { data: me } = useSession();
  return (
    <div className="min-h-screen">
      <div className="relative isolate overflow-hidden bg-brand-950 text-white">
        {/* backdrop: hairline grid + aurora glows */}
        <div aria-hidden className="bg-grid mask-fade absolute inset-0 -z-10" />
        <div
          aria-hidden
          className="absolute -top-48 left-1/2 -z-10 h-[32rem] w-[min(64rem,100vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(16_185_129/0.35),transparent)]"
        />
        <div
          aria-hidden
          className="absolute -right-40 bottom-0 -z-10 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,rgb(45_212_191/0.18),transparent)]"
        />

        <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo tone="dark" />
          <nav aria-label="Utama" className="flex items-center gap-1">
            <a href="#cara-kerja" className={`${NAV_LINK} hidden sm:inline-flex`}>
              Cara kerja
            </a>
            <Link href={`/p/${site.showcaseSlug}`} className={`${NAV_LINK} hidden sm:inline-flex`}>
              Contoh profil
            </Link>
            <Link href="/verify" className={NAV_LINK}>
              Verifikasi kredensial
            </Link>
          </nav>
        </header>

        <main className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pb-20 lg:pt-8">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Identitas profesional terverifikasi · live di BNB Chain
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl xl:text-[3.25rem]">
              <span className="sr-only">{site.tagline}</span>
              <span aria-hidden>
                <span className="whitespace-nowrap">Anyone can claim</span>{" "}
                <span className="whitespace-nowrap">a skill.</span>
                <br />
                <span className="text-white/60">Proven-ID lets you </span>
                <em className="whitespace-nowrap pr-1 font-display text-[1.12em] font-normal text-shine">
                  prove it.
                </em>
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-[1.05rem]">
              Ubah klaim profesional menjadi kredensial yang ditandatangani issuer dan dicatat di blockchain —
              bisa dicek siapa saja, kapan saja.
            </p>

            <div className="mt-7 flex flex-wrap items-start gap-3">
              {me ? (
                <Link href="/dashboard" className={buttonClasses("inverse", "h-11 px-6")}>
                  Buka dashboard
                </Link>
              ) : (
                <LoginButton tone="dark" />
              )}
              <Link
                href={`/p/${site.showcaseSlug}`}
                className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Lihat contoh profil <span aria-hidden>→</span>
              </Link>
            </div>

            {!me && (
              <div className="mt-6">
                <DemoEntry tone="dark" />
              </div>
            )}
            {!me && (
              <p className="mt-4 text-xs text-white/40">
                Login wallet memakai Sign-In with Ethereum: gratis, tanpa transaksi.
              </p>
            )}
          </div>

          <CredentialMock />
        </main>
      </div>

      <TrustStrip />
      <HowItWorks />
      <Bento />
      <CtaBand>
        <Link href={`/p/${site.showcaseSlug}`} className={buttonClasses("inverse", "h-11 px-6")}>
          Jelajahi contoh profil
        </Link>
        <Link
          href="/verify"
          className="inline-flex h-11 items-center rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Verifikasi kredensial
        </Link>
      </CtaBand>
      <LandingFooter />
    </div>
  );
}
