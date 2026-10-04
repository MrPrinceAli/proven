// pnpm ai:eval — groundedness & hallucination on 15 cases with the real provider (§W6 14, §S10.4).
// Skipped when LLM_API_KEY is empty. Never runs in CI (it costs money).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAnthropicClient, generateCv, mentions, tailorCv, type SourcePack } from "../src";

interface Case {
  id: string;
  headline: string;
  skills: { name: string; evidence: string | null }[];
  achievements: string[];
  experiences: { title: string; org: string }[];
  evidenceNote: string | null;
  jobDescription: string;
  absentSkills: string[];
}

const here = dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.LLM_API_KEY?.trim();
if (!apiKey) {
  console.log("LLM_API_KEY kosong — ai:eval dilewati.");
  process.exit(0);
}
const model = process.env.LLM_MODEL?.trim() || "claude-opus-5-5";
const llm = createAnthropicClient({ apiKey, model, timeoutMs: 30_000 });
const cases: Case[] = JSON.parse(readFileSync(join(here, "dataset.json"), "utf8"));

function toPack(c: Case): SourcePack {
  const pack: SourcePack = [{ id: "profile:u", kind: "profile", text: `Headline: ${c.headline}`, links: [] }];
  c.skills.forEach((s, i) => {
    const ev = s.evidence ? [`evidence:s${i}`] : [];
    pack.push({ id: `skill:s${i}`, kind: "skill", name: s.name, text: `Skill: ${s.name}`, links: ev });
    if (s.evidence) {
      const note = c.evidenceNote ? ` — ${c.evidenceNote}` : "";
      pack.push({
        id: `evidence:s${i}`,
        kind: "evidence",
        text: `Evidence: ${s.evidence}${note}`,
        links: [`skill:s${i}`],
      });
    }
  });
  c.achievements.forEach((a, i) =>
    pack.push({ id: `achievement:a${i}`, kind: "achievement", text: a, links: [] }),
  );
  c.experiences.forEach((e, i) =>
    pack.push({ id: `experience:e${i}`, kind: "experience", text: `${e.title} — ${e.org}`, links: [] }),
  );
  return pack;
}

let cvItems = 0;
let cvUngrounded = 0;
let tailorClaims = 0;
let tailorFabricated = 0;
let leaksAfterGuardrail = 0;
const rows: string[] = [];

for (const c of cases) {
  const pack = toPack(c);
  const cv = await generateCv(llm, pack);
  const kept = cv.result.sections.reduce((n, s) => n + s.items.length, 0);
  cvItems += kept + cv.removed.length;
  cvUngrounded += cv.removed.length;

  const tailor = await tailorCv(llm, pack, c.jobDescription);
  const fabricated = tailor.removed.length;
  tailorFabricated += fabricated;
  tailorClaims +=
    tailor.result.matched.length + fabricated + tailor.result.cv.split(/[.!?]\s+/).filter(Boolean).length;
  const leaks = c.absentSkills.filter(
    (s) =>
      tailor.result.matched.some((m) => m.skill.toLowerCase() === s.toLowerCase()) ||
      mentions(tailor.result.cv, s),
  );
  leaksAfterGuardrail += leaks.length;
  rows.push(
    `| ${c.id} | ${kept}/${kept + cv.removed.length} | ${tailor.result.matched.map((m) => m.skill).join(", ") || "—"} | ${tailor.result.gaps.map((g) => g.skill).join(", ") || "—"} | ${fabricated} | ${leaks.join(", ") || "0"} |`,
  );
  console.log(
    `${c.id}: cv ${kept}/${kept + cv.removed.length}, removed in tailor ${fabricated}, leaks ${leaks.length}`,
  );
}

const groundedness = cvItems ? 1 - cvUngrounded / cvItems : 1;
const hallucination = tailorClaims ? tailorFabricated / tailorClaims : 0;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const report = `# AI eval — ${new Date().toISOString()}

Model: \`${model}\` · cases: ${cases.length} · prompts: cv@1, tailor@1

| Metric | Raw model output | Target | Result |
|---|---|---|---|
| Groundedness (CV items with a valid citation) | ${pct(groundedness)} | ≥ 95% | ${groundedness >= 0.95 ? "✅" : "❌"} |
| Hallucination (tailor claims removed by guardrails) | ${pct(hallucination)} | ≤ 1% | ${hallucination <= 0.01 ? "✅" : "❌"} |
| Absent skills in matched/CV **after** guardrails | ${leaksAfterGuardrail} | 0 | ${leaksAfterGuardrail === 0 ? "✅" : "❌"} |

Raw metrics measure the model before guardrails; the last row is what users see.

| Case | CV grounded | Matched | Gaps | Removed (tailor) | Leaks |
|---|---|---|---|---|---|
${rows.join("\n")}
`;
writeFileSync(join(here, "report.md"), report);
console.log(
  `\nGroundedness ${pct(groundedness)}, hallucination ${pct(hallucination)}, leaks ${leaksAfterGuardrail}. Report: eval/report.md`,
);
