"use client";

import { Card, IconAward, IconFile, IconGlobe, IconShield, IconSparkles, buttonClasses } from "@proven/ui";
import Link from "next/link";
import { LoginButton } from "@/components/LoginButton";
import { useSession } from "@/lib/session";
import { site } from "@/lib/site";

const STEPS = [
  {
    icon: IconFile,
    title: "Create",
    text: "Tulis klaim profesionalmu — prestasi, pengalaman, keahlian — lalu lampirkan bukti. File dienkripsi dan sidik jarinya (SHA-256) dicatat.",
  },
  {
    icon: IconShield,
    title: "Prove",
    text: "Issuer yang terdaftar memeriksa bukti dan menerbitkan kredensial W3C. Hash-nya dicatat di BNB Smart Chain — tanpa data pribadi.",
  },
  {
    icon: IconGlobe,
    title: "Share",
    text: "Bagikan profil, QR, atau CV PDF. Siapa pun bisa memverifikasi langsung dari blockchain, bahkan tanpa server Proven.",
  },
];

export default function HomePage() {
  const { data: me } = useSession();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-white">
            <IconShield className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold text-brand-800">{site.name}</span>
        </span>
        <Link href="/verify" className="text-sm font-medium text-brand-700 hover:underline">
          Verifikasi kredensial
        </Link>
      </header>

      <main>
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pb-12 pt-10 text-center sm:pt-16">
          <p className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-800">
            Identitas profesional terverifikasi
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">{site.tagline}</h1>
          <p className="max-w-xl text-lg text-muted">{site.description}</p>
          {me ? (
            <Link href="/dashboard" className={buttonClasses("primary", "px-6 py-3 text-base")}>
              Buka dashboard
            </Link>
          ) : (
            <LoginButton />
          )}
          <p className="text-xs text-muted">
            Masuk dengan tanda tangan wallet (Sign-In with Ethereum) di BNB Smart Chain Testnet — gratis,
            tanpa transaksi.
          </p>
        </section>

        <section aria-labelledby="how" className="bg-white py-12">
          <div className="mx-auto max-w-5xl px-4">
            <h2 id="how" className="text-center text-2xl font-semibold">
              Create → Prove → Share
            </h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title}>
                  <Card className="h-full p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-3 text-lg font-semibold">
                      {i + 1}. {title}
                    </h3>
                    <p className="mt-1 text-sm text-muted">{text}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-4 py-12 md:grid-cols-2">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <IconSparkles className="h-5 w-5 text-brand-700" /> AI yang jujur
            </h2>
            <p className="mt-2 text-sm text-muted">
              Asisten AI menyusun ringkasan, CV, dan mencocokkan lowongan hanya dari data dan buktimu. Skill
              tanpa bukti ditandai “Skill detected — evidence not found.”, tidak pernah ditambahkan. Status
              Terverifikasi hanya dari issuer.
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <IconAward className="h-5 w-5 text-brand-700" /> Tanpa data pribadi on-chain
            </h2>
            <p className="mt-2 text-sm text-muted">
              Blockchain hanya menyimpan hash kredensial, alamat issuer, waktu, dan status pencabutan. Nama,
              isi CV, dan file bukti tetap di luar chain dan terenkripsi.
            </p>
          </Card>
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        Proven · Indonesia Web3 Hackathon Bali · BNB Smart Chain Testnet
      </footer>
    </div>
  );
}
