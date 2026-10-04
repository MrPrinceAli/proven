import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";

export default function IssuerLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth role="issuer">
      <AppShell wide>{children}</AppShell>
    </RequireAuth>
  );
}
