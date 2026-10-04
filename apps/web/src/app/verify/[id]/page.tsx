import { Card } from "@proven/ui";
import type { Metadata } from "next";
import { DownloadJsonButton } from "@/components/DownloadJsonButton";
import { IndependentVerifier } from "@/components/IndependentVerifier";
import { BackLink } from "@/components/BackLink";
import { PublicHeader } from "@/components/PublicHeader";
import { Qr } from "@/components/Qr";
import { Seal } from "@/components/Seal";
import { txUrl } from "@/lib/explorer";
import { serverApi } from "@/lib/server-api";
import type { VerifyResult } from "@/lib/verify-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verifikasi kredensial",
  description: "Periksa keaslian dan status kredensial Proven-ID langsung dari blockchain.",
};

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" });

export default async function VerifyCredentialPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const { status, body } = await serverApi<VerifyResult>(`/verify/${encodeURIComponent(id)}`);
  const vc = body?.vc as
    | {
        validFrom?: string;
        validUntil?: string;
        credentialSubject?: { achievement?: { name?: string; description?: string } };
      }
    | undefined;
  const explorer = txUrl(body?.anchor?.txHash);

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <BackLink fallback="/verify" />
        <h1 className="text-2xl font-semibold">Verifikasi kredensial</h1>
        {!body ? (
          <>
            <Seal state="not_found" />
            {status !== 404 && status !== 400 && (
              <p className="text-sm text-muted">Server Proven-ID sedang tidak tersedia. Coba lagi nanti.</p>
            )}
          </>
        ) : (
          <>
            <Seal state={body.status} />
            {body.sandbox && (
              <p
                role="note"
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                <strong>Kredensial demo.</strong> Diterbitkan di mode demo Proven-ID untuk uji coba: isinya
                contoh, bukan prestasi yang diverifikasi sungguhan. Tanda tangan dan catatan on-chain-nya
                tetap asli.
              </p>
            )}
            <Card className="p-5">
              <h2 className="text-lg font-semibold">
                {vc?.credentialSubject?.achievement?.name ?? "Kredensial"}
              </h2>
              {vc?.credentialSubject?.achievement?.description && (
                <p className="mt-1 text-sm text-muted">{vc.credentialSubject.achievement.description}</p>
              )}
              <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto,1fr]">
                <dt className="text-muted">Issuer</dt>
                <dd>
                  {body.issuer}
                  <span className="block break-all font-mono text-xs text-muted">{body.issuerDid}</span>
                </dd>
                <dt className="text-muted">Pemilik (subject)</dt>
                <dd className="break-all font-mono text-xs">{body.subject}</dd>
                {vc?.validFrom && (
                  <>
                    <dt className="text-muted">Diterbitkan</dt>
                    <dd>{dateFormat.format(new Date(vc.validFrom))}</dd>
                  </>
                )}
                {vc?.validUntil && (
                  <>
                    <dt className="text-muted">Berlaku sampai</dt>
                    <dd>{dateFormat.format(new Date(vc.validUntil))}</dd>
                  </>
                )}
                <dt className="text-muted">ID</dt>
                <dd className="break-all font-mono text-xs">{body.credentialId}</dd>
                {body.anchor && (
                  <>
                    <dt className="text-muted">Transaksi</dt>
                    <dd className="break-all font-mono text-xs" data-testid="anchor-tx">
                      {body.anchor.txHash}
                    </dd>
                    <dt className="text-muted">Blok · chain</dt>
                    <dd className="font-mono text-xs">
                      {body.anchor.block ?? "—"} · {body.anchor.chainId}
                    </dd>
                  </>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {explorer && (
                  <a
                    href={explorer}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-brand-700 hover:underline"
                  >
                    Lihat on-chain ↗
                  </a>
                )}
                <DownloadJsonButton
                  data={body.vc}
                  filename={`${body.credentialId.replace("urn:uuid:", "")}.json`}
                />
              </div>
              {!body.chainChecked && (
                <p className="mt-3 text-xs text-amber-900">
                  Status di atas dari catatan server karena blockchain tidak bisa dibaca saat ini — jalankan
                  verifikasi independen.
                </p>
              )}
            </Card>
            <IndependentVerifier vc={body.vc} />
            <Card className="flex items-center gap-4 p-5">
              <Qr
                value={`/verify/${encodeURIComponent(body.credentialId)}`}
                label="halaman verifikasi kredensial ini"
              />
              <p className="text-sm text-muted">
                Pindai untuk membuka halaman verifikasi ini di perangkat lain.
              </p>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
