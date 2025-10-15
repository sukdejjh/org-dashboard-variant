import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ⚙️ 빌드 시 타입/린트 에러 무시
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // ⚙️ "workspace root" 경고 해결
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
