import { describe, expect, it } from "vitest";
import { packageName } from "./index";

describe("@proven/vc", () => {
  it("exports its package name", () => {
    expect(packageName).toBe("@proven/vc");
  });
});
