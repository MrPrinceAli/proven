import { AiOutputInvalidError, type GenerateRequest, type LlmClient } from "./llm";
import {
  NO_EVIDENCE_NOTE,
  type ClaimCheckOutput,
  type ClassifyOutput,
  type CvOutput,
  type SummaryOutput,
  type TailorOutput,
} from "./schemas";
import { sameSkill, skillsInText } from "./skills";
import type { SourcePack } from "./source-pack";

/** Deterministic stand-in for the LLM, used by every test and in CI (§W6 1). */
export type MockFixture = (req: GenerateRequest<unknown>) => unknown;

const TYPE_HINTS: [RegExp, ClassifyOutput["type"]][] = [
  [/hackathon/i, "hackathon"],
  [/lomba|competition|kompetisi|olimpiade/i, "competition"],
  [/juara|award|penghargaan|winner/i, "award"],
  [/kerja|employment|pegawai|offer letter|internship|magang/i, "employment"],
  [/ijazah|transkrip|universitas|education|kuliah/i, "education"],
  [/komunitas|community|relawan|volunteer/i, "community"],
  [/proyek|project|repository|github/i, "project"],
];

const claimItems = (pack: SourcePack) => pack.filter((s) => s.kind !== "profile" && s.kind !== "evidence");
const firstLine = (text: string) => text.split("\n")[0]!.replace(/^[^:]*:\s*/, "");

/** Honest default behaviour: only uses the sources and cites them. */
export const defaultFixtures: Record<string, MockFixture> = {
  summary: ({ sourcePack }): SummaryOutput => {
    const profile = sourcePack.find((s) => s.kind === "profile");
    const skills = sourcePack.filter((s) => s.kind === "skill").slice(0, 3);
    return {
      headline: profile ? firstLine(profile.text) || "Profesional" : "Profesional",
      summary: `Profesional dengan keahlian ${skills.map((s) => s.name).join(", ") || "yang sedang dibangun"}.`,
      citations: [...(profile ? [profile.id] : []), ...skills.map((s) => s.id)],
    };
  },
  cv: ({ sourcePack }): CvOutput => {
    const titles: Record<string, string> = {
      experience: "Pengalaman",
      project: "Proyek",
      achievement: "Prestasi",
      skill: "Keahlian",
      community_role: "Komunitas",
    };
    return {
      sections: Object.entries(titles)
        .map(([kind, title]) => ({
          title,
          items: claimItems(sourcePack)
            .filter((s) => s.kind === kind)
            .map((s) => ({ text: firstLine(s.text), citations: [s.id, ...s.links] })),
        }))
        .filter((s) => s.items.length > 0),
    };
  },
  tailor: ({ sourcePack, input }): TailorOutput => {
    const skills = sourcePack.filter((s) => s.kind === "skill" && s.name);
    const asked = skillsInText(
      input,
      skills.map((s) => s.name!),
    );
    const matched = asked.flatMap((name) => {
      const skill = skills.find((s) => sameSkill(s.name!, name));
      const evidence = skill?.links[0];
      return skill && evidence ? [{ skill: skill.name!, evidenceId: evidence }] : [];
    });
    return {
      matched,
      gaps: asked
        .filter((name) => !matched.some((m) => sameSkill(m.skill, name)))
        .map((skill) => ({ skill, note: NO_EVIDENCE_NOTE })),
      cv: matched.map((m) => `Berpengalaman dengan ${m.skill}.`).join(" "),
    };
  },
  classify: ({ sourcePack }): ClassifyOutput => {
    const text = sourcePack.map((s) => s.text).join(" ");
    const hit = TYPE_HINTS.find(([re]) => re.test(text));
    return {
      type: hit?.[1] ?? "certificate",
      confidence: hit ? 0.8 : 0.4,
      rationale: "Berdasarkan judul dan deskripsi bukti.",
    };
  },
  "claim-check": ({ sourcePack }): ClaimCheckOutput => ({
    claims: claimItems(sourcePack).map((s) => ({
      claimId: s.id,
      claim: firstLine(s.text),
      status: s.links.length > 0 ? "EVIDENCE_ATTACHED" : "CLAIM_WITHOUT_EVIDENCE",
      evidenceIds: s.links,
      confidence: s.links.length > 0 ? 0.7 : 0.2,
      reason: s.links.length > 0 ? "Ada bukti terlampir." : "Belum ada bukti.",
    })),
  }),
};

export function createMockClient(
  overrides: Partial<Record<string, MockFixture>> = {},
): LlmClient & { calls: number } {
  const fixtures = { ...defaultFixtures, ...overrides };
  const client = {
    provider: "mock" as const,
    model: "mock",
    calls: 0,
    async generateStructured<T>(req: GenerateRequest<T>): Promise<T> {
      const fixture = fixtures[req.task];
      if (!fixture) throw new Error(`No mock fixture for task ${req.task}`);
      // Same contract as the real client: validate, retry once, then fail.
      for (let i = 0; i < 2; i += 1) {
        client.calls += 1;
        const parsed = req.schema.safeParse(fixture(req as GenerateRequest<unknown>));
        if (parsed.success) return parsed.data;
      }
      throw new AiOutputInvalidError("The AI output did not match the expected schema", "invalid");
    },
  };
  return client;
}
