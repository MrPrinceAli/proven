import { Card, StatusBadge, STATUS_STYLES } from "@proven/ui";

const ORDER = [
  "UNVERIFIED",
  "EVIDENCE_ATTACHED",
  "PENDING_ISSUER",
  "VERIFIED",
  "EXPIRED",
  "REVOKED",
] as const;

/** Explains the CLAIM → EVIDENCE → VERIFICATION chain in the right column. */
export function StatusLegend() {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-ink">Dari klaim sampai terbukti</h2>
      <ol className="mt-3 space-y-3">
        {ORDER.map((status) => (
          <li key={status} className="flex flex-col gap-1">
            <StatusBadge status={status} className="self-start" />
            <span className="text-xs text-muted">{STATUS_STYLES[status].description}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
        Status <strong>Terverifikasi</strong> hanya bisa diberikan issuer. AI di Proven-ID hanya membantu.
      </p>
    </Card>
  );
}
