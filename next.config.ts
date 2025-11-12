import type { NextConfig } from 'next';

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

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore optional dependencies that Knex tries to load
      // We only use PostgreSQL, so we don't need these drivers
      config.externals = config.externals || [];
      config.externals.push({
        'oracledb': 'commonjs oracledb',
        'mysql': 'commonjs mysql',
        'mysql2': 'commonjs mysql2',
        'sqlite3': 'commonjs sqlite3',
        'better-sqlite3': 'commonjs better-sqlite3',
        'tedious': 'commonjs tedious',
        'pg-query-stream': 'commonjs pg-query-stream',
      });
    }

    // Suppress Knex migration warnings (we don't use migrations in Next.js runtime)
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/knex\/lib\/migrations\/util\/import-file\.js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    return config;
  },
};

export default nextConfig;
