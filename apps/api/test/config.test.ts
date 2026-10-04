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

describe("issuer identity (D-025)", () => {
  const anvil1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const anvil1Key = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

  it("derives the issuer DID from CHAIN_ID and the address", () => {
    const config = testConfig({ ISSUER_ADDRESS: anvil1, ISSUER_NAME: "XYZ Community" });
    expect(config.issuer).toEqual({
      address: anvil1,
      name: "XYZ Community",
      did: "did:ethr:97:0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    });
  });

  it("rejects an ISSUER_DID that does not match the address", () => {
    expect(() =>
      testConfig({
        ISSUER_ADDRESS: anvil1,
        ISSUER_NAME: "X",
        ISSUER_DID: "did:ethr:97:0x0000000000000000000000000000000000000001",
      }),
    ).toThrow(/ISSUER_DID/);
  });

  it("rejects an ISSUER_PRIVATE_KEY that belongs to another address", () => {
    expect(() =>
      testConfig({
        ISSUER_ADDRESS: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        ISSUER_NAME: "X",
        ISSUER_PRIVATE_KEY: anvil1Key,
      }),
    ).toThrow(/ISSUER_PRIVATE_KEY/);
    expect(
      testConfig({ ISSUER_ADDRESS: anvil1, ISSUER_NAME: "X", ISSUER_PRIVATE_KEY: anvil1Key })
        .issuerPrivateKey,
    ).toBe(anvil1Key);
  });
});

describe("LLM provider", () => {
  it("requires LLM_API_KEY for the anthropic provider and defaults the model", () => {
    expect(() => testConfig({ LLM_PROVIDER: "anthropic" })).toThrow(/LLM_API_KEY/);
    expect(testConfig({ LLM_PROVIDER: "anthropic", LLM_API_KEY: "sk-test" }).llm).toMatchObject({
      provider: "anthropic",
      model: "claude-opus-5-5",
      timeoutMs: 10_000,
    });
  });
});
