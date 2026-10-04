import { EmptyState } from "@proven/ui";
import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="Halaman tidak ditemukan"
          description="Profil ini tidak ada atau tidak dibagikan secara publik."
          action={
            <Link href="/" className="text-sm font-semibold text-brand-700 hover:underline">
              Kembali ke beranda
            </Link>
          }
        />
      </main>
    </div>
  );
}
