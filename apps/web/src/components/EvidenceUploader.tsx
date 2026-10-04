"use client";

import { Button, IconUpload, Input, SectionCard, Select, useToast } from "@proven/ui";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { EVIDENCE_TYPES, MAX_UPLOAD_BYTES, formatBytes } from "@/lib/claims";
import { useUploadEvidence } from "@/lib/queries";

const ACCEPT = "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg";

export function EvidenceUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("certificate");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadEvidence();
  const toast = useToast();

  function choose(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setError(`Ukuran ${formatBytes(f.size)} melebihi batas 4 MB. Kompres PDF/gambar lalu coba lagi.`);
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    choose(e.dataTransfer.files[0]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    try {
      const saved = await upload.mutateAsync({ file, fields: { title, type } });
      toast(`Bukti tersimpan · SHA-256 ${saved.sha256.slice(0, 12)}…`);
      setFile(null);
      setTitle("");
      if (input.current) input.current.value = "";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload gagal");
    }
  }

  return (
    <SectionCard title="Unggah bukti" icon={<IconUpload className="h-5 w-5" />}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragging ? "border-brand-700 bg-brand-50" : "border-gray-300"
          }`}
        >
          <IconUpload className="h-8 w-8 text-brand-700" />
          <p className="text-sm text-ink">
            {file ? (
              <>
                <strong>{file.name}</strong> · {formatBytes(file.size)}
              </>
            ) : (
              "Tarik file ke sini atau"
            )}
          </p>
          <label className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">
            {file ? "Ganti file" : "Pilih file"}
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>
          <p className="text-xs text-muted">PDF, PNG, atau JPG · maks. 4 MB · dienkripsi sebelum disimpan</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Judul" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          <Select
            label="Jenis bukti"
            options={EVIDENCE_TYPES}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!file || upload.isPending} className="self-start">
          {upload.isPending ? "Mengenkripsi & menyimpan…" : "Unggah"}
        </Button>
      </form>
    </SectionCard>
  );
}
