/**
 * Postgres connection + Drizzle client.
 * Import `db` anywhere server-side: `import { db } from '@/lib/db'`.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and run `docker compose up -d`.',
  );
}

// Reuse the client across hot-reloads in dev so we don't exhaust connections.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client = globalForDb.pgClient ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
