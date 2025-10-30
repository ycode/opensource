import knex, { Knex } from 'knex';
import knexfileConfig from '../knexfile';

/**
 * Knex Client for YCode Migrations
 * 
 * Creates a knex instance connected to the user's Supabase PostgreSQL database
 * Uses configuration from knexfile.ts based on NODE_ENV
 */

let knexInstance: Knex | null = null;

/**
 * Get or create knex instance
 */
export async function getKnexClient(): Promise<Knex> {
  if (knexInstance) {
    return knexInstance;
  }

  // Use NODE_ENV to determine which config to use (defaults to development)
  const environment = process.env.NODE_ENV || 'development';
  const config = knexfileConfig[environment];

  if (!config) {
    throw new Error(`No knex configuration found for environment: ${environment}`);
  }

  knexInstance = knex(config);

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

