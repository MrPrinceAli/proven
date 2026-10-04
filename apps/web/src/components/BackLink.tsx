"use client";

import { useRouter } from "next/navigation";

/** "← Kembali": browser history when there is one, otherwise a sensible fallback page. */
export function BackLink({ fallback, label = "Kembali" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="self-start text-sm font-medium text-brand-700 hover:underline"
    >
      ← {label}
    </button>
  );
}
