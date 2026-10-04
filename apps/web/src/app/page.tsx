import { Button } from "@proven/ui";
import { site } from "@/lib/site";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">{site.name}</p>
      <h1 className="text-3xl font-bold sm:text-5xl">{site.tagline}</h1>
      <p className="max-w-xl text-gray-600">{site.description}</p>
      <Button disabled title="Login wallet tersedia di gelombang W2">
        Masuk (segera)
      </Button>
    </main>
  );
}
