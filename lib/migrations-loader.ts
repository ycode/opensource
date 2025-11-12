/**
 * Automatic Migration Loader for Next.js
 *
 * Uses webpack's require.context to automatically load all migration files
 * No need to manually add imports when creating new migrations!
 */

import type { Knex } from 'knex';

// TypeScript type for webpack's require.context
interface WebpackRequireContext {
  keys(): string[];
  (id: string): any;
  <T>(id: string): T;
  resolve(id: string): string;
  id: string;
}

// Webpack's require.context function
declare const require: {
  context(
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp
  ): WebpackRequireContext;
};

interface Migration {
  name: string;
  up: (knex: Knex) => Promise<void>;
  down: (knex: Knex) => Promise<void>;
}

// Use require.context to load all .ts files from the migrations directory
const migrationFiles = require.context(
  '../database/migrations',
  false,
  /\.ts$/
);

// Build migrations array from loaded files
export const migrations: Migration[] = migrationFiles
  .keys()
  .sort() // Sort alphabetically (which matches timestamp order)
  .map((fileName: string) => {
    const migration = migrationFiles(fileName);
    // Extract just the filename without the './' prefix
    const name = fileName.replace('./', '');

    return {
      name,
      up: migration.up,
      down: migration.down,
    };
  });

