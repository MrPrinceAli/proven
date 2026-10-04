import { Placeholder } from "@/components/Placeholder";

export default function PublicProfilePage({ params }: { params: { slug: string } }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Placeholder title={`Profil publik: ${params.slug}`} wave="W3" />
    </main>
  );
}
