import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: "export",
  basePath: process.env.PAGES_BASE_PATH,
  images: { unoptimized: true },
};

export default nextConfig;
