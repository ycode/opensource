import type { Knex } from 'knex';
import path from 'path';
import { storage } from './lib/storage.ts';

/**
 * Knex Configuration for YCode Supabase Migrations
 *
 * This configuration is used to run migrations programmatically
 * against the user's Supabase PostgreSQL database.
 */

/**
 * Load Supabase config from centralized storage
 * Uses environment variables on Vercel, file-based storage locally
 */
async function getSupabaseConnectionString() {
  const config = await storage.get<{ connectionString: string }>('supabase_config');

  if (!config?.connectionString) {
    throw new Error('Supabase not configured. Please run setup first.');
  }

  return config.connectionString;
}

/**
 * Parse Supabase connection string
 * Format: postgresql://user:password@host:port/database?params
 */
function parseConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString);

    return {
      host: url.hostname,
      port: parseInt(url.port || '6543', 10),
      database: url.pathname.slice(1), // Remove leading slash
      user: url.username,
      password: decodeURIComponent(url.password),
      ssl: { rejectUnauthorized: false },
    };
  } catch (error) {
    console.error('[Knex] Failed to parse connection string:', error);
    throw new Error('Invalid connection string format. Expected: postgresql://user:password@host:port/database');
  }
}

const createConfig = (): Knex.Config => {
  const isVercel = process.env.VERCEL === '1';

  return {
    client: 'pg',
    connection: async () => {
      // Load Supabase credentials from storage
      const connectionString = await getSupabaseConnectionString();

      // Parse the connection string to get connection parameters
      const connectionParams = parseConnectionString(connectionString);

      console.log('[Knex] Creating database connection:', {
        host: connectionParams.host,
        port: connectionParams.port,
        user: connectionParams.user,
        database: connectionParams.database,
        password: '***' + connectionParams.password.slice(-4), // Only show last 4 chars
      });

      return connectionParams;
    },
    migrations: {
      directory: path.join(process.cwd(), 'database/migrations'),
      extension: 'ts',
      tableName: 'migrations',
    },
    pool: isVercel ? {
      // Serverless-optimized pool settings
      min: 0,
      max: 1,
      // Aggressive connection cleanup for serverless
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      idleTimeoutMillis: 1000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    } : {
      min: 2,
      max: 10,
    },
  };
};

const config: { [key: string]: Knex.Config } = {
  development: createConfig(),
  production: createConfig(),
};

export default config;

