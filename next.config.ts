import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dashboard is a live wallboard — never statically cache API responses.
  reactStrictMode: true,
};

export default nextConfig;
