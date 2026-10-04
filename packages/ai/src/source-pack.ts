/** One piece of the user's own data. The source pack is the ONLY material the model may use (§S10.2). */
export interface SourceItem {
  /** Stable id, e.g. "skill:<uuid>", "evidence:<uuid>", "profile:<uuid>". */
  id: string;
  kind: "profile" | "skill" | "experience" | "project" | "achievement" | "community_role" | "evidence";
  /** Human-readable facts, already taken from the database. */
  text: string;
  /** Claims: linked evidence ids ("evidence:<uuid>"). Evidence: linked claim ids. */
  links: string[];
  /** Skills only: the skill name, used by deterministic guardrails. */
  name?: string;
}

export type SourcePack = SourceItem[];

// C0/C1 control characters except tab and newline.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/** Removes control characters and trims; user-controlled text never reaches the model raw. */
export function sanitize(text: string, maxLength = 4000): string {
  return text.replace(CONTROL, "").trim().slice(0, maxLength);
}

export const MAX_JOB_DESCRIPTION = 8000;

/**
 * Escapes markup so data cannot close a <source> element or open a new instruction block
 * (prompt-injection defence #1; the deterministic guardrails are defence #2).
 */
export function escapeSourceText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderSourcePack(pack: SourcePack): string {
  return pack
    .map((item) => {
      const links = item.links.length ? ` links="${item.links.join(" ")}"` : "";
      return `<source id="${item.id}" kind="${item.kind}"${links}>\n${escapeSourceText(sanitize(item.text))}\n</source>`;
    })
    .join("\n");
}

export const sourceIds = (pack: SourcePack) => new Set(pack.map((s) => s.id));
