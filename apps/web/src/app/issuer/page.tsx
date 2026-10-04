"use client";

import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  IconFile,
  IconShield,
  IconSparkles,
  Select,
  StatusBadge,
  Textarea,
  useToast,
} from "@proven/ui";
import { useState } from "react";
import { CredentialCard } from "@/components/CredentialCard";
import { ApiError } from "@/lib/api";
import { shortDid } from "@/lib/chains";
import { formatBytes, KIND_BY_TYPE } from "@/lib/claims";
import { shortHash, txUrl } from "@/lib/explorer";
import {
  useDecideRequest,
  useIssuerCredentials,
  useIssuerQueue,
  useIssuerRequest,
  useRevokeCredential,
  type CredentialView,
} from "@/lib/queries";

type Tab = "queue" | "credentials";
type StateFilter = "pending" | "approved" | "rejected" | "all";

const STATE_FILTERS = [
  { value: "pending", label: "Menunggu" },
  { value: "approved", label: "Disetujui" },
  { value: "rejected", label: "Ditolak" },
  { value: "all", label: "Semua" },
];
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });

export default function IssuerPage() {
  const [tab, setTab] = useState<Tab>("queue");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <IconShield className="h-6 w-6 text-brand-700" />
        <h1 className="text-xl font-semibold">Dashboard issuer</h1>
      </div>
      <div role="tablist" aria-label="Bagian issuer" className="flex gap-1 border-b border-line">
        {(
          [
            ["queue", "Antrean"],
            ["credentials", "Kredensial"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === id
                ? "border-brand-700 font-semibold text-brand-800"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "queue" ? <Queue /> : <IssuedCredentials />}
    </div>
  );
}

function Queue() {
  const [state, setState] = useState<StateFilter>("pending");
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isError } = useIssuerQueue(state);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)]">
      <Card className="p-4">
        <div className="mb-3 max-w-[12rem]">
          <Select
            label="Status"
            value={state}
            options={STATE_FILTERS}
            onChange={(e) => {
              setState(e.target.value as StateFilter);
              setSelected(null);
            }}
          />
        </div>
        {isLoading && <p className="text-sm text-muted">Memuat antrean…</p>}
        {isError && <p className="text-sm text-red-700">Gagal memuat antrean.</p>}
        {data?.length === 0 && (
          <EmptyState title="Antrean kosong" description="Belum ada permintaan dengan status ini." />
        )}
        <ul className="divide-y divide-line">
          {data?.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r.id)}
                aria-current={selected === r.id ? "true" : undefined}
                className={`flex w-full flex-col items-start gap-1 rounded-md px-2 py-3 text-left hover:bg-gray-50 ${
                  selected === r.id ? "bg-brand-50" : ""
                }`}
              >
                <span className="text-xs uppercase tracking-wide text-muted">
                  {KIND_BY_TYPE[r.entityType].title}
                </span>
                <span className="font-medium text-ink">{r.claim.label}</span>
                <span className="text-xs text-muted">
                  {r.requester.did ? shortDid(r.requester.did) : "—"} · {r.evidenceCount ?? 0} bukti ·{" "}
                  {dateFormat.format(new Date(r.createdAt))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {selected ? (
        <RequestPanel id={selected} onDone={() => setSelected(null)} />
      ) : (
        <Card className="hidden p-6 lg:block">
          <EmptyState title="Pilih permintaan" description="Detail klaim dan bukti akan tampil di sini." />
        </Card>
      )}
    </div>
  );
}

function RequestPanel({ id, onDone }: { id: string; onDone: () => void }) {
  const { data, isLoading } = useIssuerRequest(id);
  const decide = useDecideRequest();
  const toast = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) return <Card className="p-6 text-sm text-muted">Memuat detail…</Card>;
  const pending = data.state === "pending";
  const fields = Object.entries(data.claim).filter(
    ([k, v]) => !["label", "status"].includes(k) && v !== null && v !== "",
  );

  async function approve() {
    if (!window.confirm(`Setujui "${data!.claim.label}"? Kredensial akan dicatat permanen di blockchain.`))
      return;
    setError(null);
    try {
      const res = await decide.mutateAsync({ id, decision: "approve" });
      const link = txUrl(res.txHash);
      toast(
        link ? `Kredensial terbit · tx ${shortHash(res.txHash!)}` : "Kredensial terbit dan tercatat on-chain",
      );
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyetujui");
    }
  }

  async function reject() {
    setError(null);
    try {
      await decide.mutateAsync({ id, decision: "reject", reason });
      toast("Permintaan ditolak");
      setRejecting(false);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menolak");
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">{KIND_BY_TYPE[data.entityType].title}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{data.claim.label}</h2>
          {data.claim.status && <StatusBadge status={data.claim.status} />}
        </div>
        <dl className="mt-2 grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto,1fr]">
          {fields.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="capitalize text-muted">{k}</dt>
              <dd className="break-words">{String(v)}</dd>
            </div>
          ))}
          <dt className="text-muted">Pemohon</dt>
          <dd className="font-mono text-xs">
            {data.requester.did}
            {data.requester.slug && (
              <a
                href={`/p/${data.requester.slug}`}
                target="_blank"
                rel="noreferrer"
                className="ml-2 font-sans text-brand-700 hover:underline"
              >
                profil publik ↗
              </a>
            )}
          </dd>
        </dl>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Bukti ({data.evidence.length})</h3>
        <ul className="flex flex-col gap-2">
          {data.evidence.map((e) => (
            <li key={e.id} className="rounded-md border border-line p-3">
              <div className="flex items-center gap-2">
                <IconFile className="h-4 w-4 text-brand-700" />
                <span className="font-medium">{e.title || e.filename}</span>
                <Badge>{e.type}</Badge>
                <span className="text-xs text-muted">{formatBytes(e.sizeBytes)}</span>
                <a
                  href={`/api/issuer/verification-requests/${id}/evidence/${e.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-sm font-medium text-brand-700 hover:underline"
                >
                  Lihat
                </a>
              </div>
              <p className="mt-1 break-all font-mono text-xs text-muted">SHA-256 {e.sha256}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-dashed border-line p-3">
        <h3 className="flex items-center gap-1 text-sm font-semibold">
          <IconSparkles className="h-4 w-4 text-brand-700" /> Analisis AI
        </h3>
        <p className="mt-1 text-sm text-muted">
          Tersedia di gelombang W6. AI hanya asisten. Keputusan ada di tangan issuer.
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {pending ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={approve} disabled={decide.isPending} aria-busy={decide.isPending}>
            {decide.isPending ? "Mencatat ke blockchain…" : "Setujui & terbitkan"}
          </Button>
          <Button variant="danger" onClick={() => setRejecting(true)} disabled={decide.isPending}>
            Tolak
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Sudah {data.state === "approved" ? "disetujui" : "ditolak"}
          {data.decidedAt && ` pada ${dateFormat.format(new Date(data.decidedAt))}`}
          {data.reason && ` — ${data.reason}`}
        </p>
      )}

      <Dialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Tolak permintaan"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={reject} disabled={reason.trim().length < 3 || decide.isPending}>
              Tolak
            </Button>
          </>
        }
      >
        <Textarea
          label="Alasan (dikirim ke pengguna)"
          required
          minLength={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Dialog>
    </Card>
  );
}

function IssuedCredentials() {
  const { data, isLoading } = useIssuerCredentials();
  const [revoking, setRevoking] = useState<CredentialView | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {isLoading && <p className="text-sm text-muted">Memuat…</p>}
      {data?.length === 0 && <EmptyState title="Belum ada kredensial terbit" />}
      {data?.map((c) => (
        <CredentialCard
          key={c.id}
          credential={c}
          actions={
            c.status === "active" && (
              <Button variant="danger" onClick={() => setRevoking(c)} className="self-start">
                Cabut
              </Button>
            )
          }
        />
      ))}
      {revoking && <RevokeDialog credential={revoking} onClose={() => setRevoking(null)} />}
    </div>
  );
}

function RevokeDialog({ credential, onClose }: { credential: CredentialView; onClose: () => void }) {
  const revoke = useRevokeCredential();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await revoke.mutateAsync({ id: credential.id, reason });
      toast("Kredensial dicabut dan tercatat on-chain");
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal mencabut");
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Cabut kredensial"
      description={`"${credential.name}" akan ditandai dicabut di blockchain. Tindakan ini tidak bisa dibatalkan.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="danger" onClick={submit} disabled={reason.trim().length < 3 || revoke.isPending}>
            {revoke.isPending ? "Mencatat ke blockchain…" : "Cabut"}
          </Button>
        </>
      }
    >
      <Textarea
        label="Alasan pencabutan"
        required
        minLength={3}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </Dialog>
  );
}
