import { IconShield } from "@proven/ui";
import Link from "next/link";

/** Wordmark used on the landing page; `tone` picks the surface it sits on. */
export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Proven — beranda">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-brand-700 text-white shadow-lg shadow-emerald-900/30 ring-1 ring-white/20">
        <IconShield className="h-5 w-5" />
      </span>
      <span
        className={`text-lg font-bold tracking-tight ${tone === "dark" ? "text-white" : "text-brand-950"}`}
      >
        Proven
      </span>
    </Link>
  );
}
