import type { ReactNode } from "react";
import {
  IconAlert,
  IconBan,
  IconCheckBadge,
  IconCircle,
  IconClock,
  IconHourglass,
  IconPaperclip,
} from "./icons";

export type ClaimStatusName =
  | "UNVERIFIED"
  | "EVIDENCE_ATTACHED"
  | "PENDING_ISSUER"
  | "VERIFIED"
  | "EXPIRED"
  | "REVOKED"
  | "CLAIM_WITHOUT_EVIDENCE";

interface StatusStyle {
  label: string;
  description: string;
  className: string;
  icon: (p: { className?: string }) => ReactNode;
}

/** One variant per §S4 status: icon + text, never colour alone (WCAG 1.4.1). */
export const STATUS_STYLES: Record<ClaimStatusName, StatusStyle> = {
  UNVERIFIED: {
    label: "Belum diverifikasi",
    description: "Klaim dibuat tanpa bukti",
    className: "bg-gray-100 text-gray-700 ring-gray-300",
    icon: IconCircle,
  },
  EVIDENCE_ATTACHED: {
    label: "Ada bukti",
    description: "Bukti terlampir, belum divalidasi pihak ketiga",
    className: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    icon: IconPaperclip,
  },
  PENDING_ISSUER: {
    label: "Menunggu issuer",
    description: "Sedang ditinjau issuer",
    className: "bg-blue-50 text-blue-800 ring-blue-200",
    icon: IconHourglass,
  },
  VERIFIED: {
    label: "Terverifikasi",
    description: "Divalidasi dan diterbitkan issuer",
    className: "bg-brand-50 text-brand-800 ring-brand-200",
    icon: IconCheckBadge,
  },
  EXPIRED: {
    label: "Kedaluwarsa",
    description: "Masa berlaku kredensial habis",
    className: "bg-amber-50 text-amber-900 ring-amber-200",
    icon: IconClock,
  },
  REVOKED: {
    label: "Dicabut",
    description: "Kredensial dicabut issuer",
    className: "bg-red-50 text-red-800 ring-red-200",
    icon: IconBan,
  },
  CLAIM_WITHOUT_EVIDENCE: {
    label: "Tanpa bukti",
    description: "Skill detected — evidence not found.",
    className: "bg-orange-50 text-orange-900 ring-orange-200",
    icon: IconAlert,
  },
};

export function statusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status as ClaimStatusName] ?? STATUS_STYLES.UNVERIFIED;
}

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const style = statusStyle(status);
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className} ${className}`}
      title={style.description}
    >
      <Icon className="h-3.5 w-3.5" />
      {style.label}
    </span>
  );
}
