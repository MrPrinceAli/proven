import { BrandMark } from "../BrandMark";
import Link from "next/link";

/** Wordmark used on the landing page; `tone` picks the surface it sits on. */
export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Proven-ID — beranda">
      <BrandMark size={36} />
      <span
        className={`text-lg font-bold tracking-[-0.03em] ${tone === "dark" ? "text-white" : "text-brand-950"}`}
      >
        Proven-ID
      </span>
    </Link>
  );
}
