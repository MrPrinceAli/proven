import { describe, expect, it } from "vitest";
import { credentialRegistryAbi, credentialSBTAbi, issuerRegistryAbi } from "../abi";

const functionNames = (abi: readonly { type: string; name?: string }[]) =>
  abi.filter((item) => item.type === "function").map((item) => item.name);

describe("@proven/contracts ABI exports", () => {
  it("exposes the CredentialRegistry anchor API", () => {
    expect(functionNames(credentialRegistryAbi)).toEqual(
      expect.arrayContaining(["issue", "revoke", "isRevoked", "getAnchor", "issuerRegistry"]),
    );
  });

  it("exposes the IssuerRegistry API", () => {
    expect(functionNames(issuerRegistryAbi)).toEqual(
      expect.arrayContaining(["register", "deactivate", "isActive", "issuers"]),
    );
  });

  it("exposes the soulbound CredentialSBT API", () => {
    expect(functionNames(credentialSBTAbi)).toEqual(expect.arrayContaining(["mint", "burn", "locked"]));
  });
});
