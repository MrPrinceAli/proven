import { IconShield } from "@proven/ui";
import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Proven-ID — beranda">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-brand-700 text-white shadow-sm ring-1 ring-black/5">
            <IconShield className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-brand-950">Proven-ID</span>
        </Link>
        <Link href="/verify" className="text-sm font-medium text-brand-700 hover:underline">
          Verifikasi VC
        </Link>
      </div>
    </header>
  );
}
