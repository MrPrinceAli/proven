import { defineChain, type Chain } from "viem";
import { bscTestnet } from "viem/chains";

export const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  testnet: true,
});

/** The single chain the app runs on: 97 (BSC Testnet) for demo, 31337 (Anvil) for tests/E2E. */
export function appChain(chainId: number, rpcUrl?: string): Chain {
  const base = chainId === anvil.id ? anvil : chainId === bscTestnet.id ? bscTestnet : undefined;
  if (!base) throw new Error(`Unsupported NEXT_PUBLIC_CHAIN_ID ${chainId}; use 97 or 31337`);
  if (!rpcUrl) return base;
  return { ...base, rpcUrls: { ...base.rpcUrls, default: { http: [rpcUrl] } } };
}

/** did:ethr:{chainId}:0x1234…abcd for compact display. */
export function shortDid(did: string): string {
  const match = /^(did:ethr:\d+:)(0x[0-9a-f]{40})$/.exec(did);
  if (!match) return did;
  const [, prefix, address] = match;
  return `${prefix}${address!.slice(0, 6)}…${address!.slice(-4)}`;
}
