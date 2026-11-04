import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  poweredByHeader: false,
  // Dev only: without this, opening the dev server via 127.0.0.1 blocks HMR/hydration (buttons dead).
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  // Keep the DB driver unbundled; pdfkit reads its AFM font files from disk at runtime (traced below).
  serverExternalPackages: ["pdfkit", "mariadb", "@prisma/adapter-mariadb"],
  outputFileTracingIncludes: {
    "/api/log/export": ["./node_modules/pdfkit/js/data/**/*"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
