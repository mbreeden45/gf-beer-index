import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "postgres"],
  outputFileTracingIncludes: { "/": ["./data/seed-beers.json"] },
};

export default nextConfig;
