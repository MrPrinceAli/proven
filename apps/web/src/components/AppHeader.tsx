"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { shortDid } from "@/lib/chains";
import { useLogout, useSession } from "@/lib/session";

const NAV = [
  { href: "/dashboard", label: "Beranda" },
  { href: "/dashboard/profile", label: "Profil" },
  { href: "/dashboard/evidence", label: "Evidence" },
  { href: "/dashboard/credentials", label: "Kredensial" },
  { href: "/dashboard/ai", label: "AI" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useSession();
  const logout = useLogout();
  const nav = me?.roles.includes("issuer") ? [...NAV, { href: "/issuer", label: "Issuer" }] : NAV;

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/dashboard" className="text-lg font-bold text-emerald-700">
          Proven
        </Link>
        <nav aria-label="Navigasi utama" className="flex flex-1 gap-1 overflow-x-auto">
          {nav.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${
                  active
                    ? "font-semibold text-emerald-800 underline underline-offset-8"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {me?.wallet && (
          <span className="hidden font-mono text-xs text-gray-600 md:inline" title={me.wallet.did}>
            {shortDid(me.wallet.did)}
          </span>
        )}
        <button
          type="button"
          onClick={() => logout.mutate(undefined, { onSettled: () => router.push("/") })}
          className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          Keluar
        </button>
      </div>
    </header>
  );
}
