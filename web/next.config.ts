import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable linting and type checking in production builds to prevent Render from 
  // hanging for 20+ mins or crashing via Out-of-Memory (OOM) killer.
  // @ts-expect-error - NextConfig types occasionally miss this property but it is valid
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Prevent Next.js from creating massive build traces which fills up small disks
  outputFileTracing: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
