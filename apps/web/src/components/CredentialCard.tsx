"use client";

import { Card, IconAward, IconCopy, IconLink, StatusBadge, useToast } from "@proven/ui";
import type { ReactNode } from "react";
import { credentialBadge, shortHash, txUrl } from "@/lib/explorer";
import type { CredentialView } from "@/lib/queries";

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });

export function CredentialCard({ credential, actions }: { credential: CredentialView; actions?: ReactNode }) {
  const toast = useToast();
  const explorer = txUrl(credential.anchor?.txHash);

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <IconAward className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink">{credential.name ?? "Kredensial"}</p>
            <StatusBadge status={credentialBadge(credential.status)} />
          </div>
          <p className="text-sm text-muted">
            Diterbitkan {credential.issuer.name} · {dateFormat.format(new Date(credential.issuedAt))}
            {credential.expiresAt && ` · berlaku s.d. ${dateFormat.format(new Date(credential.expiresAt))}`}
          </p>
          {credential.revoked && credential.revocationReason && (
            <p className="mt-1 text-sm text-red-800">Dicabut: {credential.revocationReason}</p>
          )}
        </div>
        {actions}
      </div>
      <dl className="mt-3 grid gap-x-3 gap-y-1 rounded-md bg-gray-50 px-3 py-2 text-xs sm:grid-cols-[auto,1fr]">
        <dt className="font-semibold text-muted">ID</dt>
        <dd className="break-all font-mono">{credential.credentialId}</dd>
        <dt className="font-semibold text-muted">Hash VC</dt>
        <dd className="flex items-center gap-1 font-mono">
          {shortHash(credential.vcHash)}
          <button
            type="button"
            aria-label="Salin hash VC"
            onClick={() =>
              void navigator.clipboard.writeText(credential.vcHash).then(() => toast("Hash disalin"))
            }
            className="rounded p-0.5 text-muted hover:bg-gray-200"
          >
            <IconCopy className="h-3.5 w-3.5" />
          </button>
        </dd>
        {credential.anchor && (
          <>
            <dt className="font-semibold text-muted">Anchor</dt>
            <dd className="font-mono">
              {explorer ? (
                <a
                  href={explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 hover:underline"
                >
                  {shortHash(credential.anchor.txHash)} ↗
                </a>
              ) : (
                shortHash(credential.anchor.txHash)
              )}
              {credential.anchor.block !== null && ` · blok ${credential.anchor.block}`}
            </dd>
          </>
        )}
      </dl>
      <a
        href={`/verify/${encodeURIComponent(credential.credentialId)}`}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
      >
        <IconLink className="h-4 w-4" /> Halaman verifikasi publik
      </a>
    </Card>
  );
}
