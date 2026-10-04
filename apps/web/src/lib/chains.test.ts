import { describe, expect, it } from "vitest";
import { appChain, shortDid } from "./chains";

describe("appChain", () => {
  it("returns BSC Testnet for 97 with a custom RPC", () => {
    const chain = appChain(97, "https://rpc.example");
    expect(chain.id).toBe(97);
    expect(chain.rpcUrls.default.http).toEqual(["https://rpc.example"]);
  });

  it("returns Anvil for 31337", () => {
    expect(appChain(31337).name).toBe("Anvil");
  });

  it("rejects other chains", () => {
    expect(() => appChain(1)).toThrow(/Unsupported/);
  });
});

describe("shortDid", () => {
  it("shortens the address part of a did:ethr", () => {
    expect(shortDid("did:ethr:97:0x70997970c51812dc3a010c7d01b50e0d17dc79c8")).toBe(
      "did:ethr:97:0x7099…79c8",
    );
  });

  it("leaves other strings alone", () => {
    expect(shortDid("did:web:example.com")).toBe("did:web:example.com");
  });
});
