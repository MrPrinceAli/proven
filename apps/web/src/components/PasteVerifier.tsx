"use client";

import { Card, Textarea } from "@proven/ui";
import { useState, type ChangeEvent } from "react";
import { IndependentVerifier } from "./IndependentVerifier";

/** /verify: paste or upload a VC JSON and verify it independently (§W7 5). */
export function PasteVerifier() {
  const [text, setText] = useState("");
  const [vc, setVc] = useState<{ value: unknown; key: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load(raw: string) {
    setText(raw);
    setError(null);
    try {
      setVc({ value: JSON.parse(raw), key: Date.now() });
    } catch {
      setVc(null);
      if (raw.trim()) setError("Bukan JSON yang valid.");
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) load(await file.text());
  }

  return (
    <>
      <Card className="flex flex-col gap-3 p-5">
        <Textarea
          label="Tempel VC JSON"
          rows={10}
          className="font-mono"
          value={text}
          onChange={(e) => load(e.target.value)}
          placeholder='{"@context": ["https://www.w3.org/ns/credentials/v2", …]}'
          data-testid="vc-input"
        />
        <label className="text-sm">
          <span className="font-medium">atau unggah file .json</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="mt-1 block text-sm"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </Card>
      {vc && <IndependentVerifier key={vc.key} vc={vc.value} />}
    </>
  );
}
