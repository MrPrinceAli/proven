import { describe, expect, it } from "vitest";
import { buttonClasses } from "./button";

describe("buttonClasses", () => {
  it("defaults to the green primary variant", () => {
    expect(buttonClasses()).toContain("bg-brand-700");
  });

  it("appends extra classes", () => {
    expect(buttonClasses("ghost", "w-full")).toMatch(/text-muted.*w-full$/);
  });
});
