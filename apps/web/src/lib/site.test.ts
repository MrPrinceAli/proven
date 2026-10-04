import { describe, expect, it } from "vitest";
import { site } from "./site";

describe("site", () => {
  it("carries the Proven tagline", () => {
    expect(site.tagline).toBe("Anyone can claim a skill. Proven lets you prove it.");
  });
});
