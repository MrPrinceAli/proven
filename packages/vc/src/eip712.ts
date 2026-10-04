import { isAddressEqual, recoverTypedDataAddress, type Address, type Hex, type LocalAccount } from "viem";
import { isoSeconds } from "./build";
import { addressFromDid } from "./did";
import { credentialHash, subjectRef } from "./hash";
import { PROVEN_CRYPTOSUITE, type UnsignedCredential, type VerifiableCredential } from "./schema";

/** §S7.3: verifyingContract is the CredentialRegistry address. */
export const provenDomain = (chainId: number, verifyingContract: Address) =>
  ({ name: "Proven", version: "1", chainId, verifyingContract }) as const;

export const credentialTypes = {
  Credential: [
    { name: "credentialHash", type: "bytes32" },
    { name: "subjectRef", type: "bytes32" },
  ],
} as const;

export interface TypedDataInput {
  chainId: number;
  verifyingContract: Address;
  credentialHash: Hex;
  subjectRef: Hex;
}

export function getTypedData({ chainId, verifyingContract, credentialHash, subjectRef }: TypedDataInput) {
  return {
    domain: provenDomain(chainId, verifyingContract),
    types: credentialTypes,
    primaryType: "Credential" as const,
    message: { credentialHash, subjectRef },
  };
}

export interface SignOptions {
  chainId: number;
  verifyingContract: Address;
  created?: Date;
}

/** Adds the secondary EIP-712 proof (§S7.2 step 5). The on-chain anchor is the primary proof. */
export async function signCredential(
  account: LocalAccount,
  vc: UnsignedCredential,
  { chainId, verifyingContract, created = new Date() }: SignOptions,
): Promise<VerifiableCredential> {
  const signature = await account.signTypedData(
    getTypedData({
      chainId,
      verifyingContract,
      credentialHash: credentialHash(vc),
      subjectRef: subjectRef(vc.credentialSubject.id),
    }),
  );
  return {
    ...vc,
    proof: {
      type: "DataIntegrityProof",
      cryptosuite: PROVEN_CRYPTOSUITE,
      created: isoSeconds(created),
      verificationMethod: `${vc.issuer.id}#controller`,
      proofPurpose: "assertionMethod",
      proofValue: signature,
    },
  };
}

/** Recovers the EIP-712 signer and compares it to the expected issuer address. */
export async function verifyCredentialSignature(
  vc: VerifiableCredential,
  expectedIssuer: Address,
  { chainId, verifyingContract }: Omit<SignOptions, "created">,
): Promise<boolean> {
  if (!vc.proof) return false;
  try {
    const signer = await recoverTypedDataAddress({
      ...getTypedData({
        chainId,
        verifyingContract,
        credentialHash: credentialHash(vc),
        subjectRef: subjectRef(vc.credentialSubject.id),
      }),
      signature: vc.proof.proofValue as Hex,
    });
    return isAddressEqual(signer, expectedIssuer);
  } catch {
    return false;
  }
}

export const issuerAddressOf = (vc: Pick<VerifiableCredential, "issuer">) => addressFromDid(vc.issuer.id);
