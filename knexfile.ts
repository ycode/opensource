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

      // Parse project reference from Supabase URL
      // Supabase URL format: https://[project-ref].supabase.co
      const projectRef = supabaseConfig.url.replace('https://', '').replace('.supabase.co', '');

      // On Vercel, use connection pooler (recommended for serverless)
      if (isVercel) {
        // Try connection pooler format
        // Format: aws-0-[region].pooler.supabase.com:6543
        // Common regions: us-east-1, us-west-1, eu-west-1, ap-southeast-1, etc.

        // Try us-east-1 first (most common), then fallback to direct connection if it fails
        const poolerHost = `aws-0-us-east-1.pooler.supabase.com`;

        console.log('[Knex] Using connection pooler (serverless optimized):', {
          host: poolerHost,
          port: 6543,
          user: `postgres.${projectRef}`,
          database: 'postgres',
        });

        return {
          host: poolerHost,
          port: 6543,
          database: 'postgres',
          user: `postgres.${projectRef}`,
          password: supabaseConfig.dbPassword,
          ssl: { rejectUnauthorized: false },
        };
      }

      // Local development: use direct connection
      console.log('[Knex] Creating direct database connection:', {
        host: `db.${projectRef}.supabase.co`,
        user: 'postgres',
        database: 'postgres',
        passwordLength: supabaseConfig.dbPassword.length,
      });

      return {
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: supabaseConfig.dbPassword,
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

