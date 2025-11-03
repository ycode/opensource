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

  console.log('[getKnexClient] Using knex configuration:', environment, config);

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
 * Test database connection using stored credentials
 */
export async function testKnexConnection(): Promise<boolean> {
  try {
    console.log('[testKnexConnection] Starting database connection test...');
    const client = await getKnexClient();
    await client.raw('SELECT 1');
    console.log('[testKnexConnection] ✓ Database connection successful');
    return true;
  } catch (error) {
    console.error('[testKnexConnection] ✗ Database connection test failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
      detail: (error as any)?.detail,
    });

    // Clean up on error
    try {
      await closeKnexClient();
    } catch (closeError) {
      console.error('[testKnexConnection] Error closing failed connection:', closeError);
    }

    return false;
  }
}

/**
 * Test database connection with Supabase credentials
 * Used during setup to validate credentials before storing them
 */
export async function testSupabaseDirectConnection(credentials: {
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  let testClient: Knex | null = null;

  try {
    console.log('[testSupabaseDirectConnection] Testing database connection...');

    // Create a temporary knex instance with the provided credentials
    testClient = knex({
      client: 'pg',
      connection: {
        host: credentials.dbHost,
        port: credentials.dbPort,
        database: credentials.dbName,
        user: credentials.dbUser,
        password: credentials.dbPassword,
        ssl: { rejectUnauthorized: false },
      },
      pool: {
        min: 0,
        max: 1,
      },
    });

    // Test the connection
    await testClient.raw('SELECT 1');
    console.log('[testSupabaseDirectConnection] ✓ Database connection successful');

    return { success: true };
  } catch (error) {
    console.error('[testSupabaseDirectConnection] ✗ Database connection test failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
      detail: (error as any)?.detail,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  } finally {
    // Always clean up the test client
    if (testClient) {
      try {
        await testClient.destroy();
      } catch (closeError) {
        console.error('[testSupabaseDirectConnection] Error closing test connection:', closeError);
      }
    }
  }
}

