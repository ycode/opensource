import knex, { Knex } from 'knex';
import path from 'path';
import { getSupabaseConfig } from './supabase-server';

/**
 * Knex Client for YCode Migrations
 * 
 * Creates a knex instance connected to the user's Supabase PostgreSQL database
 */

let knexInstance: Knex | null = null;

interface SupabaseConnectionInfo {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/**
 * Parse Supabase connection info from config
 * 
 * Note: This requires the database password to be stored in KV
 * Users should provide this during the setup process
 */
async function getConnectionInfo(): Promise<SupabaseConnectionInfo> {
  const config = await getSupabaseConfig();
  
  if (!config) {
    throw new Error('Supabase not configured. Please run setup first.');
  }

  // Extract project reference from Supabase URL
  // Format: https://[project-ref].supabase.co
  const urlMatch = config.url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    throw new Error('Invalid Supabase URL format');
  }

  const projectRef = urlMatch[1];

  return {
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: config.db_password,
  };
}

/**
 * Get or create knex instance
 */
export async function getKnexClient(): Promise<Knex> {
  if (knexInstance) {
    return knexInstance;
  }

  const connectionInfo = await getConnectionInfo();

  knexInstance = knex({
    client: 'pg',
    connection: {
      ...connectionInfo,
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: path.join(process.cwd(), 'database/migrations'),
      extension: 'ts',
      tableName: 'migrations',
    },
  });

  return knexInstance;
}

/**
 * Close knex connection
 */
export async function closeKnexClient(): Promise<void> {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await getKnexClient();
    await client.raw('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

