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
async function loadSupabaseConfig() {
  const config = await storage.get<{
    url: string;
    anonKey: string;
    serviceRoleKey: string;
    dbPassword: string;
  }>('supabase_config');

  if (!config || !config.url || !config.dbPassword) {
    throw new Error('Supabase not configured. Please run setup first.');
  }

  return {
    url: config.url,
    dbPassword: config.dbPassword,
  };
}

const createConfig = (): Knex.Config => {
  const isVercel = process.env.VERCEL === '1';

  return {
    client: 'pg',
    connection: async () => {
      // Load Supabase credentials from storage
      const supabaseConfig = await loadSupabaseConfig();

      // Parse connection string from Supabase URL
      // Supabase URL format: https://[project-ref].supabase.co
      // Connection string format: postgres://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
      const projectRef = supabaseConfig.url.replace('https://', '').replace('.supabase.co', '');

      console.log('[Knex] Creating database connection:', {
        host: `db.${projectRef}.supabase.co`,
        user: 'postgres',
        database: 'postgres',
        isVercel,
        passwordLength: supabaseConfig.dbPassword.length,
      });

      return {
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: supabaseConfig.dbPassword, // Knex handles encoding internally
        ssl: { rejectUnauthorized: false },
      };
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

