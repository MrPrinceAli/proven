"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/session";

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
    return <p className="p-8 text-center text-sm text-red-700">Gagal memuat sesi. Muat ulang halaman.</p>;
  }
  if (role && !me.roles.includes(role)) {
    return (
      <p className="p-8 text-center text-sm text-gray-700">
        Halaman ini khusus {role === "issuer" ? "issuer terdaftar" : "admin"}.
      </p>
    );
  }
  return <>{children}</>;
}
