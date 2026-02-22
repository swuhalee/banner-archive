import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Upload form payload can exceed the default 1MB limit.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
