"use client";

import { Button, Card, IconCheckBadge, IconX } from "@proven/ui";
import { credentialRegistryAbi } from "@proven/contracts";
import { anchorFromTuple, verifyVC, type VerificationReport } from "@proven/vc";
import { useEffect, useState } from "react";
import { createPublicClient, getAddress, http, isAddress, type Hex } from "viem";
import { appChain } from "@/lib/chains";
import { publicEnv } from "@/lib/env";
import { sealFromOverall } from "@/lib/verify-types";
import { Seal } from "./Seal";

const registry = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? "";

/**
 * Verifies a VC without trusting Proven's servers (§W7 4): recomputes sha256(JCS(vc)) in the browser,
 * reads CredentialRegistry.getAnchor straight from the public RPC and checks the EIP-712 signature.
 * The contract address comes from this app's build configuration, never from the API response.
 */
export function IndependentVerifier({ vc, autoRun = false }: { vc: unknown; autoRun?: boolean }) {
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const configured = isAddress(registry);

  async function run() {
    setError(null);
    setReport(null);
    setRunning(true);
    try {
      const chain = appChain(publicEnv.chainId, publicEnv.rpcUrl);
      const client = createPublicClient({ chain, transport: http(publicEnv.rpcUrl) });
      const verifyingContract = getAddress(registry);
      const readAnchor = async (hash: Hex) =>
        anchorFromTuple(
          await client.readContract({
            address: verifyingContract,
            abi: credentialRegistryAbi,
            functionName: "getAnchor",
            args: [hash],
          }),
        );
      setReport(await verifyVC({ vc, readAnchor, chainId: chain.id, verifyingContract }));
    } catch {
      setError("Tidak bisa membaca blockchain lewat RPC publik. Coba lagi beberapa saat lagi.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (autoRun && configured) void run();
    // Run once on mount; later runs are user-initiated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps: { ok: boolean; label: string; detail?: string }[] = report
    ? [
        { ok: report.schemaValid, label: "Format kredensial sesuai W3C VC 2.0 / Open Badges" },
        {
          ok: report.credentialHash !== null,
          label: "Hash dihitung ulang di browser (SHA-256 atas JCS)",
          detail: report.credentialHash ?? undefined,
        },
        {
          ok: report.anchorFound,
          label: "Hash tercatat di blockchain",
          detail: `Chain ${publicEnv.chainId} · kontrak ${registry}`,
        },
        { ok: report.subjectMatches, label: "Pemilik (subject DID) cocok dengan catatan on-chain" },
        { ok: report.issuerMatches, label: "Issuer cocok dengan catatan on-chain" },
        { ok: report.signatureValid, label: "Tanda tangan EIP-712 issuer valid" },
        { ok: !report.revoked, label: "Belum dicabut" },
        { ok: !report.expired, label: "Masih berlaku" },
      ]
    : [];

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Verifikasi independen</h2>
        <p className="text-sm text-muted">
          Dijalankan sepenuhnya di browser kamu dan langsung ke blockchain — tidak bergantung pada server
          Proven.
        </p>
      </div>
      {!configured ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Alamat kontrak belum dikonfigurasi di aplikasi ini (NEXT_PUBLIC_REGISTRY_ADDRESS).
        </p>
      ) : (
        <Button onClick={run} disabled={running} className="self-start" data-testid="independent-verify">
          {running ? "Memeriksa blockchain…" : report ? "Periksa ulang" : "Verifikasi independen"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {report && (
        <>
          <Seal state={sealFromOverall(report.overall)} compact />
          <ol className="flex flex-col gap-2" aria-label="Langkah verifikasi">
            {steps.map((s) => (
              <li key={s.label} className="flex items-start gap-2 text-sm">
                {s.ok ? (
                  <IconCheckBadge className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" title="lulus" />
                ) : (
                  <IconX className="mt-0.5 h-4 w-4 shrink-0 text-red-700" title="gagal" />
                )}
                <span>
                  {s.label}
                  {s.detail && (
                    <span className="block break-all font-mono text-xs text-muted">{s.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}
