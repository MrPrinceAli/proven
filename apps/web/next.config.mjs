/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript sources and are compiled by Next.
  transpilePackages: ["@proven/api", "@proven/ui"],
};

export default nextConfig;
