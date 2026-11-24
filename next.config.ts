import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "postgres"],
  outputFileTracingIncludes: { "/": ["./data/seed-beers.json"] },
  // One address per page: the old vercel.app alias permanently redirects to the custom domain,
  // so search engines consolidate on gf-beer.michaelbreeden.me.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "gf-beer-index.vercel.app" }],
        destination: "https://gf-beer.michaelbreeden.me/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
