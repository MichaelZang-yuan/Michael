import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer"],
  turbopack: false as any,
};

export default nextConfig;