"use client";

import { Button, Card, IconCopy, Textarea } from "@proven/ui";
import { credentialHash, VerifiableCredentialSchema } from "@proven/vc";
import { useState } from "react";

/**
 * Computes sha256(JCS(vc without proof)) entirely in the browser with @proven/vc.
 * W7 extends this into full independent verification (anchor read via RPC + EIP-712).
 */
export function VcHashTool() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ hash: string; schemaValid: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function compute() {
    setError(null);
    setResult(null);
    try {
      const vc = JSON.parse(input) as object;
      setResult({ hash: credentialHash(vc), schemaValid: VerifiableCredentialSchema.safeParse(vc).success });
    } catch {
      setError("Bukan JSON yang valid.");
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <Textarea
        label="Tempel VC JSON"
        rows={10}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="font-mono"
        placeholder='{"@context": ["https://www.w3.org/ns/credentials/v2", …]}'
      />
      <Button onClick={compute} disabled={!input.trim()} className="self-start">
        Hitung credentialHash
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {result && (
        <dl className="grid gap-1 text-sm sm:grid-cols-[auto,1fr]">
          <dt className="text-muted">credentialHash</dt>
          <dd className="flex items-center gap-2 break-all font-mono">
            {result.hash}
            <button
              type="button"
              aria-label="Salin hash"
              onClick={() => void navigator.clipboard.writeText(result.hash)}
              className="rounded p-1 text-muted hover:bg-gray-100"
            >
              <IconCopy className="h-4 w-4" />
            </button>
          </dd>
          <dt className="text-muted">Skema VC</dt>
          <dd>{result.schemaValid ? "Valid (W3C VC 2.0 / Open Badges)" : "Tidak sesuai skema Proven"}</dd>
        </dl>
      )}
      <p className="text-xs text-muted">
        Dihitung di browser kamu: SHA-256 atas JCS (RFC 8785) dari VC tanpa <code>proof</code>. Pengecekan ke
        blockchain menyusul di gelombang W7.
      </p>
    </Card>
  );
}
