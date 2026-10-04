"use client";

import { Button, buttonClasses, EmptyState } from "@proven/ui";
import Link from "next/link";

/** Any unexpected error still leaves a way forward. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        title="Terjadi kesalahan"
        description="Halaman ini gagal dimuat. Coba lagi, atau kembali ke halaman lain."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>Coba lagi</Button>
            <Link href="/dashboard" className={buttonClasses("secondary")}>
              Ke dashboard
            </Link>
            <Link href="/" className={buttonClasses("ghost")}>
              Halaman utama
            </Link>
          </div>
        }
      />
    </main>
  );
}
