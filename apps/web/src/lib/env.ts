// Public (browser) configuration. Only NEXT_PUBLIC_* values — never secrets.
export const publicEnv = {
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "97"),
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
  reownProjectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "",
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "",
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "/api",
} as const;
