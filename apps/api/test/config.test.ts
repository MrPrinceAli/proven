import { describe, expect, it } from "vitest";
import { testConfig } from "./helpers";

describe("loadConfig", () => {
  it("fails fast listing every invalid variable", () => {
    expect(() => testConfig({ SESSION_SECRET: "short", CHAIN_ID: "abc" })).toThrow(
      /SESSION_SECRET.*CHAIN_ID|CHAIN_ID.*SESSION_SECRET/,
    );
  });

  it("rejects non-checksummed admin addresses", () => {
    expect(() => testConfig({ ADMIN_ADDRESSES: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" })).toThrow(
      /EIP-55/,
    );
  });

  it("allows Vercel deployment hosts as SIWE domains (D-007)", () => {
    const config = testConfig({
      VERCEL_URL: "proven-abc123-viclatess.vercel.app",
      VERCEL_BRANCH_URL: "proven-git-w2-viclatess.vercel.app",
    });
    expect(config.allowedDomains).toEqual([
      "proven.test",
      "proven-abc123-viclatess.vercel.app",
      "proven-git-w2-viclatess.vercel.app",
    ]);
    expect(config.allowedOrigins).toContain("https://proven-git-w2-viclatess.vercel.app");
  });

  it("uses http only for localhost origins", () => {
    const config = testConfig({ APP_DOMAIN: "localhost:3000", APP_URL: "http://localhost:3000" });
    expect(config.allowedOrigins).toEqual(["http://localhost:3000"]);
  });
});
