import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // dev listens on 0.0.0.0 so WSL forwards it to Windows; let the IPv4 loopback load dev assets too
  allowedDevOrigins: ["127.0.0.1"],
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
