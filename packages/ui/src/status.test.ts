import { describe, expect, it } from "vitest";
import { STATUS_STYLES, statusStyle } from "./status";

describe("StatusBadge styles", () => {
  it("has a label, description and icon for every §S4 status", () => {
    expect(Object.keys(STATUS_STYLES).sort()).toEqual(
      [
        "CLAIM_WITHOUT_EVIDENCE",
        "EVIDENCE_ATTACHED",
        "EXPIRED",
        "PENDING_ISSUER",
        "REVOKED",
        "UNVERIFIED",
        "VERIFIED",
      ].sort(),
    );
    for (const style of Object.values(STATUS_STYLES)) {
      expect(style.label).not.toBe("");
      expect(typeof style.icon).toBe("function");
    }
  });

  it("uses the exact no-evidence wording from golden rule #2", () => {
    expect(STATUS_STYLES.CLAIM_WITHOUT_EVIDENCE.description).toBe("Skill detected — evidence not found.");
  });

  it("gives every status a distinct colour treatment", () => {
    const classes = Object.values(STATUS_STYLES).map((s) => s.className);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it("falls back to UNVERIFIED for unknown values", () => {
    expect(statusStyle("???").label).toBe("Belum diverifikasi");
  });
});
