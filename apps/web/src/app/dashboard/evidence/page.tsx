"use client";

import { EmptyState, IconFile } from "@proven/ui";
import { EvidenceCard } from "@/components/EvidenceCard";
import { EvidenceUploader } from "@/components/EvidenceUploader";
import { useClaims, useEvidence } from "@/lib/queries";

export default function EvidencePage() {
  const { data: evidence, isLoading, isError } = useEvidence();
  const { data: claims } = useClaims();

  return (
    <div className="flex flex-col gap-4">
      <EvidenceUploader />
      <h2 className="mt-2 text-lg font-semibold">Bukti kamu</h2>
      {isLoading && <p className="text-sm text-muted">Memuat…</p>}
      {isError && <p className="text-sm text-red-700">Gagal memuat bukti.</p>}
      {evidence?.length === 0 && (
        <EmptyState
          icon={<IconFile />}
          title="Belum ada bukti"
          description="Unggah sertifikat, piagam, atau dokumen lain. Hash SHA-256 dicatat sebagai sidik jari file."
        />
      )}
      {evidence?.map((e) => (
        <EvidenceCard key={e.id} evidence={e} claims={claims} />
      ))}
    </div>
  );
}
