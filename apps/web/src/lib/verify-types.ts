export interface VerifyResult {
  credentialId: string;
  issuer: string;
  issuerDid: string;
  subject: string;
  anchor: { txHash: string; block: number | null; contract: string; chainId: number } | null;
  status: "active" | "revoked" | "expired";
  revoked: boolean;
  expired: boolean;
  chainChecked: boolean;
  /** Issued to a demo-mode sandbox (D-035): example content, not a real achievement. */
  sandbox?: boolean;
  checkedAt: string;
  vc: unknown;
}

export type SealState = "active" | "revoked" | "expired" | "tampered" | "not_found";

export const SEALS: Record<SealState, { label: string; description: string; className: string }> = {
  active: {
    label: "Aktif",
    description: "Kredensial asli, tercatat di blockchain, dan belum dicabut.",
    className: "border-brand-700 bg-brand-50 text-brand-900",
  },
  revoked: {
    label: "Dicabut",
    description: "Issuer telah mencabut kredensial ini di blockchain.",
    className: "border-red-700 bg-red-50 text-red-900",
  },
  expired: {
    label: "Kedaluwarsa",
    description: "Masa berlaku kredensial sudah habis.",
    className: "border-amber-600 bg-amber-50 text-amber-900",
  },
  tampered: {
    label: "Tidak cocok",
    description: "Isi kredensial tidak sesuai dengan yang tercatat di blockchain — kemungkinan diubah.",
    className: "border-red-700 bg-red-50 text-red-900",
  },
  not_found: {
    label: "Tidak ditemukan",
    description: "Kredensial ini tidak tercatat di blockchain Proven-ID.",
    className: "border-gray-400 bg-gray-50 text-gray-800",
  },
};

/** verifyVC overall → seal state. */
export const sealFromOverall = (overall: string): SealState =>
  overall === "valid" ? "active" : overall === "not_anchored" ? "not_found" : (overall as SealState);
