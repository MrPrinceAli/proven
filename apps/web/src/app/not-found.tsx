import { buttonClasses, EmptyState } from "@proven/ui";
import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="Halaman tidak ditemukan"
          description="Tautan ini salah, sudah dipindahkan, atau profilnya tidak dibagikan secara publik."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/" className={buttonClasses("primary")}>
                Halaman utama
              </Link>
              <Link href="/verify" className={buttonClasses("secondary")}>
                Verifikasi kredensial
              </Link>
            </div>
          }
        />
      </main>
    </div>
  );
}
