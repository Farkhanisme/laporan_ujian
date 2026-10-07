import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // Aplikasi ini sepenuhnya dinamis (data dari Turso per permintaan),
  // jadi cache components tidak perlu dan hanya menambah batasan.
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
