"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { createConfig, http, injected, mock, type Config } from "wagmi";
import type { Address } from "viem";
import { appChain } from "./chains";
import { publicEnv } from "./env";
import { site } from "./site";

const chain = appChain(publicEnv.chainId, publicEnv.rpcUrl);

/** True when Reown AppKit (WalletConnect, many wallets) is configured; otherwise only injected wallets (MetaMask). */
export const hasAppKit = publicEnv.reownProjectId.length > 0;

/**
 * Browser tests only (W8 E2E): a mock wallet backed by Anvil's unlocked dev accounts, enabled at
 * build time with NEXT_PUBLIC_E2E=1 on chain 31337. Never active on BSC Testnet or in Vercel builds.
 */
const e2eMode = process.env.NEXT_PUBLIC_E2E === "1" && chain.id === 31337;
const E2E_DEFAULT_ACCOUNT: Address = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"; // Anvil #3

function e2eAccount(): Address {
  if (typeof window === "undefined") return E2E_DEFAULT_ACCOUNT;
  return (window.localStorage.getItem("proven:e2e-account") as Address | null) ?? E2E_DEFAULT_ACCOUNT;
}

function buildConfig(): Config {
  if (e2eMode) {
    return createConfig({
      chains: [chain],
      connectors: [mock({ accounts: [e2eAccount()], features: { reconnect: true } })],
      transports: { [chain.id]: http(publicEnv.rpcUrl) },
      ssr: true,
    });
  }
  if (!hasAppKit) {
    return createConfig({
      chains: [chain],
      connectors: [injected()],
      transports: { [chain.id]: http(publicEnv.rpcUrl) },
      ssr: true,
    });
  }

  const networks = [chain] as [AppKitNetwork, ...AppKitNetwork[]];
  const adapter = new WagmiAdapter({ networks, projectId: publicEnv.reownProjectId, ssr: true });
  if (typeof window !== "undefined") {
    createAppKit({
      adapters: [adapter],
      networks,
      projectId: publicEnv.reownProjectId,
      metadata: {
        name: site.name,
        description: site.description,
        url: window.location.origin,
        icons: [],
      },
      features: { analytics: false, email: false, socials: false },
      themeMode: "light",
      themeVariables: { "--w3m-accent": "#047857" },
    });
  }
  return adapter.wagmiConfig;
}

export const wagmiConfig = buildConfig();
export const targetChain = chain;
