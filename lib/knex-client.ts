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
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    console.log('[testConnection] Starting database connection test...');
    const client = await getKnexClient();
    await client.raw('SELECT 1');
    console.log('[testConnection] ✓ Database connection successful');
    return true;
  } catch (error) {
    console.error('[testConnection] ✗ Database connection test failed:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
      detail: (error as any)?.detail,
    });

    // Clean up on error
    try {
      await closeKnexClient();
    } catch (closeError) {
      console.error('[testConnection] Error closing failed connection:', closeError);
    }

    return false;
  }
}

/**
 * Test database connection with specific connection string
 * Used during setup to validate credentials before storing them
 */
export async function testConnectionWithString(connectionString: string): Promise<{
  success: boolean;
  error?: string;
}> {
  let testClient: Knex | null = null;

  try {
    console.log('[testConnectionWithString] Testing database connection...');

    // Parse connection string to extract connection details
    const url = new URL(connectionString);

    // Create a temporary knex instance with the provided connection string
    testClient = knex({
      client: 'pg',
      connection: {
        host: url.hostname,
        port: parseInt(url.port || '6543', 10),
        database: url.pathname.slice(1), // Remove leading slash
        user: url.username,
        password: decodeURIComponent(url.password),
        ssl: { rejectUnauthorized: false },
      },
      pool: {
        min: 0,
        max: 1,
      },
    });

    // Test the connection
    await testClient.raw('SELECT 1');
    console.log('[testConnectionWithString] ✓ Database connection successful');

    return { success: true };
  } catch (error) {
    console.error('[testConnectionWithString] ✗ Database connection test failed:', {
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
        console.error('[testConnectionWithString] Error closing test connection:', closeError);
      }
    }
  }
}

