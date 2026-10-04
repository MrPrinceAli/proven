import { PasteVerifier } from "@/components/PasteVerifier";
import { PublicHeader } from "@/components/PublicHeader";

export const metadata = {
  title: "Verifikasi VC",
  description: "Verifikasi file kredensial Proven secara independen langsung dari blockchain.",
};

export default function VerifyPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">Verifikasi file kredensial</h1>
        <p className="text-sm text-muted">
          Tempel atau unggah VC JSON. Hash dihitung ulang di browser dan dicocokkan langsung dengan
          blockchain; satu karakter saja yang diubah akan terdeteksi sebagai <strong>Tidak cocok</strong>.
        </p>
        <PasteVerifier />
      </main>
    </div>
  );
}
