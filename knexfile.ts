import type { Knex } from 'knex';
import path from 'path';
import { storage } from './lib/storage.ts';
import { parseSupabaseConfig } from './lib/supabase-config-parser.ts';
import type { SupabaseConfig } from './types/index.ts';

/**
 * Knex Configuration for YCode Supabase Migrations
 *
 * This configuration is used to run migrations programmatically
 * against the user's Supabase PostgreSQL database.
 */

/**
 * Load Supabase credentials from centralized storage
 * Uses environment variables on Vercel, file-based storage locally
 */
async function getSupabaseConnectionParams() {
  const config = await storage.get<SupabaseConfig>('supabase_config');

  if (!config?.connectionUrl || !config?.dbPassword) {
    throw new Error('Supabase not configured. Please run setup first.');
  }

  // Parse config to get all credentials including connection params
  const credentials = parseSupabaseConfig(config);

  return {
    host: credentials.dbHost,
    port: credentials.dbPort,
    database: credentials.dbName,
    user: credentials.dbUser,
    password: credentials.dbPassword,
    ssl: { rejectUnauthorized: false },
  };
}

const createConfig = (): Knex.Config => {
  const isVercel = process.env.VERCEL === '1';

  return {
    client: 'pg',
    connection: async () => {
      const connectionParams = await getSupabaseConnectionParams();

      console.log('[Knex] Creating database connection:', {
        host: connectionParams.host,
        port: connectionParams.port,
        user: connectionParams.user,
        database: connectionParams.database,
        password: '***' + connectionParams.password.slice(-4),
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

