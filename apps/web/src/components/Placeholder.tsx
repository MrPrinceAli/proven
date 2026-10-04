import type { ReactNode } from "react";

/** Temporary page body until the wave that implements the page. */
export function Placeholder({
  title,
  wave,
  children,
}: {
  title: string;
  wave: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">Segera hadir di gelombang {wave}.</p>
      {children}
    </section>
  );
}
