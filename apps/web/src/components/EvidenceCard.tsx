"use client";

import {
  Badge,
  Button,
  Card,
  IconCopy,
  IconDownload,
  IconFile,
  IconLink,
  IconTrash,
  IconX,
  StatusBadge,
  useToast,
} from "@proven/ui";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { EVIDENCE_TYPES, KIND_BY_TYPE, KINDS, formatBytes, type Claim, type EntityType } from "@/lib/claims";
import { publicEnv } from "@/lib/env";
import {
  useDeleteEvidence,
  useLinkEvidence,
  useUpdateEvidence,
  type ClaimsResponse,
  type Evidence,
} from "@/lib/queries";

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });

export function EvidenceCard({
  evidence,
  claims,
}: {
  evidence: Evidence;
  claims: ClaimsResponse | undefined;
}) {
  const toast = useToast();
  const update = useUpdateEvidence();
  const remove = useDeleteEvidence();
  const link = useLinkEvidence();
  const [target, setTarget] = useState("");

  const allClaims: (Claim & { label: string })[] = claims
    ? KINDS.flatMap((k) =>
        (claims.claims[k.path] ?? []).map((c) => ({ ...c, label: `${k.title}: ${k.primary(c)}` })),
      )
    : [];
  const byId = new Map(allClaims.map((c) => [c.id, c]));
  const linkable = allClaims.filter((c) => !evidence.links.some((l) => l.entityId === c.id));

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Gagal", "error");
    }
  };

  async function copyHash() {
    await navigator.clipboard.writeText(evidence.sha256);
    toast("SHA-256 disalin");
  }

  function onLink() {
    const claim = byId.get(target);
    if (!claim) return;
    void run(
      () => link.mutateAsync({ id: evidence.id, entityType: claim.entityType, entityId: claim.id }),
      "Bukti ditautkan ke klaim",
    ).then(() => setTarget(""));
  }

  function onUnlink(entityType: EntityType, entityId: string) {
    void run(
      () => link.mutateAsync({ id: evidence.id, entityType, entityId, unlink: true }),
      "Tautan dilepas",
    );
  }

  function onDelete() {
    if (
      !window.confirm(
        `Hapus bukti "${evidence.title ?? evidence.filename}"? Klaim yang memakai bukti ini akan diperbarui.`,
      )
    )
      return;
    void run(() => remove.mutateAsync(evidence.id), "Bukti dihapus");
  }

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <IconFile className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium text-ink">
            {evidence.title || evidence.filename || "Tanpa judul"}
          </p>
          <p className="text-xs text-muted">
            {evidence.filename} · {formatBytes(evidence.sizeBytes)} ·{" "}
            {dateFormat.format(new Date(evidence.capturedAt))}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <a
            href={`${publicEnv.apiUrl}/me/evidence/${evidence.id}/download`}
            aria-label="Unduh bukti"
            className="rounded-full p-2 text-muted hover:bg-gray-100 hover:text-ink"
          >
            <IconDownload className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Hapus bukti"
            className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-700"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
        <span className="text-xs font-semibold text-muted">SHA-256</span>
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink" title={evidence.sha256}>
          {evidence.sha256}
        </code>
        <button
          type="button"
          onClick={copyHash}
          aria-label="Salin SHA-256"
          className="rounded p-1 text-muted hover:bg-gray-200 hover:text-ink"
        >
          <IconCopy className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted">
          Jenis
          <select
            value={evidence.type}
            onChange={(e) =>
              void run(
                () => update.mutateAsync({ id: evidence.id, patch: { type: e.target.value } }),
                "Jenis bukti diperbarui",
              )
            }
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-ink"
          >
            {EVIDENCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-2 text-xs font-semibold text-muted">Ditautkan ke</p>
        {evidence.links.length === 0 ? (
          <p className="text-xs text-muted">Belum ditautkan ke klaim mana pun.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {evidence.links.map((l) => {
              const claim = byId.get(l.entityId);
              return (
                <li key={l.entityId}>
                  <Badge className="gap-2 bg-brand-50 text-brand-900">
                    {claim ? claim.label : KIND_BY_TYPE[l.entityType].title}
                    {claim && <StatusBadge status={claim.status} />}
                    <button
                      type="button"
                      onClick={() => onUnlink(l.entityType, l.entityId)}
                      aria-label={`Lepas tautan ${claim?.label ?? ""}`}
                      className="rounded-full p-0.5 hover:bg-brand-100"
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        {linkable.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`link-${evidence.id}`}>
              Pilih klaim
            </label>
            <select
              id={`link-${evidence.id}`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Pilih klaim untuk ditautkan…</option>
              {linkable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={onLink} disabled={!target || link.isPending}>
              <IconLink className="h-4 w-4" /> Tautkan
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
