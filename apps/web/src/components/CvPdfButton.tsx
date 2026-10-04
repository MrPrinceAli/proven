"use client";

import { Button, IconDownload, useToast } from "@proven/ui";
import { useState } from "react";
import type { CvModel } from "@/lib/cv-model";

/** Builds the PDF in the browser when clicked (§W7 7). */
export function CvPdfButton({
  build,
  label = "Unduh CV (PDF)",
}: {
  build: () => CvModel | null;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function download() {
    const model = build();
    if (!model) return;
    setBusy(true);
    try {
      const { renderCvPdf } = await import("@/lib/cv-pdf");
      const url = URL.createObjectURL(await renderCvPdf(model));
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `cv-${model.name.replace(/[^a-z0-9-]/gi, "") || "proven"}.pdf`,
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("Gagal membuat PDF", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" onClick={download} disabled={busy}>
      <IconDownload className="h-4 w-4" /> {busy ? "Membuat PDF…" : label}
    </Button>
  );
}
