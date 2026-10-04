"use client";

import { Avatar, Button, Dialog, Input, Select, Textarea, useToast } from "@proven/ui";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { AVATAR_CHOICES, avatarUri } from "@/lib/avatar";
import { useUpdateProfile } from "@/lib/queries";
import type { Me } from "@/lib/session";

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Publik — siapa pun dengan link bisa melihat" },
  { value: "private", label: "Privat — hanya kamu" },
  { value: "recruiter-only", label: "Khusus recruiter (segera hadir; saat ini sama dengan privat)" },
];

export function ProfileEditDialog({
  profile,
  onClose,
}: {
  profile: NonNullable<Me["profile"]>;
  onClose: () => void;
}) {
  const [values, setValues] = useState({
    displayName: profile.displayName,
    avatarSeed: profile.avatarSeed,
    headline: profile.headline,
    summary: profile.summary,
    visibility: profile.visibility,
    slug: profile.slug ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateProfile();
  const toast = useToast();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({ ...values, slug: values.slug.trim() || null });
      toast("Profil disimpan");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan profil");
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Ubah profil"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="profile-form" disabled={update.isPending}>
            {update.isPending ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <form id="profile-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            seed={values.avatarSeed}
            label="Pratinjau avatar"
            src={avatarUri(values.avatarSeed)}
            size={64}
          />
          <Button
            variant="secondary"
            onClick={() =>
              setValues((v) => {
                const options = AVATAR_CHOICES.filter((s) => s !== v.avatarSeed);
                return { ...v, avatarSeed: options[Math.floor(Math.random() * options.length)]! };
              })
            }
          >
            Ganti avatar
          </Button>
        </div>
        <Input
          label="Nama"
          maxLength={80}
          placeholder="Nama lengkap atau nama profesional"
          hint="Tampil di profil dan CV. Tidak pernah dicatat di blockchain."
          value={values.displayName}
          onChange={(e) => setValues((v) => ({ ...v, displayName: e.target.value }))}
        />
        <Input
          label="Headline"
          maxLength={160}
          placeholder="Smart Contract Engineer · BNB Chain"
          value={values.headline}
          onChange={(e) => setValues((v) => ({ ...v, headline: e.target.value }))}
        />
        <Textarea
          label="Tentang"
          maxLength={2600}
          rows={5}
          value={values.summary}
          onChange={(e) => setValues((v) => ({ ...v, summary: e.target.value }))}
        />
        <Input
          label="Slug profil publik"
          hint="3–40 karakter: huruf kecil, angka, dan tanda hubung. Contoh: arya-dev → /p/arya-dev"
          pattern="[A-Za-z0-9][A-Za-z0-9\-]{1,38}[A-Za-z0-9]"
          value={values.slug}
          onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
        />
        <Select
          label="Visibilitas"
          options={VISIBILITY_OPTIONS}
          value={values.visibility}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              visibility: e.target.value as NonNullable<Me["profile"]>["visibility"],
            }))
          }
        />
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
