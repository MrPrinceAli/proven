"use client";

import {
  EmptyState,
  IconAward,
  IconBriefcase,
  IconCheckBadge,
  IconCode,
  IconPaperclip,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUsers,
  SectionCard,
  StatusBadge,
  useToast,
} from "@proven/ui";
import { useState, type ComponentType } from "react";
import { ApiError } from "@/lib/api";
import { isEditable, type ClaimPath, type KindDef } from "@/lib/claims";
import { useDeleteClaim } from "@/lib/queries";
import { ClaimFormDialog } from "./ClaimFormDialog";

export const KIND_ICONS: Record<ClaimPath, ComponentType<{ className?: string }>> = {
  experiences: IconBriefcase,
  projects: IconCode,
  achievements: IconAward,
  skills: IconCheckBadge,
  community: IconUsers,
};

type Item = Record<string, unknown> & { id: string; status: string };

/** One profile section. Pass `editable` for the owner's view; public profiles are read-only. */
export function ClaimSection({
  kind,
  items,
  editable = false,
}: {
  kind: KindDef;
  items: Item[];
  editable?: boolean;
}) {
  const Icon = KIND_ICONS[kind.path];
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const remove = useDeleteClaim(kind.path);
  const toast = useToast();

  if (!editable && items.length === 0) return null;

  async function onDelete(item: Item) {
    if (!window.confirm(`Hapus ${kind.singular} "${kind.primary(item)}"?`)) return;
    try {
      await remove.mutateAsync(item.id);
      toast(`${kind.title}: item dihapus`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Gagal menghapus", "error");
    }
  }

  return (
    <SectionCard
      title={kind.title}
      icon={<Icon className="h-5 w-5" />}
      action={
        editable && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            aria-label={`Tambah ${kind.singular}`}
            className="rounded-full p-2 text-muted hover:bg-gray-100 hover:text-ink"
          >
            <IconPlus className="h-5 w-5" />
          </button>
        )
      }
    >
      {items.length === 0 ? (
        <EmptyState title={`Belum ada ${kind.singular}`} description={kind.empty} />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const secondary = kind.secondary(item);
            const evidenceCount = Array.isArray(item.evidenceIds)
              ? item.evidenceIds.length
              : Number(item.evidenceCount ?? 0);
            const locked = !isEditable(item.status);
            return (
              <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{kind.primary(item)}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  {secondary && <p className="break-words text-sm text-muted">{secondary}</p>}
                  {typeof item.description === "string" && item.description && (
                    <p className="mt-1 whitespace-pre-line text-sm text-ink">{item.description}</p>
                  )}
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <IconPaperclip className="h-3.5 w-3.5" />
                    {evidenceCount > 0 ? `${evidenceCount} bukti terlampir` : "Belum ada bukti"}
                  </p>
                </div>
                {editable && (
                  <div className="flex shrink-0 items-start gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      disabled={locked}
                      title={locked ? "Klaim ini terkunci karena sedang/selesai diverifikasi" : undefined}
                      aria-label={`Ubah ${kind.primary(item)}`}
                      className="rounded-full p-2 text-muted hover:bg-gray-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <IconPencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      disabled={item.status === "PENDING_ISSUER"}
                      aria-label={`Hapus ${kind.primary(item)}`}
                      className="rounded-full p-2 text-muted hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editable && editing && (
        <ClaimFormDialog
          kind={kind}
          claim={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </SectionCard>
  );
}
