import {
  NO_EVIDENCE_NOTE,
  type ClaimCheckOutput,
  type ClaimCheckStatus,
  type ClassifyOutput,
  type CvOutput,
  type SummaryOutput,
  type TailorOutput,
} from "./schemas";
import { mentions, sameSkill, skillsInText } from "./skills";
import { sourceIds, type SourcePack } from "./source-pack";

// Deterministic checks applied AFTER the model (§W6 5). They never trust the model's output.

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Keeps only citations that name a real source. */
export function validCitations(citations: string[], pack: SourcePack): string[] {
  const ids = sourceIds(pack);
  return [...new Set(citations.filter((c) => ids.has(c)))];
}

export interface Guarded<T> {
  output: T;
  /** What the guardrail removed or changed, for transparency in the UI and the eval. */
  removed: string[];
}

export function guardSummary(
  raw: SummaryOutput,
  pack: SourcePack,
): Guarded<SummaryOutput & { grounded: boolean }> {
  const citations = validCitations(raw.citations, pack);
  const removed = raw.citations.filter((c) => !citations.includes(c)).map((c) => `citation ${c}`);
  return { output: { ...raw, citations, grounded: citations.length > 0 }, removed };
}

/** CV items without at least one valid citation are dropped (§W6 5b). */
export function guardCv(raw: CvOutput, pack: SourcePack): Guarded<CvOutput> {
  const removed: string[] = [];
  const sections = raw.sections
    .map((section) => ({
      title: section.title,
      items: section.items.flatMap((item) => {
        const citations = validCitations(item.citations, pack);
        if (citations.length === 0) {
          removed.push(item.text);
          return [];
        }
        return [{ text: item.text, citations }];
      }),
    }))
    .filter((s) => s.items.length > 0);
  return { output: { sections }, removed };
}

/**
 * §W6 5c: a skill is "matched" only if it is one of the user's skills AND cites evidence linked to it.
 * Everything else the job asks for becomes a gap with the exact note, and the tailored CV loses every
 * sentence that mentions a gap skill.
 */
export function guardTailor(
  raw: TailorOutput,
  pack: SourcePack,
  jobDescription: string,
): Guarded<TailorOutput> {
  const removed: string[] = [];
  const skills = pack.filter((s) => s.kind === "skill" && s.name);
  const evidenceIds = new Set(pack.filter((s) => s.kind === "evidence").map((s) => s.id));

  const matched: TailorOutput["matched"] = [];
  const gapNames: string[] = [];
  const addGap = (name: string) => {
    if (!gapNames.some((g) => sameSkill(g, name))) gapNames.push(name);
  };

  for (const m of raw.matched) {
    const skill = skills.find((s) => sameSkill(s.name!, m.skill));
    const evidence =
      skill?.links.includes(m.evidenceId) && evidenceIds.has(m.evidenceId) ? m.evidenceId : null;
    // Prefer any evidence actually linked to the skill if the model cited the wrong one.
    const linked = evidence ?? skill?.links.find((l) => evidenceIds.has(l)) ?? null;
    if (skill && linked) {
      if (!matched.some((x) => sameSkill(x.skill, skill.name!)))
        matched.push({ skill: skill.name!, evidenceId: linked });
    } else {
      removed.push(`matched ${m.skill}`);
      addGap(m.skill);
    }
  }
  for (const g of raw.gaps) addGap(g.skill);
  // Skills the job description asks for that the model forgot to classify.
  for (const name of skillsInText(
    jobDescription,
    skills.map((s) => s.name!),
  )) {
    if (matched.some((m) => sameSkill(m.skill, name))) continue;
    const skill = skills.find((s) => sameSkill(s.name!, name));
    const linked = skill?.links.find((l) => evidenceIds.has(l));
    if (skill && linked) matched.push({ skill: skill.name!, evidenceId: linked });
    else addGap(name);
  }
  const gaps = gapNames
    .filter((g) => !matched.some((m) => sameSkill(m.skill, g)))
    .map((skill) => ({ skill, note: NO_EVIDENCE_NOTE }));

  const sentences = raw.cv.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim());
  const kept = sentences.filter((sentence) => {
    const bad = gaps.some((g) => mentions(sentence, g.skill));
    if (bad) removed.push(sentence);
    return !bad;
  });
  return { output: { matched, gaps, cv: kept.join(" ") }, removed };
}

export function guardClassify(raw: ClassifyOutput): ClassifyOutput {
  return { ...raw, confidence: clamp01(raw.confidence) };
}

/** Facts from the database used to recompute claim-check statuses (§S10.2). */
export interface ClaimFact {
  claimId: string;
  label: string;
  hasActiveCredential: boolean;
  hasPendingRequest: boolean;
  evidenceIds: string[];
}

/** §S10.2 rules: the status is decided here, never by the model. */
export function ruleStatus(fact: ClaimFact): ClaimCheckStatus {
  if (fact.hasActiveCredential) return "VERIFIED";
  if (fact.hasPendingRequest) return "PENDING_ISSUER";
  if (fact.evidenceIds.length > 0) return "EVIDENCE_ATTACHED";
  return "CLAIM_WITHOUT_EVIDENCE";
}

export function guardClaimCheck(raw: ClaimCheckOutput, facts: ClaimFact[]): Guarded<ClaimCheckOutput> {
  const removed: string[] = [];
  const claims = facts.map((fact) => {
    const ai = raw.claims.find((c) => c.claimId === fact.claimId);
    const status = ruleStatus(fact);
    if (ai && ai.status !== status) removed.push(`status ${ai.status}→${status} for ${fact.claimId}`);
    return {
      claimId: fact.claimId,
      claim: fact.label,
      status,
      evidenceIds: fact.evidenceIds,
      confidence: ai ? clamp01(ai.confidence) : 0,
      reason:
        status === "CLAIM_WITHOUT_EVIDENCE"
          ? `${NO_EVIDENCE_NOTE}${ai?.reason ? ` ${ai.reason}` : ""}`
          : (ai?.reason ?? "Tidak dianalisis AI."),
    };
  });
  for (const c of raw.claims)
    if (!facts.some((f) => f.claimId === c.claimId)) removed.push(`unknown claim ${c.claimId}`);
  return { output: { claims }, removed };
}
