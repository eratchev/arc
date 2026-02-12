import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@arc/db', '@arc/llm', '@arc/auth', '@arc/types'],
};

export default nextConfig;
