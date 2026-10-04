"use client";

import { Button, Dialog, Select, useToast } from "@proven/ui";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import type { EntityType } from "@/lib/claims";
import { useEvidence, useIssuers, useRequestVerification } from "@/lib/queries";

/** "Minta verifikasi": choose an issuer and the evidence to send (FR-10). */
export function RequestVerificationDialog({
  entityType,
  entityId,
  label,
  linkedEvidenceIds,
  onClose,
}: {
  entityType: EntityType;
  entityId: string;
  label: string;
  linkedEvidenceIds: string[];
  onClose: () => void;
}) {
  const { data: issuers, isLoading } = useIssuers();
  const { data: evidence } = useEvidence();
  const submit = useRequestVerification();
  const toast = useToast();
  const [issuerId, setIssuerId] = useState("");
  const [selected, setSelected] = useState<string[]>(linkedEvidenceIds);
  const [error, setError] = useState<string | null>(null);
  const linked = (evidence ?? []).filter((e) => linkedEvidenceIds.includes(e.id));
  const chosenIssuer = issuerId || issuers?.[0]?.id || "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await submit.mutateAsync({ entityType, entityId, issuerId: chosenIssuer, evidenceIds: selected });
      toast("Permintaan verifikasi dikirim ke issuer");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengirim permintaan");
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Minta verifikasi"
      description={`Issuer akan meninjau "${label}" beserta bukti yang kamu pilih. Status VERIFIED hanya diberikan issuer.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            form="request-form"
            disabled={submit.isPending || !chosenIssuer || selected.length === 0}
          >
            {submit.isPending ? "Mengirim…" : "Kirim permintaan"}
          </Button>
        </>
      }
    >
      <form id="request-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        {isLoading ? (
          <p className="text-sm text-muted">Memuat issuer…</p>
        ) : issuers && issuers.length > 0 ? (
          <Select
            label="Issuer"
            value={chosenIssuer}
            onChange={(e) => setIssuerId(e.target.value)}
            options={issuers.map((i) => ({ value: i.id, label: i.name }))}
          />
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Belum ada issuer terverifikasi.
          </p>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Bukti yang dikirim</legend>
          {linked.length === 0 && (
            <p className="text-sm text-muted">Tautkan bukti ke klaim ini terlebih dahulu.</p>
          )}
          {linked.map((e) => (
            <label key={e.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-brand-700"
                checked={selected.includes(e.id)}
                onChange={(ev) =>
                  setSelected((s) => (ev.target.checked ? [...s, e.id] : s.filter((x) => x !== e.id)))
                }
              />
              <span>
                <span className="font-medium">{e.title || e.filename}</span>
                <span className="block font-mono text-xs text-muted">SHA-256 {e.sha256.slice(0, 16)}…</span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
