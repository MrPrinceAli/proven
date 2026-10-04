import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/RequireAuth";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <RequireAuth>{children}</RequireAuth>
      </main>
    </>
  );
}
