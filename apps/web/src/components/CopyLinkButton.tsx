"use client";

import { Button, IconLink, useToast } from "@proven/ui";

export function CopyLinkButton({ path, label = "Salin tautan" }: { path: string; label?: string }) {
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      onClick={() =>
        void navigator.clipboard
          .writeText(`${window.location.origin}${path}`)
          .then(() => toast("Tautan disalin"))
          .catch(() => toast("Gagal menyalin tautan", "error"))
      }
    >
      <IconLink className="h-4 w-4" /> {label}
    </Button>
  );
}
