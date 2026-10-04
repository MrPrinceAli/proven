"use client";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { createConfig, http, injected, type Config } from "wagmi";
import { appChain } from "./chains";
import { publicEnv } from "./env";
import { site } from "./site";

const chain = appChain(publicEnv.chainId, publicEnv.rpcUrl);

/** True when Reown AppKit (WalletConnect, many wallets) is configured; otherwise only injected wallets (MetaMask). */
export const hasAppKit = publicEnv.reownProjectId.length > 0;

function buildConfig(): Config {
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
