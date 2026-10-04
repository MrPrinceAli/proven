"use client";

import { Badge, Button, IconSparkles, SectionCard, Textarea, useToast } from "@proven/ui";
import { useState } from "react";
import { AiLabel } from "@/components/AiLabel";
import { CvPdfButton } from "@/components/CvPdfButton";
import { cvFromAi } from "@/lib/cv-model";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { KINDS } from "@/lib/claims";
import {
  useAiCv,
  useAiSummary,
  useClaims,
  useEvidence,
  useMyRequests,
  useUpdateProfile,
  type AiCv,
  type AiEnvelope,
  type AiTailor,
} from "@/lib/queries";

/** Turns "skill:<uuid>" / "evidence:<uuid>" into a readable label for citation chips. */
function useSourceLabels() {
  const { data: claims } = useClaims();
  const { data: evidence } = useEvidence();
  return (id: string): string => {
    const [type, uuid] = id.split(":");
    if (type === "profile") return "Profil";
    if (type === "evidence") {
      const e = evidence?.find((x) => x.id === uuid);
      return e ? `Bukti: ${e.title || e.filename}` : "Bukti";
    }
    const kind = KINDS.find((k) => k.entityType === type);
    const claim = kind && claims?.claims[kind.path]?.find((c) => c.id === uuid);
    return kind ? `${kind.title}: ${claim ? kind.primary(claim) : "?"}` : id;
  };
}

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Permintaan AI gagal");

export default function AiPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <IconSparkles className="h-6 w-6 text-brand-700" />
        <h1 className="text-xl font-semibold">Asisten AI</h1>
      </div>
      <p className="text-sm text-muted">
        AI hanya memakai data profil dan buktimu sendiri, tidak boleh menambah fakta, dan hasilnya tidak
        tersimpan sebelum kamu menyetujuinya. Status <strong>Terverifikasi</strong> tetap hanya dari issuer.
      </p>
      <SummaryCard />
      <CvCard />
      <TailorCard />
    </div>
  );
}

function SummaryCard() {
  const [freeText, setFreeText] = useState("");
  const [draft, setDraft] = useState<{ headline: string; summary: string } | null>(null);
  const summary = useAiSummary();
  const save = useUpdateProfile();
  const toast = useToast();
  const label = useSourceLabels();

  async function generate() {
    try {
      const res = await summary.mutateAsync(freeText.trim() || undefined);
      setDraft({ headline: res.result.headline, summary: res.result.summary });
    } catch (e) {
      toast(errorText(e), "error");
    }
  }

  async function persist() {
    if (!draft) return;
    try {
      await save.mutateAsync({ headline: draft.headline, summary: draft.summary });
      toast("Ringkasan disimpan ke profil");
      setDraft(null);
    } catch (e) {
      toast(errorText(e), "error");
    }
  }

  return (
    <SectionCard title="Ringkasan profil">
      <Textarea
        label="Ceritakan dirimu (opsional)"
        hint="Dipakai sebagai bahan tambahan, bukan perintah."
        rows={3}
        maxLength={4000}
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
      />
      <Button onClick={generate} disabled={summary.isPending} className="mt-3">
        {summary.isPending ? "Menyusun…" : "Buat draf ringkasan"}
      </Button>
      {draft && summary.data && (
        <div className="mt-4 flex flex-col gap-3 rounded-md border border-line p-4">
          <AiLabel model={summary.data.model} />
          {!summary.data.result.grounded && (
            <p className="text-sm text-amber-900">
              Draf ini tidak mengutip sumber yang valid — tinjau dengan teliti.
            </p>
          )}
          <Textarea
            label="Headline"
            rows={1}
            value={draft.headline}
            onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
          />
          <Textarea
            label="Ringkasan"
            rows={4}
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          />
          <Citations ids={summary.data.result.citations} label={label} />
          <div className="flex gap-2">
            <Button onClick={persist} disabled={save.isPending}>
              Simpan ke profil
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Buang draf
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function CvCard() {
  const cv = useAiCv();
  const { data: me } = useSession();
  const { data: claims } = useClaims();
  const { data: requests } = useMyRequests();
  const toast = useToast();
  const label = useSourceLabels();
  const data = cv.data?.mode === "cv" ? (cv.data as AiEnvelope<AiCv>) : null;

  return (
    <SectionCard title="CV dari profil">
      <p className="text-sm text-muted">
        Setiap kalimat mengutip klaim atau bukti asalnya. Kalimat tanpa sumber dibuang.
      </p>
      <Button
        onClick={() => cv.mutateAsync(undefined).catch((e) => toast(errorText(e), "error"))}
        disabled={cv.isPending}
        className="mt-3"
      >
        {cv.isPending ? "Menyusun…" : "Buat CV"}
      </Button>
      {data && (
        <div className="mt-4 flex flex-col gap-4">
          <AiLabel model={data.model} />
          {data.result.sections.length === 0 && (
            <p className="text-sm text-muted">Belum ada data profil yang bisa dijadikan CV.</p>
          )}
          {data.result.sections.map((section) => (
            <section key={section.title}>
              <h3 className="font-semibold">{section.title}</h3>
              <ul className="mt-1 flex flex-col gap-2">
                {section.items.map((item, i) => (
                  <li key={i} className="text-sm">
                    {item.text}
                    <Citations ids={item.citations} label={label} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div>
            <CvPdfButton
              label="Setujui & unduh PDF"
              build={() =>
                me && claims
                  ? cvFromAi(me, data.result, claims, requests ?? [], window.location.origin)
                  : null
              }
            />
          </div>
          {data.removed.length > 0 && (
            <p className="text-xs text-muted">
              {data.removed.length} kalimat tanpa sumber valid dibuang oleh guardrail.
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function TailorCard() {
  const [jd, setJd] = useState("");
  const tailor = useAiCv();
  const toast = useToast();
  const label = useSourceLabels();
  const data = tailor.data?.mode === "tailor" ? (tailor.data as AiEnvelope<AiTailor>) : null;

  return (
    <SectionCard title="Sesuaikan dengan lowongan">
      <Textarea
        label="Tempel deskripsi lowongan"
        hint="Maks. 8.000 karakter. Skill yang tidak kamu buktikan ditandai, bukan ditambahkan."
        rows={6}
        maxLength={20000}
        value={jd}
        onChange={(e) => setJd(e.target.value)}
      />
      <Button
        onClick={() => tailor.mutateAsync(jd).catch((e) => toast(errorText(e), "error"))}
        disabled={tailor.isPending || !jd.trim()}
        className="mt-3"
      >
        {tailor.isPending ? "Membandingkan…" : "Bandingkan"}
      </Button>
      {data && (
        <div className="mt-4 flex flex-col gap-4">
          <AiLabel model={data.model} />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold text-brand-800">
                Cocok & terbukti ({data.result.matched.length})
              </h3>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="pb-1">Skill</th>
                    <th className="pb-1">Bukti</th>
                  </tr>
                </thead>
                <tbody>
                  {data.result.matched.map((m) => (
                    <tr key={m.skill} className="border-t border-line">
                      <td className="py-1.5 font-medium">{m.skill}</td>
                      <td className="py-1.5 text-muted">{label(m.evidenceId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.result.matched.length === 0 && (
                <p className="text-sm text-muted">Belum ada skill yang terbukti.</p>
              )}
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-orange-900">Celah ({data.result.gaps.length})</h3>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="pb-1">Skill</th>
                    <th className="pb-1">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {data.result.gaps.map((g) => (
                    <tr key={g.skill} className="border-t border-line">
                      <td className="py-1.5 font-medium">{g.skill}</td>
                      <td className="py-1.5 text-orange-900">{g.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {data.result.cv && (
            <div>
              <h3 className="mb-1 font-semibold">Draf CV tersesuaikan</h3>
              <p className="whitespace-pre-line rounded-md bg-gray-50 p-3 text-sm">{data.result.cv}</p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function Citations({ ids, label }: { ids: string[]; label: (id: string) => string }) {
  if (ids.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {ids.map((id) => (
        <Badge key={id} className="bg-brand-50 text-[11px] text-brand-900">
          {label(id)}
        </Badge>
      ))}
    </span>
  );
}
