import { VcHashTool } from "@/components/VcHashTool";

export const metadata = { title: "Verifikasi" };

export default function VerifyPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Verifikasi kredensial</h1>
      <VcHashTool />
    </main>
  );
}
