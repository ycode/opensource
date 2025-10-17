import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to public pages ONLY (exclude /api/*, /ycode/*, /_next/*)
        source: '/:path((?!api|ycode|_next).*)*',
        headers: [
          {
            key: 'Cache-Control',
            // s-maxage=3600: CDN can cache for 1 hour
            // stale-while-revalidate=86400: Serve stale while updating in background
            // must-revalidate: Browser must check with CDN before using cache
            value: 's-maxage=3600, stale-while-revalidate=86400, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
