import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-0f577ec0429b4890b78265bc3e7eab92.r2.dev",
      },
    ],
  },
};

export default nextConfig;
