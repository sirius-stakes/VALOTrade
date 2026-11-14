import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma は Node.js ランタイムで実行する（ローカル SQLite 専用）
  serverExternalPackages: ["@prisma/client", "prisma"],
  images: {
    // ロゴはローカル /public 配下のみ。外部画像の最適化は行わない。
    remotePatterns: [],
  },
};

export default nextConfig;
