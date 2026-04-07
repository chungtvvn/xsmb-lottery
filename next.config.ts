import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow fetching from GitHub raw content
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
  // External image domains if needed
  images: {
    domains: [],
  },
};

export default nextConfig;
