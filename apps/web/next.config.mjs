import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript sources and are compiled by Next.
  transpilePackages: ["@proven/api", "@proven/contracts", "@proven/db", "@proven/ui", "@proven/vc"],
  webpack: (config, { isServer }) => {
    // Copies the Prisma query engine next to the server bundle in a pnpm monorepo (Vercel).
    if (isServer) config.plugins = [...config.plugins, new PrismaPlugin()];
    // Optional deps of WalletConnect/pino that are not used in the browser.
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // Optional peer deps of @coinbase/cdp-sdk (x402 payments), pulled in by the AppKit wagmi adapter.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core": false,
      "@x402/evm": false,
      "@x402/svm": false,
      "@x402/extensions": false,
      // React Native storage referenced by @metamask/sdk; unused on the web.
      "@react-native-async-storage/async-storage": false,
    };
    // viem → ox ships an optional "tempo" module with a dynamic require; harmless for us.
    config.ignoreWarnings = [...(config.ignoreWarnings ?? []), { module: /ox\/_esm\/tempo/ }];
    return config;
  },
};

export default nextConfig;
