import { IconAlert, IconBan, IconCheckBadge, IconClock, IconCircle } from "@proven/ui";
import { SEALS, type SealState } from "@/lib/verify-types";

const ICONS: Record<SealState, typeof IconCheckBadge> = {
  active: IconCheckBadge,
  revoked: IconBan,
  expired: IconClock,
  tampered: IconAlert,
  not_found: IconCircle,
};

/** The large status "seal" (§W7 4). Icon + text, never colour alone; announced to screen readers. */
export function Seal({ state, compact = false }: { state: SealState; compact?: boolean }) {
  const seal = SEALS[state];
  const Icon = ICONS[state];
  return (
    <div
      role="status"
      aria-label={`Status kredensial: ${seal.label}. ${seal.description}`}
      data-seal={state}
      className={`flex items-center gap-4 rounded-xl border-2 ${compact ? "p-3" : "p-5"} ${seal.className}`}
    >
      <Icon className={compact ? "h-8 w-8 shrink-0" : "h-14 w-14 shrink-0"} />
      <div>
        <p className={`font-bold ${compact ? "text-lg" : "text-3xl"}`}>{seal.label}</p>
        <p className="text-sm">{seal.description}</p>
      </div>
    </div>
  );
}
