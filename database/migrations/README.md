# YCode Database Migrations

This directory contains Knex.js migrations for the YCode database schema.

## Overview

YCode uses [Knex.js](https://knexjs.org/) to manage database migrations programmatically. Migrations are run against the user's Supabase PostgreSQL database during the setup process.

## Migration Files

Migrations are numbered and run in order:

1. **20250101000001_create_pages_table.ts** - Creates the `pages` table with RLS policies
2. **20250101000002_create_page_versions_table.ts** - Creates the `page_versions` table with foreign keys
3. **20250101000003_create_assets_table.ts** - Creates the `assets` table for file storage
4. **20250101000004_create_settings_table.ts** - Creates the `settings` table with default values
5. **20250101000005_create_storage_bucket.ts** - Creates Supabase storage bucket with policies

## Running Migrations

### During Setup (Recommended)

Migrations are automatically run when users complete the setup wizard at `/welcome`. This is handled by the API endpoint at `/api/setup/migrate`.

### Manual Migration Commands

You can also run migrations manually using npm scripts:

```bash
# Run all pending migrations
npm run migrate:latest

# Check migration status
npm run migrate:status

# Rollback last batch of migrations
npm run migrate:rollback

# Create a new migration
npm run migrate:make migration_name
```

## Database Connection

Migrations connect to the Supabase PostgreSQL database using credentials stored in the file-based storage during setup:

- **Supabase URL**: `https://[project-ref].supabase.co`
- **Database Host**: `db.[project-ref].supabase.co`
- **Database**: `postgres` (default)
- **User**: `postgres` (default)
- **Password**: Stored in `supabase_config.dbPassword`

**Important**: The database password must be provided during the initial setup for migrations to work.

## Creating New Migrations

To create a new migration:

```bash
npm run migrate:make create_my_table
```

This will create a new TypeScript file in `database/migrations/` with the following structure:

```typescript
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create tables, add columns, etc.
  await knex.schema.createTable('my_table', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  // Rollback changes
  await knex.schema.dropTableIfExists('my_table');
}
```

### Best Practices

1. **Always include both `up` and `down` functions** - This allows for rollback
2. **Use `IF NOT EXISTS` / `IF EXISTS`** - Makes migrations idempotent
3. **Test migrations locally** before deploying
4. **Use transactions** - Knex automatically wraps migrations in transactions
5. **Don't modify existing migrations** - Create new ones instead

## Supabase-Specific Features

Some Supabase features require raw SQL since they're not standard PostgreSQL:

### Row Level Security (RLS)

```typescript
// Enable RLS
await knex.schema.raw('ALTER TABLE my_table ENABLE ROW LEVEL SECURITY');

// Create policy
await knex.schema.raw(`
  CREATE POLICY "Public can read"
    ON my_table FOR SELECT
    USING (TRUE)
`);
```

### Storage Buckets

```typescript
// Create storage bucket
await knex.schema.raw(`
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('my-bucket', 'my-bucket', true)
  ON CONFLICT (id) DO NOTHING
`);
```

## Troubleshooting

### Connection Issues

If migrations fail with connection errors:

1. Verify the database password is correct in setup
2. Check Supabase project is not paused
3. Ensure database is accessible (not behind firewall)

### Migration Failed Partway Through

Knex uses transactions, so failed migrations are automatically rolled back. You can safely retry.

### Table Already Exists

Migrations use `IF NOT EXISTS` / `IF EXISTS` to be idempotent. You can safely re-run them.

### Checking Migration Status

```bash
npm run migrate:status
```

This shows which migrations have been run and which are pending.

## Migration Tracking

Knex creates a table called `migrations` to track which migrations have been executed. This table is created automatically on the first migration run.

## API Endpoints

- **POST /api/setup/migrate** - Run all pending migrations
- **GET /api/setup/migrate** - Get migration status (completed and pending)

## Architecture

```
User Setup → API Route → Migration Service → Knex Client → Supabase PostgreSQL
   ↓            ↓              ↓                  ↓              ↓
 Provides    Validates    Loads config      Connects to     Executes SQL
 DB creds    and calls    from storage      database        migrations
```

## Security

- Database credentials are stored securely in file-based storage
- Migrations only run server-side (never exposed to browser)
- Service role key is used for database access
- RLS policies protect data even after migration

## Further Reading

- [Knex.js Documentation](https://knexjs.org/)
- [Knex Schema Builder](https://knexjs.org/guide/schema-builder.html)
- [Knex Migrations](https://knexjs.org/guide/migrations.html)
- [Supabase Database](https://supabase.com/docs/guides/database)

