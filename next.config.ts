import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dashboard is a live wallboard — never statically cache API responses.
  reactStrictMode: true,
  // The embedded dev database ships WASM and must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
