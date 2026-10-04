import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={`rounded-lg border border-line bg-surface shadow-card ${className}`} {...props}>
      {children}
    </section>
  );
}

/** Card with a heading row and an optional action (e.g. an add or edit button). */
export function SectionCard({
  title,
  icon,
  action,
  children,
  className = "",
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          {icon && <span className="text-brand-700">{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line px-4 py-8 text-center">
      {icon && <span className="text-3xl text-brand-700">{icon}</span>}
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

/** Deterministic initials avatar; `seed` (e.g. an address) picks one of several green shades. */
export function Avatar({
  seed,
  label,
  size = 48,
  src,
}: {
  seed: string;
  label: string;
  size?: number;
  /** Image (e.g. an illustrated avatar data URI); initials on a brand shade otherwise. */
  src?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={label}
        width={size}
        height={size}
        className="inline-block shrink-0 rounded-full bg-brand-50 ring-4 ring-white"
        style={{ width: size, height: size }}
      />
    );
  }
  const shades = ["bg-brand-700", "bg-brand-800", "bg-brand-900", "bg-emerald-600", "bg-teal-700"];
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const initials = label.trim().slice(0, 2).toUpperCase() || "?";
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-4 ring-white ${shades[hash % shades.length]}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}
