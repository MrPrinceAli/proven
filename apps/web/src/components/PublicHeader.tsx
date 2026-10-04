"use client";

import { buttonClasses, IconShield } from "@proven/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";
import { useSession } from "@/lib/session";

const LINK = "rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-gray-100 hover:text-ink";
const ACTIVE = "rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800";

/** Header for public pages (profiles, verification). Knows the session so visitors can always go on. */
export function PublicHeader() {
  const pathname = usePathname();
  const { data: me } = useSession();
  const showcase = `/p/${site.showcaseSlug}`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <Link href="/" className="mr-auto flex items-center gap-2" aria-label="Proven-ID — beranda">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-brand-700 text-white shadow-sm ring-1 ring-black/5">
            <IconShield className="h-5 w-5" />
          </span>
          <span className="hidden text-lg font-bold tracking-tight text-brand-950 sm:inline">Proven-ID</span>
        </Link>
        <nav aria-label="Navigasi publik" className="flex items-center gap-1">
          <Link
            href={showcase}
            aria-current={pathname === showcase ? "page" : undefined}
            className={`${pathname === showcase ? ACTIVE : LINK} hidden sm:inline-flex`}
          >
            Contoh profil
          </Link>
          <Link
            href="/verify"
            aria-current={pathname.startsWith("/verify") ? "page" : undefined}
            className={pathname.startsWith("/verify") ? ACTIVE : LINK}
          >
            Verifikasi
          </Link>
          {me ? (
            <Link href="/dashboard" className={buttonClasses("primary", "ml-1")}>
              Dashboard
            </Link>
          ) : (
            <Link href="/#mulai" className={buttonClasses("primary", "ml-1")}>
              Masuk
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
