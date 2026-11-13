import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // ponytail: every page is per-user behind auth, nothing to prerender
  cacheComponents: false,
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
