import { Placeholder } from "@/components/Placeholder";

export default function VerifyCredentialPage({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Placeholder title={`Verifikasi kredensial ${params.id}`} wave="W7" />
    </main>
  );
}
