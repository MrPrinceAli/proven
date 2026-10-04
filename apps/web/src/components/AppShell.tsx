"use client";

import {
  Avatar,
  IconAward,
  IconFile,
  IconHome,
  IconLogout,
  IconSearch,
  IconShield,
  IconSparkles,
  IconUser,
} from "@proven/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useLogout, useSession } from "@/lib/session";
import { DemoBanner } from "./DemoBanner";
import { avatarLabel } from "./identity";
import { ProfileMiniCard } from "./ProfileMiniCard";
import { StatusLegend } from "./StatusLegend";

const NAV = [
  { href: "/dashboard", label: "Beranda", icon: IconHome },
  { href: "/dashboard/profile", label: "Profil", icon: IconUser },
  { href: "/dashboard/evidence", label: "Evidence", icon: IconFile },
  { href: "/dashboard/credentials", label: "Kredensial", icon: IconAward },
  { href: "/dashboard/ai", label: "AI", icon: IconSparkles },
];

/** Professional-network layout (D-012): sticky top nav, 3 columns on desktop, bottom nav on mobile. */
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useSession();
  const logout = useLogout();
  const nav = me?.roles.includes("issuer")
    ? [...NAV, { href: "/issuer", label: "Issuer", icon: IconShield }]
    : NAV;
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Lewati ke konten
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="Proven — Beranda">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-brand-700 text-white shadow-sm ring-1 ring-black/5">
              <IconShield className="h-5 w-5" />
            </span>
            <span className="hidden text-lg font-bold tracking-tight text-brand-950 sm:inline">Proven</span>
          </Link>
          <label className="relative hidden max-w-xs flex-1 md:block">
            <span className="sr-only">Cari profil</span>
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              disabled
              placeholder="Cari profil (segera hadir)"
              className="w-full rounded-md bg-[#EEF3F8] py-1.5 pl-9 pr-3 text-sm placeholder:text-gray-500"
            />
          </label>
          <nav aria-label="Navigasi utama" className="ml-auto hidden md:flex">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`flex w-20 flex-col items-center gap-0.5 border-b-2 py-1.5 text-xs ${
                  isActive(href)
                    ? "border-ink font-medium text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-2">
            {me?.wallet && (
              <Avatar
                seed={me.profile?.slug ?? me.wallet.address}
                label={avatarLabel(me.profile?.slug, me.wallet.did)}
                size={32}
              />
            )}
            <button
              type="button"
              onClick={() => logout.mutate(undefined, { onSettled: () => router.push("/") })}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted hover:bg-gray-100 hover:text-ink"
            >
              <IconLogout className="h-4 w-4" />
              Keluar
            </button>
          </div>
        </div>
      </header>
      <DemoBanner />

      <div
        className={`mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 ${
          wide ? "" : "md:grid-cols-[225px,minmax(0,1fr)] lg:grid-cols-[225px,minmax(0,1fr),300px]"
        }`}
      >
        {!wide && (
          <aside className="hidden md:block" aria-label="Profil singkat">
            <ProfileMiniCard />
          </aside>
        )}
        <main id="main" className="min-w-0">
          {children}
        </main>
        {!wide && (
          <aside className="hidden lg:block" aria-label="Keterangan status">
            <StatusLegend />
          </aside>
        )}
      </div>

      <nav
        aria-label="Navigasi bawah"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white md:hidden"
      >
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
              isActive(href) ? "font-medium text-brand-800" : "text-muted"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
