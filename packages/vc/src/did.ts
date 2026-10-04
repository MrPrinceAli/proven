import { getAddress, isAddress, type Address } from "viem";

/** did:ethr:{chainId}:{address lowercase} — lowercase keeps subjectRef stable for the same wallet (§S8.0 #6). */
export function didFromAddress(chainId: number, address: string): string {
  if (!isAddress(address, { strict: false })) throw new Error(`Invalid address: ${address}`);
  return `did:ethr:${chainId}:${address.toLowerCase()}`;
}

/** Extracts the checksummed address from did:ethr:{chainId}:{address}; null for other DIDs. */
export function addressFromDid(did: string): Address | null {
  const match = /^did:ethr:(?:0x[0-9a-fA-F]+|\d+):(0x[0-9a-fA-F]{40})$/.exec(did);
  return match ? getAddress(match[1]!) : null;
}

export function chainIdFromDid(did: string): number | null {
  const match = /^did:ethr:(\d+):0x[0-9a-fA-F]{40}$/.exec(did);
  return match ? Number(match[1]) : null;
}
