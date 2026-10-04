import { describe, expect, it } from "vitest";
import { credentialBadge, shortHash } from "./explorer";

describe("explorer helpers", () => {
  it("maps credential states to claim badges", () => {
    expect(credentialBadge("active")).toBe("VERIFIED");
    expect(credentialBadge("revoked")).toBe("REVOKED");
    expect(credentialBadge("expired")).toBe("EXPIRED");
  });

  it("shortens hashes", () => {
    expect(shortHash(`0x${"ab".repeat(32)}`)).toBe("0xabababab…ababab");
  });
});
