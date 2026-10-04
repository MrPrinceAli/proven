"use client";

import { Button, IconDownload } from "@proven/ui";

export function DownloadJsonButton({ data, filename }: { data: unknown; filename: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button variant="secondary" onClick={download}>
      <IconDownload className="h-4 w-4" /> Unduh VC (JSON)
    </Button>
  );
}
