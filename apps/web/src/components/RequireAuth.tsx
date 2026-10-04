"use client";

import { buttonClasses, EmptyState } from "@proven/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/session";

function Blocked({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/dashboard" className={buttonClasses("primary")}>
              Ke dashboard
            </Link>
            <Link href="/" className={buttonClasses("secondary")}>
              Halaman utama
            </Link>
          </div>
        }
      />
    </main>
  );
}

/** Client-side route guard: the API enforces auth; this only redirects logged-out visitors. */
export function RequireAuth({ role, children }: { role?: "issuer" | "admin"; children: ReactNode }) {
  const router = useRouter();
  const { data: me, isLoading, isError } = useSession();

  useEffect(() => {
    if (!isLoading && me === null) router.replace("/");
  }, [isLoading, me, router]);

  if (isLoading || me === null) {
    return <p className="p-8 text-center text-sm text-gray-500">Memuat sesi…</p>;
  }
  if (isError || !me) {
    return <Blocked title="Gagal memuat sesi" description="Periksa koneksi lalu muat ulang halaman." />;
  }
  if (role && !me.roles.includes(role)) {
    return (
      <Blocked
        title={`Khusus ${role === "issuer" ? "issuer terdaftar" : "admin"}`}
        description="Akunmu belum punya akses ke halaman ini."
      />
    );
  }
  return <>{children}</>;
}
