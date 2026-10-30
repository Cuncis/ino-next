import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // dev listens on 0.0.0.0 so WSL forwards it to Windows; let the IPv4 loopback load dev assets too
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  // a 404 page for URLs outside both root layouts (storefront and admin)
  experimental: {
    globalNotFound: true,
    // Pages are checked for "instant" navigations only where they opt in. The storefront
    // waits for each page's data on navigation, as the Inertia app did (src/app/(shop)/layout.tsx).
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
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
