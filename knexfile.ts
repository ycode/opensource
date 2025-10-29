import type { Knex } from 'knex';
import path from 'path';

/**
 * Knex Configuration for YCode Supabase Migrations
 * 
 * This configuration is used to run migrations programmatically
 * against the user's Supabase PostgreSQL database.
 */

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: async () => {
      // Dynamically load Supabase credentials from Vercel KV
      const { getSupabaseConfig } = await import('./lib/supabase-server');
      const supabaseConfig = await getSupabaseConfig();
      
      if (!supabaseConfig) {
        throw new Error('Supabase not configured. Please run setup first.');
      }

      // Parse connection string from Supabase URL
      // Supabase URL format: https://[project-ref].supabase.co
      // Connection string format: postgres://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
      const projectRef = supabaseConfig.url.replace('https://', '').replace('.supabase.co', '');
      
      return {
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: supabaseConfig.db_password,
        ssl: { rejectUnauthorized: false },
      };
    },
    migrations: {
      directory: path.join(process.cwd(), 'database/migrations'),
      extension: 'ts',
      tableName: 'migrations',
    },
    pool: {
      min: 2,
      max: 10,
    },
  },

  production: {
    client: 'pg',
    connection: async () => {
      const { getSupabaseConfig } = await import('./lib/supabase-server');
      const supabaseConfig = await getSupabaseConfig();
      
      if (!supabaseConfig) {
        throw new Error('Supabase not configured. Please run setup first.');
      }

      const projectRef = supabaseConfig.url.replace('https://', '').replace('.supabase.co', '');
      
      return {
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: supabaseConfig.db_password,
        ssl: { rejectUnauthorized: false },
      };
    },
    migrations: {
      directory: path.join(process.cwd(), 'database/migrations'),
      extension: 'ts',
      tableName: 'migrations',
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
};

export default config;

