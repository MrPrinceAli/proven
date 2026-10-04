export type EvidenceMime = "application/pdf" | "image/png" | "image/jpeg";

const SIGNATURES: { mime: EvidenceMime; bytes: number[] }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
];

/** Detects the type from magic bytes only; file names and client-sent MIME types are ignored. */
export function detectMime(data: Buffer): EvidenceMime | null {
  for (const { mime, bytes } of SIGNATURES) {
    if (data.length >= bytes.length && bytes.every((b, i) => data[i] === b)) return mime;
  }
  return null;
}

export const EXTENSION: Record<EvidenceMime, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};
