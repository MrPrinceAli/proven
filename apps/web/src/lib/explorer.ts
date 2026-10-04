import { publicEnv } from "./env";

/** Link to a transaction on the block explorer; null on Anvil (no explorer). */
export function txUrl(txHash: string | null | undefined): string | null {
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash) || !publicEnv.explorerUrl || publicEnv.chainId === 31337)
    return null;
  return `${publicEnv.explorerUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

export const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-6)}`;

/** Credential state → the claim status badge it corresponds to. */
export const credentialBadge = (status: string) =>
  status === "revoked" ? "REVOKED" : status === "expired" ? "EXPIRED" : "VERIFIED";
