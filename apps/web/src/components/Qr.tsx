"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** QR code as an image; `alt` names where it leads (WCAG 1.1.1). Relative paths use the current origin. */
export function Qr({ value, label, size = 128 }: { value: string; label: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = value.startsWith("/") ? `${window.location.origin}${value}` : value;
    QRCode.toDataURL(url, { width: size * 2, margin: 1, color: { dark: "#064E3B", light: "#FFFFFF" } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [value, size]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size}
      height={size}
      alt={`Kode QR menuju ${label}`}
      className="rounded-md border border-line"
    />
  ) : (
    <span
      className="inline-block animate-pulse rounded-md bg-gray-100"
      style={{ width: size, height: size }}
    />
  );
}
