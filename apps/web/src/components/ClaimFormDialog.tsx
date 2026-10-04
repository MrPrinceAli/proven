"use client";

import { Button, Dialog, Input, Select, Textarea, useToast } from "@proven/ui";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { toFormValues, toPayload, type KindDef } from "@/lib/claims";
import { useSaveClaim } from "@/lib/queries";

export function ClaimFormDialog({
  kind,
  claim,
  onClose,
}: {
  kind: KindDef;
  claim?: Record<string, unknown> & { id: string };
  onClose: () => void;
}) {
  const [values, setValues] = useState(() => toFormValues(kind, claim));
  const [error, setError] = useState<string | null>(null);
  const save = useSaveClaim(kind.path);
  const toast = useToast();
  const formId = `claim-form-${kind.path}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ id: claim?.id, payload: toPayload(kind, values) });
      toast(claim ? `${kind.title} diperbarui` : `${kind.title} ditambahkan`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan");
    }
  }

  const set = (name: string) => (v: string) => setValues((s) => ({ ...s, [name]: v }));

  return (
    <Dialog
      open
      onClose={onClose}
      title={claim ? `Ubah ${kind.singular}` : `Tambah ${kind.singular}`}
      description="Klaim baru berstatus Belum diverifikasi sampai kamu melampirkan bukti."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form={formId} disabled={save.isPending}>
            {save.isPending ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4">
        {kind.fields.map((f) => {
          const common = {
            label: f.label,
            name: f.name,
            required: f.required,
            placeholder: f.placeholder,
            value: values[f.name] ?? "",
          };
          if (f.kind === "textarea") {
            return (
              <Textarea
                key={f.name}
                {...common}
                maxLength={2000}
                onChange={(e) => set(f.name)(e.target.value)}
              />
            );
          }
          if (f.kind === "select") {
            return (
              <Select
                key={f.name}
                {...common}
                options={f.options ?? []}
                onChange={(e) => set(f.name)(e.target.value)}
              />
            );
          }
          return (
            <Input
              key={f.name}
              {...common}
              type={
                f.kind === "url"
                  ? "url"
                  : f.kind === "number"
                    ? "number"
                    : f.kind === "date"
                      ? "date"
                      : "text"
              }
              min={f.kind === "number" ? 1950 : undefined}
              max={f.kind === "number" ? 2100 : undefined}
              maxLength={f.kind === "text" ? 160 : undefined}
              onChange={(e) => set(f.name)(e.target.value)}
            />
          );
        })}
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
